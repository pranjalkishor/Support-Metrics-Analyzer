import { ParsedTimeSeries } from "../types";

// Helper function to find where numeric values start in an array of parts
function findNumericStartIndex(parts: string[], headerColumns: string[]): number {
  // If we have header columns, try to match the expected structure
  if (headerColumns.length > 1 && parts.length >= headerColumns.length - 1) {
    // Look for positions where there might be numeric values aligned with headers
    const expectedCount = headerColumns.length - 1;
    return Math.max(1, parts.length - expectedCount);
  }
  
  // Otherwise look for the first numeric value
  for (let i = 0; i < parts.length; i++) {
    // Check if this part is a number or N/A
    const cleaned = parts[i].replace(/,/g, "");
    if (parts[i] === "N/A" || /^-?\d+(\.\d+)?$/.test(cleaned)) {
      return i;
    }
  }
  
  // Last resort: if we have at least 2 parts, assume the first part is the pool name
  if (parts.length >= 2) {
    return 1;
  }
  
  return -1;
}

export function parseTpstats(content: string): ParsedTimeSeries {
  console.log("Starting tpstats parser for cassandra format with section handling");
  
  try {
    const lines = content.split("\n");
    const timestamps: string[] = [];
    const series: { [metric: string]: number[] } = {};
    
    let currentTimestamp = "";
    let currentTimestampIndex = -1;
    let threadPoolHeaders: string[] = [];
    let messageTypeHeaders: string[] = [];
    let metersHeaders: string[] = [];
    
    // Track which section we're in
    enum Section {
      None,
      ThreadPool,
      MessageType,
      Meters
    }
    let currentSection = Section.None;
    
    // Valid task types for thread pools
    const VALID_THREAD_TASKS = [
      "Active", "Pending", "Backpressure", "Delayed", 
      "Shared", "Stolen", "Completed", "Blocked", "All time blocked"
    ];
    
    // First pass: collect all timestamps
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Match timestamp lines (format: 2025-02-27T13:24:23+0100)
      if (line.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
        if (!timestamps.includes(line)) {
          timestamps.push(line);
        }
      }
    }
    
    console.log(`Found ${timestamps.length} timestamps`);
    
    // Second pass: process data by section
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Match timestamp line
      if (line.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
        currentTimestamp = line;
        currentTimestampIndex = timestamps.indexOf(currentTimestamp);
        console.log(`Processing timestamp: ${currentTimestamp} (index ${currentTimestampIndex})`);
        
        // Reset section at each new timestamp
        currentSection = Section.None;
        continue;
      }
      
      // Mark the start of a section after a timestamp
      if (line === "==========") {
        // Next line should be a header
        continue;
      }
      
      // Detect Thread Pool section (look for "Pools" header)
      if ((line.includes("Pools") || line.includes("Pool Name") || line.includes("PoolName")) && 
          line.includes("Active")) {
        threadPoolHeaders = line.split(/\s+/).filter(Boolean);
        console.log("Found Thread Pool headers:", threadPoolHeaders);
        currentSection = Section.ThreadPool;
        continue;
      }
      
      // Detect Message Types section (look for "Messages" header)
      if ((line.includes("Messages") && line.includes("Dropped") && 
           (line.includes("Latency") || (i + 1 < lines.length && lines[i + 1].trim().includes("50%")))) || 
          (line.includes("Message type") && line.includes("Dropped"))) {
        
        // Handle both formats - older "Message type" and newer "Messages" format
        if (line.includes("Message type")) {
          messageTypeHeaders = line.split(/\s+/).filter(Boolean);
        } else {
          // This is the newer format (might span two lines)
          messageTypeHeaders = ["Message Type", "Dropped"];
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1].trim();
            if (nextLine.includes("50%")) {
              // Add percentile headers
              const percentileHeaders = nextLine.split(/\s+/).filter(Boolean);
              messageTypeHeaders.push(...percentileHeaders);
              i++; // Skip next line since we've processed it
            }
          }
        }
        
        console.log("Found Message Type headers:", messageTypeHeaders);
        currentSection = Section.MessageType;
        continue;
      }
      
      // Detect Meters section (look for "Meters" header)
      if (line.includes("Meters") && (line.includes("Rate") || line.includes("Count"))) {
        metersHeaders = line.split(/\s+/).filter(Boolean);
        console.log("Found Meters headers:", metersHeaders);
        currentSection = Section.Meters;
        continue;
      }
      
      // Process Thread Pool data
      if (currentSection === Section.ThreadPool && 
          threadPoolHeaders.length > 0 && 
          currentTimestampIndex !== -1 && 
          !line.includes("Pools") && 
          !line.includes("Pool Name") &&
          !line.includes("PoolName") &&
          !line.includes("Message") &&
          !line.includes("Meters") &&
          !/^[\s=]*$/.test(line)) {
        
        try {
          // Split line by whitespace
          const parts = line.split(/\s+/).filter(Boolean);
          
          // Need enough parts to be a valid data row
          if (parts.length < 2) continue;
          
          // Find where numeric values start
          const numericStartIndex = findNumericStartIndex(parts, threadPoolHeaders);
          if (numericStartIndex === -1) continue;
          
          const poolName = parts.slice(0, numericStartIndex).join(" ");
          const numericValues = parts.slice(numericStartIndex);
          
          // Process each thread pool metric
          for (let j = 0; j < numericValues.length && j + numericStartIndex < threadPoolHeaders.length; j++) {
            const columnName = threadPoolHeaders[j + numericStartIndex]; // Skip pool name column
            
            // Skip if not a valid task type
            if (!VALID_THREAD_TASKS.includes(columnName)) continue;
            
            const value = numericValues[j];
            
            // Skip N/A values
            if (value === "N/A") continue;
            
            // Parse the numeric value, handling commas
            const numValue = parseFloat(value.replace(/,/g, ""));
            if (isNaN(numValue)) continue;
            
            // Create both naming formats for backward compatibility
            // Original format: "ThreadPool | Task"
            const originalMetricName = `${poolName} | ${columnName}`;
            // New format: "Pool | ThreadPool | Task"
            const newMetricName = `Pool | ${poolName} | ${columnName}`;
            
            // Initialize series with NaN values if it doesn't exist
            if (!series[originalMetricName]) {
              series[originalMetricName] = Array(timestamps.length).fill(NaN);
            }
            
            // Store the value at the current timestamp index in the original format
            series[originalMetricName][currentTimestampIndex] = numValue;
            
            // Also store in the new format for future compatibility
            if (!series[newMetricName]) {
              series[newMetricName] = Array(timestamps.length).fill(NaN);
            }
            series[newMetricName][currentTimestampIndex] = numValue;
          }
        } catch (error) {
          console.warn(`Error processing Thread Pool line: ${line}`, error);
        }
      }
      
      // Process Message Type data
      else if (currentSection === Section.MessageType && 
               messageTypeHeaders.length > 0 && 
               currentTimestampIndex !== -1 &&
               !/^[\s=]*$/.test(line) &&
               !line.includes("Messages") &&
               !line.includes("Message type") &&
               !line.includes("Latency waiting")) {
        
        try {
          // Split line by whitespace
          const parts = line.split(/\s+/).filter(Boolean);
          
          // Need at least message type and dropped value
          if (parts.length < 2) continue;
          
          // Message type is typically the first column, 
          // and Dropped (which we want) is the second column
          const messageType = parts[0];
          
          // Skip if blank or header-like
          if (!messageType || messageType === "Message" || messageType === "type") continue;
          
          // Get the Dropped value (should be second column)
          if (parts.length >= 2) {
            const droppedValue = parts[1];
            
            // Skip N/A values
            if (droppedValue === "N/A") continue;
            
            // Parse the numeric value
            const numValue = parseFloat(droppedValue.replace(/,/g, ""));
            if (isNaN(numValue)) continue;
            
            // Create both metric name formats for compatibility
            // Original format: "Message Type | TYPE | Dropped"
            const originalMetricName = `Message Type | ${messageType} | Dropped`;
            // New format: "Message | TYPE | Dropped"
            const newMetricName = `Message | ${messageType} | Dropped`;
            
            // Initialize and store in both formats
            if (!series[originalMetricName]) {
              series[originalMetricName] = Array(timestamps.length).fill(NaN);
            }
            series[originalMetricName][currentTimestampIndex] = numValue;
            
            if (!series[newMetricName]) {
              series[newMetricName] = Array(timestamps.length).fill(NaN);
            }
            series[newMetricName][currentTimestampIndex] = numValue;
            
            // Now process latency percentiles if available
            // Start from index 2 which would be the 50% value
            for (let j = 2; j < parts.length && j < messageTypeHeaders.length; j++) {
              const percentile = messageTypeHeaders[j]; // e.g., "50%"
              const percentileValue = parts[j];
              
              // Skip N/A values
              if (percentileValue === "N/A") continue;
              
              // Parse the numeric value
              const numPercentileValue = parseFloat(percentileValue.replace(/,/g, ""));
              if (isNaN(numPercentileValue)) continue;
              
              // Create metric name for latency percentile
              const latencyMetricName = `Message | ${messageType} | Latency | ${percentile}`;
              
              // Initialize series with NaN values if it doesn't exist
              if (!series[latencyMetricName]) {
                series[latencyMetricName] = Array(timestamps.length).fill(NaN);
              }
              
              // Store the value at the current timestamp index
              series[latencyMetricName][currentTimestampIndex] = numPercentileValue;
            }
          }
        } catch (error) {
          console.warn(`Error processing Message Type line: ${line}`, error);
        }
      }
      
      // Process Meters data
      else if (currentSection === Section.Meters && 
               metersHeaders.length > 0 && 
               currentTimestampIndex !== -1 &&
               !/^[\s=]*$/.test(line) &&
               !line.includes("Meters")) {
        
        try {
          // Split line by whitespace
          const parts = line.split(/\s+/).filter(Boolean);
          
          // Need at least meter name and one value
          if (parts.length < 2) continue;
          
          // Find where numeric values start
          // For meters, the first column is usually the meter name
          const meterName = parts[0];
          if (parts.length > 1) {
            const secondPart = parts[1];
            // If second part doesn't start with a number, it's part of the meter name
            if (!/^-?\d+\.?\d*$/.test(secondPart) && secondPart !== "N/A") {
              // Combine parts until we find a number
              let meterParts = [meterName];
              let numericStartIdx = 1;
              while (numericStartIdx < parts.length) {
                if (/^-?\d+\.?\d*$/.test(parts[numericStartIdx]) || parts[numericStartIdx] === "N/A") {
                  break;
                }
                meterParts.push(parts[numericStartIdx]);
                numericStartIdx++;
              }
              const fullMeterName = meterParts.join(" ");
              
              // Process each metric type for this meter
              for (let j = 0; j < metersHeaders.length - 1 && numericStartIdx + j < parts.length; j++) {
                const metricType = metersHeaders[j + 1]; // Skip the "Meters" header
                const value = parts[numericStartIdx + j];
                
                // Skip N/A values
                if (value === "N/A") continue;
                
                // Parse the numeric value
                const numValue = parseFloat(value.replace(/,/g, ""));
                if (isNaN(numValue)) continue;
                
                // Create metric name: "Meter | METER_NAME | METRIC_TYPE"
                const metricName = `Meter | ${fullMeterName} | ${metricType}`;
                
                // Initialize series with NaN values if it doesn't exist
                if (!series[metricName]) {
                  series[metricName] = Array(timestamps.length).fill(NaN);
                }
                
                // Store the value at the current timestamp index
                series[metricName][currentTimestampIndex] = numValue;
              }
            } else {
              // Single word meter name, process normally
              for (let j = 0; j < metersHeaders.length - 1 && j + 1 < parts.length; j++) {
                const metricType = metersHeaders[j + 1]; // Skip the "Meters" header
                const value = parts[j + 1];
                
                // Skip N/A values
                if (value === "N/A") continue;
                
                // Parse the numeric value
                const numValue = parseFloat(value.replace(/,/g, ""));
                if (isNaN(numValue)) continue;
                
                // Create metric name: "Meter | METER_NAME | METRIC_TYPE"
                const metricName = `Meter | ${meterName} | ${metricType}`;
                
                // Initialize series with NaN values if it doesn't exist
                if (!series[metricName]) {
                  series[metricName] = Array(timestamps.length).fill(NaN);
                }
                
                // Store the value at the current timestamp index
                series[metricName][currentTimestampIndex] = numValue;
              }
            }
          }
        } catch (error) {
          console.warn(`Error processing Meters line: ${line}`, error);
        }
      }
      
      // Check if we're leaving the current section (hit next section marker)
      if (line.startsWith("Pools") || line.startsWith("Meters") || line.startsWith("Messages") || line.match(/^\d{4}-\d{2}-\d{2}/)) {
        currentSection = Section.None;
      }
    }
    
    // Check if we extracted any data
    const metricCount = Object.keys(series).length;
    console.log(`Extracted ${metricCount} unique metrics across ${timestamps.length} timestamps`);
    
    // Split metrics by type for logging purposes
    const threadPoolMetricsOld = Object.keys(series).filter(m => !m.startsWith("Message Type") && !m.startsWith("Pool |") && !m.startsWith("Meter |") && !m.startsWith("Message |"));
    const messageTypeMetricsOld = Object.keys(series).filter(m => m.startsWith("Message Type"));
    const threadPoolMetricsNew = Object.keys(series).filter(m => m.startsWith("Pool |"));
    const messageTypeMetricsNew = Object.keys(series).filter(m => m.startsWith("Message |"));
    const metersMetrics = Object.keys(series).filter(m => m.startsWith("Meter |"));
    
    console.log(`Found ${threadPoolMetricsOld.length} old-format Thread Pool metrics`);
    console.log(`Found ${messageTypeMetricsOld.length} old-format Message Type metrics`);
    console.log(`Found ${threadPoolMetricsNew.length} new-format Thread Pool metrics`);
    console.log(`Found ${messageTypeMetricsNew.length} new-format Message Type metrics`);
    console.log(`Found ${metersMetrics.length} Meters metrics`);
    
    if (metricCount > 0) {
      // Log sample data to verify
      if (threadPoolMetricsOld.length > 0) {
        console.log(`Sample old-format Thread Pool metric: ${threadPoolMetricsOld[0]}`);
      }
      
      if (threadPoolMetricsNew.length > 0) {
        console.log(`Sample new-format Thread Pool metric: ${threadPoolMetricsNew[0]}`);
      }
      
      if (messageTypeMetricsOld.length > 0) {
        console.log(`Sample old-format Message Type metric: ${messageTypeMetricsOld[0]}`);
      }
      
      if (messageTypeMetricsNew.length > 0) {
        console.log(`Sample new-format Message Type metric: ${messageTypeMetricsNew[0]}`);
      }
      
      if (metersMetrics.length > 0) {
        console.log(`Sample Meters metric: ${metersMetrics[0]}`);
      }
      
      // Count non-NaN values to check data density
      const sampleMetric = Object.keys(series)[0];
      const nonNanCount = series[sampleMetric].filter(v => !isNaN(v)).length;
      console.log(`Sample metric has ${nonNanCount}/${timestamps.length} valid data points`);
      
      // Return the parsed data
      return { timestamps, series };
    } else {
      // If no metrics were found, create a dummy metric to avoid an error
      console.error("No metrics found! Creating a dummy metric to avoid failure");
      series["No data found | Value"] = Array(timestamps.length).fill(0);
      timestamps[0] = timestamps[0] || "No timestamps found";
      
      return { timestamps, series };
    }
  } catch (error) {
    // Catch-all error handler
    console.error("Fatal error in tpstats parser:", error);
    
    // Return a minimal valid result so the app doesn't crash
    return { 
      timestamps: ["Error parsing data"], 
      series: { "Error | Value": [0] } 
    };
  }
}
