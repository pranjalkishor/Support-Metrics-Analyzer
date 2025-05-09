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

// Helper function to normalize header names
function normalizeHeaderName(header: string): string {
  // Convert variations of header names to standard format
  const lowerHeader = header.toLowerCase().trim();
  
  if (lowerHeader === 'alltimeblocked' || 
      lowerHeader === 'all-time-blocked' || 
      lowerHeader === 'all_time_blocked' || 
      lowerHeader === 'alltime' || 
      lowerHeader === 'all-time' || 
      lowerHeader === 'all_time' || 
      lowerHeader === 'all time' || 
      lowerHeader === 'atblocked' || 
      lowerHeader === 'atb' ||
      lowerHeader === 'all time blocked') {
    return 'All time blocked';
  }
  
  if (lowerHeader === 'active') return 'Active';
  if (lowerHeader === 'pending') return 'Pending';
  if (lowerHeader === 'completed') return 'Completed';
  if (lowerHeader === 'blocked') return 'Blocked';
  if (lowerHeader === 'backpressure') return 'Backpressure';
  if (lowerHeader === 'delayed') return 'Delayed';
  if (lowerHeader === 'shared') return 'Shared';
  if (lowerHeader === 'stolen') return 'Stolen';
  
  return header; // Return original if no match
}

// For diagnostic purposes
function logHeaderMismatches(headers: string[], validTasks: string[]) {
  const normalizedHeaders = headers.map(h => normalizeHeaderName(h));
  
  // Check which valid task types are missing
  const missingTasks = validTasks
    .filter(task => !normalizedHeaders.includes(normalizeHeaderName(task)))
    .map(task => normalizeHeaderName(task));
  
  if (missingTasks.length > 0) {
    console.warn(`Missing task types in headers: ${missingTasks.join(', ')}`);
  }
  
  // Log mapping for debugging
  console.log("Header normalization map:");
  headers.forEach(h => {
    console.log(`  "${h}" -> "${normalizeHeaderName(h)}"`);
  });
}

// Helper function to process thread pool data
function processThreadPoolLine(line: string, threadPoolHeaders: string[], currentTimestampIndex: number, timestamps: string[], series: { [metric: string]: number[] }) {
  try {
    // Get the expected columns order from the headers
    const columnHeaders = threadPoolHeaders.slice(1); // Skip "Pool Name"
    
    // Split line by whitespace, preserving spaces for alignment
    const parts = line.split(/\s+/);
    
    // Remove empty entries that might appear at the beginning due to spacing
    while (parts.length > 0 && parts[0] === '') {
      parts.shift();
    }
    
    // If not enough parts, skip
    if (parts.length <= columnHeaders.length) {
      console.warn(`Skipping line with insufficient columns: ${line}`);
      return;
    }
    
    // Now we need to determine where the pool name ends and numeric values begin
    let numericStartIdx = -1;
    for (let i = 0; i < parts.length; i++) {
      // Check if this part looks like a number or N/A
      if (parts[i] === 'N/A' || /^-?\d+(\.\d+)?$/.test(parts[i].replace(/,/g, ''))) {
        numericStartIdx = i;
        break;
      }
    }
    
    if (numericStartIdx === -1 || numericStartIdx === 0) {
      console.warn(`Could not find numeric values in line: ${line}`);
      return;
    }
    
    // Pool name is everything before numeric values
    const poolName = parts.slice(0, numericStartIdx).join(' ').trim();
    
    // Numeric values are everything after pool name, aligning with headers
    const numericValues = parts.slice(numericStartIdx);
    
    console.log(`Processed pool '${poolName}' with ${numericValues.length} values`);
    
    // Make sure we have values to process
    if (numericValues.length === 0) {
      console.warn(`No numeric values found for pool ${poolName}`);
      return;
    }
    
    // Each task type corresponds to a position in the numericValues array
    // The expected order based on columnHeaders
    const taskToPositionMap: { [task: string]: number } = {};
    
    // Map each column header to its position
    for (let i = 0; i < columnHeaders.length; i++) {
      const normalizedHeader = normalizeHeaderName(columnHeaders[i]);
      taskToPositionMap[normalizedHeader] = i;
    }
    
    // Log the mapping for debugging
    console.log(`Column mapping for ${poolName}:`, taskToPositionMap);
    
    // The important task types we want to extract
    const importantTasks = ["Active", "Pending", "Completed", "Blocked", "All time blocked"];
    
    // Process each task type that we care about
    for (const taskType of importantTasks) {
      const normalizedTask = normalizeHeaderName(taskType);
      const position = taskToPositionMap[normalizedTask];
      
      // Skip if this task type isn't found in the headers
      if (position === undefined) {
        console.log(`Task type ${normalizedTask} not found in headers`);
        continue;
      }
      
      // Skip if position is out of range
      if (position >= numericValues.length) {
        console.log(`Position ${position} out of range for ${poolName} (max: ${numericValues.length-1})`);
        continue;
      }
      
      const value = numericValues[position];
      
      // Skip N/A values or empty values
      if (value === "N/A" || value === "") continue;
      
      // Parse the numeric value, handling commas
      const numValue = parseFloat(value.replace(/,/g, ""));
      if (isNaN(numValue)) {
        console.log(`Skipping non-numeric value: ${value} for ${normalizedTask}`);
        continue;
      }
      
      // Original format: "ThreadPool | Task" (important for backward compatibility)
      const originalMetricName = `${poolName} | ${normalizedTask}`;
      
      // New format: "Pool | ThreadPool | Task"
      const newMetricName = `Pool | ${poolName} | ${normalizedTask}`;
      
      console.log(`Adding metric: ${newMetricName} = ${numValue}`);
      
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
    
    // Valid task types for thread pools - expanded to capture variations in naming
    const VALID_THREAD_TASKS = [
      "Active", "Pending", "Backpressure", "Delayed", 
      "Shared", "Stolen", "Completed", "Blocked", "All time blocked",
      "AllTimeBlocked", "All-time-blocked", "All_time_blocked",
      "AllTime", "All-Time", "All_Time", "ATBlocked", "ATB"
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
    
    // Debug: Print every line encountered to help identify parsing issues
    console.log(`Total lines in file: ${lines.length}`);
    
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
      if (((line.includes("Pool") || line.includes("Pools")) && 
           line.includes("Active") && line.includes("Pending") && 
           line.includes("Completed") && line.includes("Blocked")) ||
          ((line.includes("PoolName") || line.includes("Pool Name")) && 
           line.toLowerCase().includes("active"))) {
        
        // Original line with all whitespace preserved for position analysis
        const rawHeaderLine = lines[i];
        console.log("Found thread pool header raw line:", JSON.stringify(rawHeaderLine));
        
        // Define the exact column names we're looking for
        const COLUMN_NAMES = ["Pool Name", "Active", "Pending", "Completed", "Blocked", "All time blocked"];
        
        // Find positions of each column in the header line
        let columnPositions: { [column: string]: { start: number, width: number } } = {};
        
        // First, find Pool Name position (always starts at beginning)
        columnPositions["Pool Name"] = { start: 0, width: 0 };
        
        // Find Active position
        const activeIdx = rawHeaderLine.indexOf("Active");
        if (activeIdx > 0) {
          columnPositions["Pool Name"].width = activeIdx;
          columnPositions["Active"] = { start: activeIdx, width: 0 };
        }
        
        // Find Pending position
        const pendingIdx = rawHeaderLine.indexOf("Pending");
        if (pendingIdx > 0) {
          columnPositions["Active"].width = pendingIdx - columnPositions["Active"].start;
          columnPositions["Pending"] = { start: pendingIdx, width: 0 };
        }
        
        // Find Completed position
        const completedIdx = rawHeaderLine.indexOf("Completed");
        if (completedIdx > 0) {
          columnPositions["Pending"].width = completedIdx - columnPositions["Pending"].start;
          columnPositions["Completed"] = { start: completedIdx, width: 0 };
        }
        
        // Find Blocked position
        const blockedIdx = rawHeaderLine.indexOf("Blocked");
        if (blockedIdx > 0) {
          columnPositions["Completed"].width = blockedIdx - columnPositions["Completed"].start;
          columnPositions["Blocked"] = { start: blockedIdx, width: 0 };
        }
        
        // Find All time blocked position (special care for spaces)
        const allTimeBlockedIdx = rawHeaderLine.indexOf("All time blocked");
        if (allTimeBlockedIdx > 0) {
          columnPositions["Blocked"].width = allTimeBlockedIdx - columnPositions["Blocked"].start;
          columnPositions["All time blocked"] = { 
            start: allTimeBlockedIdx, 
            width: rawHeaderLine.length - allTimeBlockedIdx
          };
        }
        
        // Log detected positions
        console.log("Column positions:", JSON.stringify(columnPositions));
        
        // Save all detected column names for task dropdown
        threadPoolHeaders = Object.keys(columnPositions);
        console.log("Thread pool headers:", threadPoolHeaders);
        
        currentSection = Section.ThreadPool;
        console.log("Entering Thread Pool section at line:", i + 1);
        
        // Process thread pool data rows until we reach another section marker
        for (let j = i + 1; j < lines.length; j++) {
          // Use the raw line to maintain positions
          const rawDataLine = lines[j];
          const dataLine = rawDataLine.trim();
          
          // Skip empty lines
          if (!dataLine) continue;
          
          // Check if we've reached another section or timestamp
          if (dataLine.startsWith("Pools") || 
              dataLine.startsWith("Meters") || 
              dataLine.startsWith("Messages") || 
              dataLine.match(/^\d{4}-\d{2}-\d{2}/) ||
              dataLine === "==========") {
            console.log("Exiting thread pool section at line:", j + 1);
            i = j - 1; // Move the outer loop to this position (minus 1 because it will increment)
            break;
          }
          
          try {
            // If this looks like a header line, skip it
            if (dataLine.toLowerCase().includes("pool") && dataLine.toLowerCase().includes("name")) {
              console.log("Skipping header line:", dataLine);
              continue;
            }
            
            console.log("Processing thread pool data line:", JSON.stringify(rawDataLine));
            
            // For each column, extract the value at its position
            for (const column of Object.keys(columnPositions)) {
              // Skip Pool Name column when processing values
              if (column === "Pool Name") continue;
              
              // Get column position info
              const { start, width } = columnPositions[column];
              
              // Make sure we don't go out of bounds
              if (start >= rawDataLine.length) {
                console.log(`Column position ${start} out of range for line length ${rawDataLine.length}`);
                continue;
              }
              
              // Extract substring at column position with appropriate width
              const value = rawDataLine.substring(start, start + width).trim();
              console.log(`Extracted raw value for ${column}: "${value}"`);
              
              // Skip if no value or N/A
              if (!value || value === "N/A") continue;
              
              // Parse the value
              let numValue: number;
              try {
                numValue = parseFloat(value.replace(/,/g, ""));
                if (isNaN(numValue)) {
                  console.log(`Failed to parse value for ${column}: "${value}"`);
                  continue;
                }
              } catch (e) {
                console.log(`Error parsing value for ${column}: "${value}"`, e);
                continue;
              }
              
              // Extract the pool name from the beginning of the line up to Active column
              const poolName = rawDataLine.substring(0, columnPositions["Active"].start).trim();
              
              // Skip if empty pool name
              if (!poolName) {
                console.log(`Empty pool name in line: ${rawDataLine}`);
                continue;
              }
              
              // Normalize column name as task type
              const taskType = normalizeHeaderName(column);
              
              // Create metric names
              const originalMetricName = `${poolName} | ${taskType}`;
              const newMetricName = `Pool | ${poolName} | ${taskType}`;
              
              console.log(`Adding thread pool metric: ${newMetricName} = ${numValue}`);
              
              // Initialize series arrays if needed
              if (!series[originalMetricName]) {
                series[originalMetricName] = Array(timestamps.length).fill(NaN);
              }
              
              if (!series[newMetricName]) {
                series[newMetricName] = Array(timestamps.length).fill(NaN);
              }
              
              // Store values at current timestamp
              series[originalMetricName][currentTimestampIndex] = numValue;
              series[newMetricName][currentTimestampIndex] = numValue;
            }
          } catch (error) {
            console.warn(`Error processing thread pool line: ${dataLine}`, error);
          }
        }
        
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
        console.log("Entering Message Type section at line:", i + 1);
        
        // Loop forward to process Message Type data
        for (let j = i + 1; j < lines.length; j++) {
          const dataLine = lines[j].trim();
          
          // Skip empty lines
          if (!dataLine) continue;
          
          // Check if we've reached another section or timestamp
          if (dataLine.startsWith("Pools") || 
              dataLine.startsWith("Meters") || 
              dataLine.startsWith("Messages") || 
              dataLine.match(/^\d{4}-\d{2}-\d{2}/) ||
              dataLine === "==========") {
            console.log("Exiting message type section at line:", j + 1);
            i = j - 1; // Move the outer loop to this position (minus 1 because it will increment)
            break;
          }
          
          try {
            // If header line or latency waiting line, skip
            if (dataLine.includes("Messages") || 
                dataLine.includes("Message type") || 
                dataLine.includes("Latency waiting")) {
              continue;
            }
            
            // Split line by whitespace
            const parts = dataLine.split(/\s+/).filter(Boolean);
            
            // Need at least message type and dropped value
            if (parts.length < 2) continue;
            
            // For debug output
            console.log(`Processing message type line: ${dataLine}`);
            console.log(`Split into parts: ${parts.join(" | ")}`);
            
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
              if (isNaN(numValue)) {
                console.log(`Skipping non-numeric dropped value: ${droppedValue} for ${messageType}`);
                continue;
              }
              
              // Create both metric name formats for compatibility
              // Original format: "Message Type | TYPE | Dropped"
              const originalMetricName = `Message Type | ${messageType} | Dropped`;
              // New format: "Message | TYPE | Dropped"
              const newMetricName = `Message | ${messageType} | Dropped`;
              
              console.log(`Adding message metric: ${newMetricName} = ${numValue}`);
              
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
              for (let k = 2; k < parts.length && k < messageTypeHeaders.length; k++) {
                const percentile = messageTypeHeaders[k]; // e.g., "50%"
                const percentileValue = parts[k];
                
                // Skip N/A values
                if (percentileValue === "N/A") continue;
                
                // Parse the numeric value
                const numPercentileValue = parseFloat(percentileValue.replace(/,/g, ""));
                if (isNaN(numPercentileValue)) {
                  console.log(`Skipping non-numeric percentile value: ${percentileValue} for ${messageType} at ${percentile}`);
                  continue;
                }
                
                // Create metric name for latency percentile
                const latencyMetricName = `Message | ${messageType} | Latency | ${percentile}`;
                
                console.log(`Adding latency metric: ${latencyMetricName} = ${numPercentileValue}`);
                
                // Initialize series with NaN values if it doesn't exist
                if (!series[latencyMetricName]) {
                  series[latencyMetricName] = Array(timestamps.length).fill(NaN);
                }
                
                // Store the value at the current timestamp index
                series[latencyMetricName][currentTimestampIndex] = numPercentileValue;
              }
            }
          } catch (error) {
            console.warn(`Error processing Message Type line: ${dataLine}`, error);
          }
        }
        
        continue;
      }
      
      // Detect Meters section (look for "Meters" header)
      if (line.includes("Meters") && 
          (line.includes("Rate") || line.includes("Count") || line.includes("1-min") || 
           line.includes("5-min") || line.includes("15-min"))) {
        
        metersHeaders = line.split(/\s+/).filter(Boolean);
        console.log("Found Meters headers:", metersHeaders);
        currentSection = Section.Meters;
        console.log("Entering Meters section at line:", i + 1);
        
        // Process Meters data
        for (let j = i + 1; j < lines.length; j++) {
          const dataLine = lines[j].trim();
          
          // Skip empty lines
          if (!dataLine) continue;
          
          // Check if we've reached another section or timestamp
          if (dataLine.startsWith("Pools") || 
              dataLine.startsWith("Meters") || 
              dataLine.startsWith("Messages") || 
              dataLine.match(/^\d{4}-\d{2}-\d{2}/) ||
              dataLine === "==========") {
            console.log("Exiting meters section at line:", j + 1);
            i = j - 1; // Move the outer loop to this position (minus 1 because it will increment)
            break;
          }
          
          try {
            console.log(`Processing meters line: "${dataLine}"`);
            
            // Skip header line
            if (dataLine.includes("Meters")) continue;
            
            // Split the line by whitespace
            const parts = dataLine.split(/\s+/).filter(Boolean);
            
            // Need at least a meter name and one value
            if (parts.length < 2) {
              console.log(`Skipping meters line - insufficient parts: ${dataLine}`);
              continue;
            }
            
            // Find where numeric values start
            let numericStartIdx = -1;
            let meterName = "";
            
            // Check each part to find where the numbers begin
            for (let k = 0; k < parts.length; k++) {
              const part = parts[k];
              // If this part looks like a number or N/A, this is where values start
              if (part === "N/A" || /^-?\d+(\.\d+)?$/.test(part.replace(/,/g, ""))) {
                numericStartIdx = k;
                meterName = parts.slice(0, k).join(" ");
                break;
              }
            }
            
            // If we couldn't find where values start, skip this line
            if (numericStartIdx === -1 || meterName === "") {
              console.log(`Could not locate numeric values in meter line: ${dataLine}`);
              continue;
            }
            
            console.log(`Found meter "${meterName}" with values starting at position ${numericStartIdx}`);
            
            // Get the numeric values 
            const values = parts.slice(numericStartIdx);
            
            // Skip if no values
            if (values.length === 0) continue;
            
            // Get the metric headers (skip the "Meters" header)
            const metricHeaders = metersHeaders.slice(1);
            
            // Process each value with its corresponding header
            for (let k = 0; k < values.length && k < metricHeaders.length; k++) {
              const metricType = metricHeaders[k];
              const value = values[k];
              
              // Skip N/A values
              if (value === "N/A") continue;
              
              // Parse the numeric value
              const numValue = parseFloat(value.replace(/,/g, ""));
              if (isNaN(numValue)) continue;
              
              // Create metric name in the format: "Meter | METER_NAME | METRIC_TYPE"
              const metricName = `Meter | ${meterName} | ${metricType}`;
              
              console.log(`Adding meter metric: ${metricName} = ${numValue}`);
              
              // Initialize series if it doesn't exist
              if (!series[metricName]) {
                series[metricName] = Array(timestamps.length).fill(NaN);
              }
              
              // Store the value
              series[metricName][currentTimestampIndex] = numValue;
            }
          } catch (error) {
            console.warn(`Error processing Meters line: ${dataLine}`, error);
          }
        }
        
        continue;
      }
    }
    
    // Check if we extracted any data
    const metricCount = Object.keys(series).length;
    console.log(`Extracted ${metricCount} unique metrics across ${timestamps.length} timestamps`);
    
    // Split metrics by type for logging purposes
    const threadPoolMetricsOld = Object.keys(series).filter(m => !m.startsWith("Message Type") && !m.startsWith("Pool |") && !m.startsWith("Meter |") && !m.startsWith("Message |"));
    const messageTypeMetricsOld = Object.keys(series).filter(m => m.startsWith("Message Type"));
    const threadPoolMetricsNew = Object.keys(series).filter(m => m.startsWith("Pool |"));
    const messageTypeMetricsNew = Object.keys(series).filter(m => m.startsWith("Message |") && !m.includes("Latency"));
    const latencyMetrics = Object.keys(series).filter(m => m.includes("Latency"));
    const metersMetrics = Object.keys(series).filter(m => m.startsWith("Meter |"));
    
    // Extract unique thread pool names for debugging
    const threadPoolNames = new Set<string>();
    threadPoolMetricsOld.forEach(m => {
      const parts = m.split(" | ");
      if (parts.length >= 1) {
        threadPoolNames.add(parts[0]);
      }
    });
    
    // Extract unique task types for debugging
    const taskTypes = new Set<string>();
    threadPoolMetricsOld.forEach(m => {
      const parts = m.split(" | ");
      if (parts.length >= 2) {
        taskTypes.add(parts[1]);
      }
    });
    
    console.log(`Found ${threadPoolNames.size} unique thread pool names:`, Array.from(threadPoolNames).join(", "));
    console.log(`Found ${taskTypes.size} unique task types:`, Array.from(taskTypes).join(", "));
    console.log(`Found ${threadPoolMetricsOld.length} old-format Thread Pool metrics`);
    console.log(`Found ${messageTypeMetricsOld.length} old-format Message Type metrics`);
    console.log(`Found ${threadPoolMetricsNew.length} new-format Thread Pool metrics`);
    console.log(`Found ${messageTypeMetricsNew.length} new-format Message Type metrics`);
    console.log(`Found ${latencyMetrics.length} Latency metrics`);
    console.log(`Found ${metersMetrics.length} Meters metrics`);
    
    // Diagnostic: Check for missing task types
    if (threadPoolMetricsNew.length > 0) {
      const poolTaskTypes = new Set<string>();
      threadPoolMetricsNew.forEach(metric => {
        const parts = metric.split(" | ");
        if (parts.length >= 3) {
          poolTaskTypes.add(parts[2]); // Extract the task type
        }
      });
      
      console.log("Detected task types in the data:", Array.from(poolTaskTypes).join(", "));
      
      // Check which valid task types are missing from the data
      const missingTaskTypes = VALID_THREAD_TASKS
        .map(task => normalizeHeaderName(task))
        .filter(task => !Array.from(poolTaskTypes).includes(task));
      
      if (missingTaskTypes.length > 0) {
        console.warn(`Missing task types in the data: ${missingTaskTypes.join(", ")}`);
      }
    }
    
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
      
      if (latencyMetrics.length > 0) {
        console.log(`Sample Latency metric: ${latencyMetrics[0]}`);
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
