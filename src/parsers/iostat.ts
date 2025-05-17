import { ParsedTimeSeries } from "../types";

export function parseIostat(content: string): ParsedTimeSeries {
  // Detect which format we're dealing with
  if (isLinuxStandardFormat(content)) {
    return parseLinuxStandardIostat(content);
  } else {
    // Use existing parser logic for original format
    return parseOriginalIostat(content);
  }
}

// Detect standard Linux iostat format (MM/DD/YYYY HH:MM:SS AM/PM)
function isLinuxStandardFormat(content: string): boolean {
  const lines = content.split("\n");
  // Check for Linux header line
  if (lines.length > 0 && lines[0].trim().startsWith("Linux")) {
    // Check for date format in the first few lines
    for (const line of lines.slice(1, 10)) {
      if (/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}\s+[AP]M/.test(line.trim())) {
        return true;
      }
    }
  }
  return false;
}

// Original parser logic - renamed but otherwise unchanged
function parseOriginalIostat(content: string): ParsedTimeSeries {
  const lines = content.split("\n");
  const timestamps: string[] = [];
  const series: { [metric: string]: number[] } = {};
  let currentTimestamp = "";

  // Fixed list of CPU metrics we want to capture - these match the column headers in the file
  const CPU_METRICS = [
    "%user", "%nice", "%system", "%iowait", "%steal", "%idle"
  ];
  
  // Fixed list of device metrics we want to capture
  const DEVICE_METRICS = [
    "r/s", "w/s", "rkB/s", "wkB/s", "r_await", "w_await", "%util"
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(line)) {
      currentTimestamp = line;
      timestamps.push(currentTimestamp);
      
      // 1. Process CPU metrics
      let cpuIdx = i;
      while (cpuIdx < lines.length && !lines[cpuIdx].includes("avg-cpu:")) cpuIdx++;
      if (cpuIdx < lines.length) {
        // Get the CPU header to verify metric names and positions
        const cpuHeader = lines[cpuIdx].trim().split(/\s+/).slice(1); // Remove "avg-cpu:" part
        const cpuValues = lines[cpuIdx + 1].trim().split(/\s+/);
        
        // Match CPU metrics with their values
        for (let k = 0; k < CPU_METRICS.length && k < cpuValues.length; k++) {
          const metricName = CPU_METRICS[k]; // Use the predefined metric name
          if (!series[metricName]) {
            series[metricName] = Array(timestamps.length - 1).fill(NaN);
          }
          const value = Number(cpuValues[k]);
          series[metricName].push(isNaN(value) ? NaN : value);
        }
      }
      
      // 2. Find device metrics section
      let deviceIdx = cpuIdx + 2; // Start looking after CPU section
      while (deviceIdx < lines.length && 
             !lines[deviceIdx].includes("Device")) deviceIdx++;
      
      if (deviceIdx < lines.length) {
        // Get column indices for the metrics we want
        const deviceHeader = lines[deviceIdx].trim().split(/\s+/);
        const metricIndices: {[key: string]: number} = {};
        
        for (let k = 0; k < deviceHeader.length; k++) {
          if (k === 0) {
            metricIndices["Device"] = 0; // Device name is always first column
          } else if (DEVICE_METRICS.includes(deviceHeader[k])) {
            metricIndices[deviceHeader[k]] = k;
          }
        }
        
        // 3. Process each device row
        let rowIdx = deviceIdx + 1;
        while (rowIdx < lines.length && 
               lines[rowIdx].trim() && 
               !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(lines[rowIdx])) {
          
          const deviceRow = lines[rowIdx].trim().split(/\s+/);
          if (deviceRow.length < 2) {
            rowIdx++;
            continue;
          }
          
          const deviceName = deviceRow[0];
          
          // Add data for each metric we're tracking
          for (const metricName of DEVICE_METRICS) {
            if (metricIndices[metricName] !== undefined && 
                metricIndices[metricName] < deviceRow.length) {
              
              const seriesKey = `${deviceName} ${metricName}`;
              if (!series[seriesKey]) {
                series[seriesKey] = Array(timestamps.length - 1).fill(NaN);
              }
              
              const value = Number(deviceRow[metricIndices[metricName]]);
              series[seriesKey].push(isNaN(value) ? NaN : value);
            }
          }
          
          rowIdx++;
        }
        
        // Move the loop index to where we stopped processing
        i = rowIdx - 1;
      }
      
      // Fill missing metrics for this timestamp
      Object.keys(series).forEach(metric => {
        if (series[metric].length < timestamps.length) {
          series[metric].push(NaN);
        }
      });
    }
  }
  
  // Debug: log the series keys to see what metrics we're generating
  console.log("IOSTAT METRICS:", Object.keys(series).slice(0, 10));
  
  return { timestamps, series };
}

// Parser for standard Linux iostat format
function parseLinuxStandardIostat(content: string): ParsedTimeSeries {
  const lines = content.split("\n");
  const timestamps: string[] = [];
  const series: { [metric: string]: number[] } = {};
  
  // Same CPU metrics as the original parser
  const CPU_METRICS = [
    "%user", "%nice", "%system", "%iowait", "%steal", "%idle"
  ];
  
  // Device metrics to capture, extended for Linux format
  const DEVICE_METRICS = [
    "r/s", "w/s", "rkB/s", "wkB/s", "r_await", "w_await", "%util",
    // Additional Linux iostat metrics
    "rrqm/s", "wrqm/s", "avgrq-sz", "avgqu-sz", "await", "svctm"
  ];

  let currentTimestamp = "";
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Detect timestamp in format MM/DD/YYYY HH:MM:SS AM/PM
    if (/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}\s+[AP]M/.test(line)) {
      // Parse the timestamp to ISO format for consistency
      const dateParts = line.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\s+([AP]M)/);
      if (dateParts) {
        const [_, month, day, year, hour, minute, second, ampm] = dateParts;
        let hourNum = parseInt(hour, 10);
        
        // Convert to 24-hour format
        if (ampm === "PM" && hourNum < 12) hourNum += 12;
        if (ampm === "AM" && hourNum === 12) hourNum = 0;
        
        // Format as ISO timestamp (like the original format)
        currentTimestamp = `${year}-${month}-${day}T${hourNum.toString().padStart(2, '0')}:${minute}:${second}`;
        timestamps.push(currentTimestamp);
        
        // 1. Process CPU metrics - similar logic to original parser
        let cpuIdx = i;
        while (cpuIdx < lines.length && !lines[cpuIdx].includes("avg-cpu:")) cpuIdx++;
        if (cpuIdx < lines.length) {
          const cpuValues = lines[cpuIdx + 1].trim().split(/\s+/);
          
          // Match CPU metrics with their values
          for (let k = 0; k < CPU_METRICS.length && k < cpuValues.length; k++) {
            const metricName = CPU_METRICS[k];
            if (!series[metricName]) {
              series[metricName] = Array(timestamps.length - 1).fill(NaN);
            }
            const value = Number(cpuValues[k]);
            series[metricName].push(isNaN(value) ? NaN : value);
          }
        }
        
        // 2. Find device metrics section
        let deviceIdx = cpuIdx + 2; // Start looking after CPU section
        while (deviceIdx < lines.length && 
               !lines[deviceIdx].includes("Device:")) deviceIdx++;
        
        if (deviceIdx < lines.length) {
          const deviceHeader = lines[deviceIdx].trim().split(/\s+/);
          const metricIndices: {[key: string]: number} = {};
          
          // Map all device metrics to their column positions
          for (let k = 0; k < deviceHeader.length; k++) {
            const headerItem = deviceHeader[k];
            if (headerItem === "Device:") continue;
            
            // Check if this header exists in our list of metrics to track
            if (DEVICE_METRICS.includes(headerItem)) {
              metricIndices[headerItem] = k;
            }
          }
          
          // 3. Process each device row
          let rowIdx = deviceIdx + 1;
          const endOfSectionPattern = /^\d{2}\/\d{2}\/\d{4}|^$/; // New timestamp or empty line
          
          while (rowIdx < lines.length && 
                 lines[rowIdx].trim() && 
                 !endOfSectionPattern.test(lines[rowIdx].trim())) {
            
            const deviceRow = lines[rowIdx].trim().split(/\s+/);
            if (deviceRow.length < 2) {
              rowIdx++;
              continue;
            }
            
            const deviceName = deviceRow[0];
            
            // Process all metrics we're tracking
            for (const metricName of DEVICE_METRICS) {
              if (metricIndices[metricName] !== undefined && 
                  metricIndices[metricName] < deviceRow.length) {
                
                const seriesKey = `${deviceName} ${metricName}`;
                if (!series[seriesKey]) {
                  series[seriesKey] = Array(timestamps.length - 1).fill(NaN);
                }
                
                const value = Number(deviceRow[metricIndices[metricName]]);
                series[seriesKey].push(isNaN(value) ? NaN : value);
              }
            }
            
            rowIdx++;
          }
          
          // Move the loop index to where we stopped processing
          i = rowIdx - 1;
        }
        
        // Fill missing metrics for this timestamp
        Object.keys(series).forEach(metric => {
          if (series[metric].length < timestamps.length) {
            series[metric].push(NaN);
          }
        });
      }
    }
  }
  
  console.log("LINUX IOSTAT METRICS:", Object.keys(series).slice(0, 10));
  
  return { timestamps, series };
}
