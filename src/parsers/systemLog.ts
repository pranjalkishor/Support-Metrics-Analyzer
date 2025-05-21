import { ParsedTimeSeries } from "../types";

/**
 * Parses system.log file to extract GCInspector logs
 */
export function parseGCEvents(logContent: string): ParsedTimeSeries {
  console.log("parseGCEvents: Starting to parse GC events");
  console.log("Sample log content: ", logContent.substring(0, 300));
  
  // Use a more general regex that captures the full line for inspection
  const gcRegex = /INFO\s+\[GCInspector:1\]\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d{3})\s+GCInspector\.java:\d+\s+-\s+(.*)\s+in\s+(\d+)ms/;
  
  // Add a specific regex for G1 GC format from DataStax Enterprise (DSE)
  const dseG1GcRegex = /INFO\s+\[Service Thread\]\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d{3})\s+GCInspector\.java:\d+\s+-\s+G1 Young Generation GC in (\d+)ms/;
  
  // Add a specific regex for G1 Old Generation GC format - more flexible to match various formats
  const dseG1OldGcRegex = /(?:WARN|INFO)\s+\[(?:Service Thread|GCInspector).*?\]\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d{3}).*?(?:G1 Old Generation GC|Old Gen|Full GC).*?in\s+(\d+)ms/i;
  
  // Add a fallback regex in case the first one doesn't match
  const fallbackGcRegex = /\[GCInspector.*?\]\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}).*?in\s+(\d+)ms/;
  
  // Add a more specific fallback regex for G1 Old Generation GC
  const oldGenGcRegex = /\[(?:Service Thread|GCInspector).*?\]\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}).*?(?:Old Generation GC|Old Gen|Full GC).*?in\s+(\d+)ms/i;
  
  // Add even more flexible fallback regexes for different GC log formats
  const fallbackGcRegex2 = /\[GCInspector.*?\].*?(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}).*?(\d+\.\d+)ms/;
  const fallbackGcRegex3 = /GCInspector.*?(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}).*?(\d+)ms/;
  
  // Log the regex patterns for debugging
  console.log("GC regex patterns:", {
    primary: gcRegex.toString(),
    dse: dseG1GcRegex.toString(),
    dseOld: dseG1OldGcRegex.toString(),
    fallback: fallbackGcRegex.toString(),
    oldGen: oldGenGcRegex.toString(),
    fallback2: fallbackGcRegex2.toString(),
    fallback3: fallbackGcRegex3.toString()
  });
  
  const timestamps: string[] = [];
  const series: Record<string, number[]> = {
    "GC Duration (ms)": [],
  };
  
  // Store GC type as a metadata field
  const gcTypes: string[] = [];
  // Store raw GC descriptions for debugging
  const rawDescriptions: string[] = [];
  
  // Split the log file by lines and process each line
  const lines = logContent.split('\n');
  console.log(`parseGCEvents: Processing ${lines.length} lines`);
  
  let matchCount = 0;
  let dseMatchCount = 0;
  let dseOldMatchCount = 0;
  let fallbackMatchCount = 0;
  let youngCount = 0;
  let oldCount = 0;
  let unknownCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // For debugging the first few lines
    if (i < 5) {
      console.log(`Line ${i}: ${line.substring(0, 100)}...`);
    }
    
    // Try extracting the GC information
    let timestamp = "";
    let duration = 0;
    let gcDescription = "";
    let isMatch = false;
    
    // Try the main GCInspector regex first
    const match = line.match(gcRegex);
    if (match) {
      isMatch = true;
      matchCount++;
      let durationStr;
      [, timestamp, gcDescription, durationStr] = match;
      duration = parseInt(durationStr, 10);
      rawDescriptions.push(gcDescription);
    } 
    // Try the DSE G1 GC format
    else if (line.includes("G1 Young Generation GC")) {
      const dseMatch = line.match(dseG1GcRegex);
      if (dseMatch) {
        isMatch = true;
        dseMatchCount++;
        let durationStr;
        [, timestamp, durationStr] = dseMatch;
        duration = parseInt(durationStr, 10);
        gcDescription = "G1 Young Generation GC";
        rawDescriptions.push("DSE: G1 Young Generation GC");
      }
    }
    // Try the DSE G1 Old Generation GC format
    else if (line.includes("G1 Old Generation GC") || line.includes("Old Gen") || line.includes("Full GC")) {
      const dseOldMatch = line.match(dseG1OldGcRegex);
      if (dseOldMatch) {
        isMatch = true;
        dseOldMatchCount++;
        let durationStr;
        [, timestamp, durationStr] = dseOldMatch;
        duration = parseInt(durationStr, 10);
        gcDescription = "G1 Old Generation GC";
        rawDescriptions.push("DSE: G1 Old Generation GC");
      } else {
        // Try with a more lenient regex if the specific one doesn't match
        const oldGenMatch = line.match(oldGenGcRegex);
        if (oldGenMatch) {
          isMatch = true;
          dseOldMatchCount++;
          let durationStr;
          [, timestamp, durationStr] = oldGenMatch;
          duration = parseInt(durationStr, 10);
          gcDescription = "G1 Old Generation GC";
          rawDescriptions.push("Old Gen Fallback: G1 Old Generation GC");
        }
      }
    }
    // If main regex fails, try the fallback and use the whole line for type detection
    else if (line.includes("GCInspector") && (line.includes("ms") || line.includes("GC") || line.includes("garbage collector"))) {
      // Try each fallback regex in sequence
      let fallbackMatch = line.match(fallbackGcRegex);
      if (fallbackMatch) {
        isMatch = true;
        fallbackMatchCount++;
        [, timestamp] = fallbackMatch;
        
        // Extract duration with a specific regex
        const durationMatch = line.match(/in\s+(\d+)ms/);
        if (durationMatch) {
          duration = parseInt(durationMatch[1], 10);
        }
        
        gcDescription = line; // Use the whole line for type detection
        rawDescriptions.push("FALLBACK: " + line.substring(0, 50) + "...");
      }
      else {
        // Try the second fallback regex (decimal milliseconds)
        fallbackMatch = line.match(fallbackGcRegex2);
        if (fallbackMatch) {
          isMatch = true;
          fallbackMatchCount++;
          let durationStr;
          [, timestamp, durationStr] = fallbackMatch;
          duration = Math.round(parseFloat(durationStr) * 100) / 100;
          gcDescription = line;
          rawDescriptions.push("FALLBACK2: " + line.substring(0, 50) + "...");
        }
        else {
          // Try the third fallback regex (most generic)
          fallbackMatch = line.match(fallbackGcRegex3);
          if (fallbackMatch) {
            isMatch = true;
            fallbackMatchCount++;
            let durationStr;
            [, timestamp, durationStr] = fallbackMatch;
            duration = parseInt(durationStr, 10);
            gcDescription = line;
            rawDescriptions.push("FALLBACK3: " + line.substring(0, 50) + "...");
          }
          // Last resort: if it mentions GC, try to extract timestamp and estimate duration
          else if (line.includes("GCInspector") || line.includes("CMS") || line.includes("ParNew")) {
            const timeMatch = line.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
            if (timeMatch) {
              isMatch = true;
              fallbackMatchCount++;
              [, timestamp] = timeMatch;
              // Estimate GC duration as 50ms if we can't extract it
              duration = 50;
              gcDescription = line;
              rawDescriptions.push("FALLBACK4: " + line.substring(0, 50) + "...");
            }
          }
        }
      }
    }
    
    if (isMatch) {
      try {
        // Convert timestamp to a standard format
        const parsedTimestamp = new Date(timestamp.replace(',', '.')).toISOString();
        timestamps.push(parsedTimestamp);
        
        // Store duration value
        series["GC Duration (ms)"].push(duration);
        
        // Determine and store GC type using the entire line for more context
        const lcLine = line.toLowerCase();
        const isYoungGC = 
          lcLine.includes("young generation") || 
          lcLine.includes("young gen") || 
          (lcLine.includes("young") && !lcLine.includes("old"));
        
        const isOldGC = 
          lcLine.includes("old generation") || 
          lcLine.includes("old gen") || 
          lcLine.includes("full gc");
        
        if (isYoungGC) {
          gcTypes.push("young");
          youngCount++;
        } else if (isOldGC) {
          gcTypes.push("old");
          oldCount++;
        } else {
          gcTypes.push("unknown");
          unknownCount++;
          // Log problematic lines for debugging
          if (unknownCount < 5) {
            console.log("Unknown GC type line:", line.substring(0, 100));
          }
        }
      } catch (e) {
        console.warn("Failed to parse GC entry:", e, line.substring(0, 100));
      }
    }
  }
  
  console.log(`parseGCEvents: Found ${matchCount} primary GC events, ${dseMatchCount} young DSE events, ${dseOldMatchCount} old DSE events, and ${fallbackMatchCount} fallback matches`);
  console.log(`GC Types: Young=${youngCount}, Old=${oldCount}, Unknown=${unknownCount}`);
  console.log("First few GC descriptions:", rawDescriptions.slice(0, 3));
  
  return {
    timestamps,
    series,
    metadata: {
      gcTypes,
      rawDescriptions
    }
  };
}

/**
 * Parses system.log for StatusLogger entries
 */
export function parseStatusLoggerEvents(logContent: string): ParsedTimeSeries {
  const statusLoggerRegex = /INFO\s+\[OptionalTasks:1\]\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d{3})\s+StatusLogger\.java/;
  
  const timestamps: string[] = [];
  const series: Record<string, number[]> = {
    "Status Events": []
  };
  
  const lines = logContent.split('\n');
  
  for (const line of lines) {
    const match = line.match(statusLoggerRegex);
    if (match) {
      const [_, timestamp] = match;
      
      // Convert timestamp to a standard format
      const parsedTimestamp = new Date(timestamp.replace(',', '.')).toISOString();
      timestamps.push(parsedTimestamp);
      
      // Just track occurrences
      series["Status Events"].push(1);
    }
  }
  
  return {
    timestamps,
    series
  };
}

/**
 * Parses system.log for detailed thread pool metrics from StatusLogger
 */
export function parseThreadPoolMetrics(logContent: string): ParsedTimeSeries {
  console.log("Starting StatusLogger thread pool metrics parser");
  
  const timestamps: string[] = [];
  const series: Record<string, number[]> = {};
  const threadPools: string[] = [];
  
  // Define the metrics we want to track
  const metricsToTrack = ["Active", "Pending", "Completed", "Blocked", "All Time Blocked"];
  const allMetricsToTrack = [
    ...metricsToTrack,
    "Backpressure", "Delayed", "Shared", "Stolen", // Additional metrics from newer versions
  ];
  
  // Store StatusLogger lines for debugging
  const statusLines: string[] = [];
  
  // Initialize variables for multi-line format tracking
  let isNewFormatSection = false;
  let pendingMetrics: Record<string, Record<string, number>> = {};
  let currentTimestamp = "";
  let inThreadPoolSection = false;
  let headerColumns: string[] = [];
  
  // Split the log file by lines for processing
  const lines = logContent.split('\n');
  console.log(`parseThreadPoolMetrics: Processing ${lines.length} lines`);
  
  // Detect StatusLogger entries
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Check for timestamp in line
    const timestampMatch = line.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d{3})/);
    if (timestampMatch) {
      currentTimestamp = timestampMatch[1];
    }
    
    // Special handling for StatusLogger.java:174 format (DSE specific)
    if (line.includes("StatusLogger.java:174") || line.includes("StatusLogger.java:137")) {
      statusLines.push(line);
      inThreadPoolSection = false; // Reset this flag for the new section
      
      // Search for header line with "Pool Name" which contains column headers
      if (line.includes("Pool Name")) {
        // Get the header line with column names
        headerColumns = line.substring(line.indexOf("Pool Name")).split(/\s{2,}/);
        inThreadPoolSection = true;
        continue;
      }
      
      // If this is not a header line but we previously found the header,
      // then we're now in the thread pool section
      if (headerColumns.length > 0) {
        inThreadPoolSection = true;
      }
    }
    
    // If we're in a thread pool section after header, process the pool data lines
    if (inThreadPoolSection) {
      // Skip empty or header lines
      if (!line || line.includes("StatusLogger") || line.includes("Pool Name")) {
        continue;
      }
      
      // Check if this is the end of the thread pool section
      if (line.includes("MessagingService") || line.includes("Cache Type") || line.includes("Table")) {
        inThreadPoolSection = false;
        // Process any pending multi-line format metrics
        if (isNewFormatSection && Object.keys(pendingMetrics).length > 0) {
          processMultiLineFormatMetrics(pendingMetrics, currentTimestamp, timestamps, threadPools, series, allMetricsToTrack);
          pendingMetrics = {}; // Clear after processing
        }
        continue;
      }
          
      try {
        // Try to parse the thread pool line
        // Skip lines that are part of other sections
        if (line.includes("Capacity") || line.includes("KeysToSave") || 
            line.includes("Memtable") || line.includes(",")) {
          continue;
        }
        
        // Extract pool name and values for StatusLogger.java:174 format
        // Format: PoolName Active Pending Completed Blocked AllTimeBlocked
        const poolNameMatch = line.match(/^(\S[\S\s]+?)(?:\s{2,}|\t)/);
        if (!poolNameMatch) {
          continue;
        }
        
        const poolName = poolNameMatch[1].trim();
        
        // Skip invalid pool names
        if (!poolName || poolName === "n/a" || poolName.match(/^\d+$/) || 
            poolName.length < 2 || poolName === "Size" || poolName === "N/A") {
          continue;
        }
        
        // Extract all numeric values from the line using regex
        const values = [];
        const valuesRegex = /\b(\d+|N\/A)\b/g;
        let valueMatch;
        
        while ((valueMatch = valuesRegex.exec(line)) !== null) {
          const value = valueMatch[1];
          if (value === "N/A") {
            values.push(0); // Convert N/A to 0
          } else {
            values.push(parseInt(value, 10));
          }
        }
        
        console.log(`Pool: ${poolName}, Found ${values.length} values: ${values.join(', ')}`);
        
        // Convert timestamp to standard format
        const parsedTimestamp = new Date(currentTimestamp.replace(',', '.')).toISOString();
        
        // Add this timestamp if it doesn't exist
        if (!timestamps.includes(parsedTimestamp)) {
          timestamps.push(parsedTimestamp);
          timestamps.sort(); // Keep timestamps in order
        }
        
        // Add the pool name to our list if not already there
        if (!threadPools.includes(poolName)) {
          threadPools.push(poolName);
        }
        
        // Find the index for this timestamp
        const timestampIndex = timestamps.indexOf(parsedTimestamp);
        
        // Full DSE format with 9 columns
        // Format: PoolName Active Pending Backpressure Delayed Shared Stolen Completed Blocked AllTimeBlocked
        const fullFormatColumns = [
          "Active",               // 0
          "Pending",              // 1
          "Backpressure",         // 2 
          "Delayed",              // 3
          "Shared",               // 4
          "Stolen",               // 5
          "Completed",            // 6 - Completed is at position 6 in full format
          "Blocked",              // 7
          "All Time Blocked"      // 8
        ];
        
        // Shorter format with 5 columns (StatusLogger.java:174 in test file)
        const shortFormatColumns = [
          "Active",               // 0
          "Pending",              // 1
          "Completed",            // 2 - Completed is at position 2 in short format
          "Blocked",              // 3
          "All Time Blocked"      // 4
        ];
        
        // Determine which column format to use based on the number of values
        const metricColumns = values.length >= 7 ? fullFormatColumns : shortFormatColumns;
        
        // Map values to appropriate metrics based on their positions
        for (let j = 0; j < Math.min(values.length, metricColumns.length); j++) {
          if (values[j] === undefined) continue;
          
          const metricName = metricColumns[j];
          const seriesKey = `${poolName}: ${metricName}`;
          
          // Create the series if it doesn't exist
          if (!series[seriesKey]) {
            series[seriesKey] = new Array(timestamps.length).fill(0);
          }
          
          // Make sure the series has enough elements
          while (series[seriesKey].length < timestamps.length) {
            series[seriesKey].push(0);
          }
          
          // Update the value
          series[seriesKey][timestampIndex] = values[j];
          
          if (poolName === "CompactionExecutor" && metricName === "Completed") {
            console.log(`CompactionExecutor: Set Completed = ${values[j]} at position ${j} for timestamp ${parsedTimestamp}`);
          }
        }
        
        // For the full format, ensure we correctly map the "Completed" metric which is at position 6
        if (values.length >= 7 && values[6] !== undefined) {
          const completedSeriesKey = `${poolName}: Completed`;
          
          if (!series[completedSeriesKey]) {
            series[completedSeriesKey] = new Array(timestamps.length).fill(0);
          }
          
          // Update the "Completed" value at the correct timestamp
          series[completedSeriesKey][timestampIndex] = values[6];
          
          if (poolName === "CompactionExecutor") {
            console.log(`Special handling for CompactionExecutor: Set Completed = ${values[6]} using full format`);
          }
        }
        
        // Continue to the next line - we're done with this pool entry
        continue;
      } catch (error) {
        console.error("Error parsing thread pool line:", error, line);
      }
    }
  }
  
  // Process any remaining multi-line format metrics at the end of the file
  if (isNewFormatSection && Object.keys(pendingMetrics).length > 0) {
    processMultiLineFormatMetrics(pendingMetrics, currentTimestamp, timestamps, threadPools, series, allMetricsToTrack);
  }
  
  // Add special handling for DSE 5.1 format which appears in system-5.1.log
  if (threadPools.length === 0) {
    console.log("Trying DSE 5.1 format parser...");
    
    const dse51Regex = /INFO\s+\[[^\]]+\]\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d{3})\s+StatusLogger\.java:137\s+-/;
    let dse51Timestamp = "";
    let inDse51Section = false;
    
    // Go through the file line by line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Check for DSE 5.1 StatusLogger header line
      const statusMatch = line.match(dse51Regex);
      if (statusMatch) {
        dse51Timestamp = statusMatch[1];
        
        // Look ahead for "Pool Name" header in the next line
        if (i + 1 < lines.length && lines[i + 1].includes("Pool Name")) {
          inDse51Section = true;
          i++; // Skip the header line
          continue;
        }
      }
      
      // If we're in a DSE 5.1 StatusLogger section
      if (inDse51Section && dse51Timestamp) {
        // End markers for the section
        if (line.startsWith("MessagingService") || 
            line.startsWith("Cache Type") || 
            line.startsWith("Table") ||
            line.length < 10) {
          inDse51Section = false;
          continue;
        }
        
        try {
          // Extract pool name - in DSE 5.1 format, the pool name is left-aligned
          // and followed by multiple spaces before the first metric
          const poolMatch = line.match(/^(\S[\S ]+?)\s{2,}(\d+)\s+/);
          if (!poolMatch) continue;
          
          const poolName = poolMatch[1].trim();
          if (!poolName || poolName.length < 2) continue;
          
          // Extract numeric values - they are nicely space-aligned
          const values: number[] = [];
          const valuesText = line.substring(poolMatch[0].length - poolMatch[2].length);
          const valueMatches = (poolMatch[2] + " " + valuesText).match(/\b\d+\b/g);
          
          if (!valueMatches) continue;
          
          valueMatches.forEach(v => values.push(parseInt(v, 10)));
          
          console.log(`DSE 5.1 format: Found pool ${poolName} with ${values.length} values`);
          
          // Convert timestamp to standard format
          const parsedTimestamp = new Date(dse51Timestamp.replace(',', '.')).toISOString();
          
          // Add this timestamp if it doesn't exist
          if (!timestamps.includes(parsedTimestamp)) {
            timestamps.push(parsedTimestamp);
            timestamps.sort(); // Keep timestamps in order
          }
          
          // Add the pool name to our list if not already there
          if (!threadPools.includes(poolName)) {
            threadPools.push(poolName);
          }
          
          // Find the index for this timestamp
          const timestampIndex = timestamps.indexOf(parsedTimestamp);
          
          // DSE 5.1 format has a fixed column order:
          // Pool Name | Active | Pending | Completed | Blocked | All Time Blocked
          const dse51Metrics = [
            "Active",       // 0
            "Pending",      // 1
            "Completed",    // 2
            "Blocked",      // 3
            "All Time Blocked" // 4
          ];
          
          // Map values to the known metrics
          for (let j = 0; j < Math.min(values.length, dse51Metrics.length); j++) {
            const metricName = dse51Metrics[j];
            const seriesKey = `${poolName}: ${metricName}`;
            
            // Create the series if it doesn't exist
            if (!series[seriesKey]) {
              series[seriesKey] = new Array(timestamps.length).fill(0);
            }
            
            // Make sure the series has enough elements
            while (series[seriesKey].length < timestamps.length) {
              series[seriesKey].push(0);
            }
            
            // Update the value
            series[seriesKey][timestampIndex] = values[j];
            
            if (poolName === "CompactionExecutor" && metricName === "Completed") {
              console.log(`DSE 5.1 format: CompactionExecutor Completed = ${values[j]} at position ${j} for timestamp ${parsedTimestamp}`);
            }
          }
        } catch (error) {
          console.error("Error parsing DSE 5.1 thread pool line:", error, line);
        }
      }
    }
    
    console.log(`DSE 5.1 parser found ${threadPools.length} thread pools`);
    if (threadPools.length > 0) {
      console.log("Sample thread pools:", threadPools.slice(0, 5));
    }
  }
  
  // Add special handling for DSE 6.0 format which appears in system-6.0.log
  if (threadPools.length === 0) {
    console.log("Trying DSE 6.0 format parser...");
    
    const dse60Regex = /INFO\s+\[[^\]]+\]\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d{3})\s+StatusLogger\.java:174\s+-/;
    let dse60Timestamp = "";
    let inDse60Section = false;
    
    // Go through the file line by line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Check for DSE 6.0 StatusLogger header line
      const statusMatch = line.match(dse60Regex);
      if (statusMatch) {
        dse60Timestamp = statusMatch[1];
        
        // Look ahead for "Pool Name" header with "Pending (w/Backpressure)" in the next line
        if (i + 1 < lines.length && lines[i + 1].includes("Pool Name") && lines[i + 1].includes("Backpressure")) {
          inDse60Section = true;
          i++; // Skip the header line
          continue;
        }
      }
      
      // If we're in a DSE 6.0 StatusLogger section
      if (inDse60Section && dse60Timestamp) {
        // End markers for the section
        if (line.startsWith("MessagingService") || 
            line.startsWith("Cache Type") || 
            line.startsWith("Table") ||
            line.length < 10) {
          inDse60Section = false;
          continue;
        }
        
        try {
          // Extract pool name - in DSE 6.0 format, the pool name is left-aligned
          // and followed by multiple spaces before the first metric
          const poolMatch = line.match(/^(\S[\S ]+?)\s{2,}(\d+)\s+/);
          if (!poolMatch) continue;
          
          const poolName = poolMatch[1].trim();
          if (!poolName || poolName.length < 2) continue;
          
          // Special handling for DSE 6.0 format
          // Format: Pool Name | Active | Pending (w/Backpressure) | Delayed | Completed | Blocked | All Time Blocked
          // Each value can be a number or "N/A"
          
          // Extract all numeric values from the line
          const values: number[] = [];
          const pendingMatch = line.match(/\s+(\d+)\s+\(N\/A\)/);
          let pendingValue = 0;
          
          if (pendingMatch) {
            pendingValue = parseInt(pendingMatch[1], 10);
          }
          
          // Get the first number (Active)
          const activeMatch = line.match(/\s+(\d+)\s+\d+\s+\(N\/A\)/);
          let activeValue = 0;
          if (activeMatch) {
            activeValue = parseInt(activeMatch[1], 10);
          } else {
            // Alternative extraction if the first pattern doesn't match
            const altActiveMatch = line.match(/\s+(\d+)\s+/);
            if (altActiveMatch) {
              activeValue = parseInt(altActiveMatch[1], 10);
            }
          }
          
          // For Delayed, Completed, Blocked, and All Time Blocked
          // We need to parse them based on position
          const allNumbers = line.match(/\b(\d+)\b/g)?.map(n => parseInt(n, 10)) || [];
          
          // If we found the Active and Pending values, add them
          values.push(activeValue);
          values.push(pendingValue);
          
          // Detect if "Delayed" is N/A or a number
          const delayedValue = line.includes("N/A") && !line.includes("Backpressure N/A") ? 0 : 
            (allNumbers.length >= 3 ? allNumbers[2] : 0);
          values.push(delayedValue);
          
          // Add completed, blocked, all time blocked values if available
          if (allNumbers.length >= 4) values.push(allNumbers[allNumbers.length - 3]); // Completed
          if (allNumbers.length >= 5) values.push(allNumbers[allNumbers.length - 2]); // Blocked
          if (allNumbers.length >= 6) values.push(allNumbers[allNumbers.length - 1]); // All Time Blocked
          
          console.log(`DSE 6.0 format: Found pool ${poolName} with ${values.length} values: ${values.join(', ')}`);
          
          // Convert timestamp to standard format
          const parsedTimestamp = new Date(dse60Timestamp.replace(',', '.')).toISOString();
          
          // Add this timestamp if it doesn't exist
          if (!timestamps.includes(parsedTimestamp)) {
            timestamps.push(parsedTimestamp);
            timestamps.sort(); // Keep timestamps in order
          }
          
          // Add the pool name to our list if not already there
          if (!threadPools.includes(poolName)) {
            threadPools.push(poolName);
          }
          
          // Find the index for this timestamp
          const timestampIndex = timestamps.indexOf(parsedTimestamp);
          
          // DSE 6.0 format has a fixed column order:
          // Pool Name | Active | Pending (w/Backpressure) | Delayed | Completed | Blocked | All Time Blocked
          const dse60Metrics = [
            "Active",       // 0
            "Pending",      // 1 - Just call it "Pending" even though it's "Pending (w/Backpressure)" in the file
            "Delayed",      // 2
            "Completed",    // 3
            "Blocked",      // 4
            "All Time Blocked" // 5
          ];
          
          // Map values to the known metrics
          for (let j = 0; j < Math.min(values.length, dse60Metrics.length); j++) {
            const metricName = dse60Metrics[j];
            const seriesKey = `${poolName}: ${metricName}`;
            
            // Create the series if it doesn't exist
            if (!series[seriesKey]) {
              series[seriesKey] = new Array(timestamps.length).fill(0);
            }
            
            // Make sure the series has enough elements
            while (series[seriesKey].length < timestamps.length) {
              series[seriesKey].push(0);
            }
            
            // Update the value
            series[seriesKey][timestampIndex] = values[j];
            
            if (poolName === "CompactionExecutor" && metricName === "Completed") {
              console.log(`DSE 6.0 format: CompactionExecutor Completed = ${values[j]} at position ${j} for timestamp ${parsedTimestamp}`);
            }
          }
        } catch (error) {
          console.error("Error parsing DSE 6.0 thread pool line:", error, line);
        }
      }
    }
    
    console.log(`DSE 6.0 parser found ${threadPools.length} thread pools`);
    if (threadPools.length > 0) {
      console.log("Sample thread pools:", threadPools.slice(0, 5));
    }
  }
  
  // Add special handling for DSE 6.8 format which appears in system-6.8.log
  if (threadPools.length === 0) {
    console.log("Trying DSE 6.8 format parser...");
    
    // Track the current timestamp when we see a StatusLogger line
    let dse68Timestamp = "";
    let inThreadPoolSection = false;
    let columnHeaders: string[] = [];
    
    // Go through the file line by line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Get timestamp from StatusLogger lines
      if (line.includes("StatusLogger.java:174")) {
        const timestampMatch = line.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d{3})/);
        if (timestampMatch) {
          dse68Timestamp = timestampMatch[1];
          inThreadPoolSection = true;
          continue;
        }
      }
      
      // Get column headers from the "Pool Name" line
      if (line.startsWith("Pool Name")) {
        // Use a more robust method to extract column headers
        // This will handle various spacing formats
        columnHeaders = line.split(/\s{2,}/).map(header => header.trim());
        
        // Standardize column header names to match our expected metric names
        columnHeaders = columnHeaders.map(header => {
          // Map various header names to standard metric names
          if (/active/i.test(header)) return "Active";
          if (/pending/i.test(header)) return "Pending";
          if (/delayed/i.test(header)) return "Delayed";
          if (/completed/i.test(header)) return "Completed";
          if (/blocked$/i.test(header)) return "Blocked";
          if (/all.*time.*blocked/i.test(header)) return "All Time Blocked";
          if (/backpressure/i.test(header)) return "Backpressure";
          if (/shared/i.test(header)) return "Shared";
          if (/stolen/i.test(header)) return "Stolen";
          return header; // Keep original if no match
        });
        
        console.log("DSE 6.8 format: Standardized column headers:", columnHeaders);
        continue;
      }
      
      // If we're in a thread pool section and have a timestamp, process pool entries
      if (inThreadPoolSection && dse68Timestamp && columnHeaders.length > 0) {
        // Skip lines that aren't pool entries
        if (line.startsWith("Pool Name") || 
            line.includes("MessagingService") || 
            line.includes("Buffer pool") || 
            line.includes("CompactionManager") ||
            line.includes("n/a") ||
            !line.match(/^[A-Za-z]/)) {
          continue;
        }
        
        // End of thread pool section
        if (line.length < 10) {
          inThreadPoolSection = false;
          continue;
        }
        
        try {
          // Extract the pool name (which can contain spaces)
          // The pool name is the content up to the first group of 2+ spaces
          const poolNameMatch = line.match(/^([A-Za-z][A-Za-z0-9\/_ ]+?)(?:\s{2,}|\t)/);
          if (!poolNameMatch) continue;
          
          const poolName = poolNameMatch[1].trim();
          if (!poolName || poolName.length < 2) continue;
          
          // Extract all numeric and N/A values
          const values: number[] = [];
          const valueMatches = line.substring(poolNameMatch[0].length)
              .match(/(?:\d+|N\/A)(?:\s{2,}|\t|$)/g);
              
          if (!valueMatches) continue;
          
          // Convert values, replacing N/A with 0
          valueMatches.forEach(match => {
            const value = match.trim();
            if (value === "N/A") {
              values.push(0);
            } else {
              values.push(parseInt(value, 10));
            }
          });
          
          // Ensure we have a value for each column header (excluding Pool Name)
          while (values.length < columnHeaders.length - 1) {
            values.push(0); // Pad with zeros
          }
          
          console.log(`DSE 6.8 format: Found pool ${poolName} with ${values.length} values`);
          
          // Convert timestamp to standard format
          const parsedTimestamp = new Date(dse68Timestamp.replace(',', '.')).toISOString();
          
          // Add this timestamp if it doesn't exist
          if (!timestamps.includes(parsedTimestamp)) {
            timestamps.push(parsedTimestamp);
            timestamps.sort(); // Keep timestamps in order
          }
          
          // Add the pool name to our list if not already there
          if (!threadPools.includes(poolName)) {
            threadPools.push(poolName);
          }
          
          // Find the index for this timestamp
          const timestampIndex = timestamps.indexOf(parsedTimestamp);
          
          // Ensure the standard metric set is populated
          const standardMetrics = [
            "Active",
            "Pending", 
            "Delayed",
            "Completed",
            "Blocked",
            "All Time Blocked",
            "Shared",
            "Stolen"
          ];
          
          // Track which standard metrics were found
          const foundMetrics = new Set<string>();
          
          // Map the values to the correct metrics based on column headers
          // Use the column index to map values to the correct metric
          for (let j = 1; j < Math.min(columnHeaders.length, values.length + 1); j++) {
            const metricName = columnHeaders[j];
            if (!metricName) continue;
            
            // Get the value at the correct index (j-1 because we skip the Pool Name column)
            const value = values[j-1];
            
            const seriesKey = `${poolName}: ${metricName}`;
            
            // Create the series if it doesn't exist
            if (!series[seriesKey]) {
              series[seriesKey] = new Array(timestamps.length).fill(0);
            }
            
            // Make sure the series has enough elements
            while (series[seriesKey].length < timestamps.length) {
              series[seriesKey].push(0);
            }
            
            // Update the value
            series[seriesKey][timestampIndex] = value;
            
            // Track that we found this metric
            if (standardMetrics.includes(metricName)) {
              foundMetrics.add(metricName);
            }
            
            // Debug special case for Completed metric
            if (poolName === "CompactionExecutor" && metricName === "Completed") {
              console.log(`CompactionExecutor Completed = ${value} at position ${j-1} for timestamp ${parsedTimestamp}`);
            }
          }
          
          // Add any missing standard metrics
          standardMetrics.forEach(metric => {
            if (!foundMetrics.has(metric)) {
              const seriesKey = `${poolName}: ${metric}`;
              if (!series[seriesKey]) {
                series[seriesKey] = new Array(timestamps.length).fill(0);
              }
              // Make sure the series has enough elements
              while (series[seriesKey].length < timestamps.length) {
                series[seriesKey].push(0);
              }
              // Set the value for this timestamp to 0
              series[seriesKey][timestampIndex] = 0;
            }
          });
        } catch (error) {
          console.error("Error parsing DSE 6.8 thread pool line:", error, line);
        }
      }
    }
    
    console.log(`DSE 6.8 parser found ${threadPools.length} thread pools`);
    if (threadPools.length > 0) {
      console.log("Sample thread pools:", threadPools.slice(0, 5));
    }
  }
  
  // Fallback for if we found thread pools but no metrics - search for StatusLogger.java:174 entries
  if (threadPools.length === 0 && statusLines.length > 0) {
    console.log("No thread pools found using standard parsing. Trying fallback extraction...");
    // Extract thread pool names from table names in the log
    const tableNameRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*)\b/g;
    let tableMatch;
    
    statusLines.forEach(line => {
      tableNameRegex.lastIndex = 0; // Reset the regex for each line
      while ((tableMatch = tableNameRegex.exec(line)) !== null) {
        const tableName = tableMatch[1];
        if (!threadPools.includes(tableName)) {
          console.log(`Extracted table name as thread pool: ${tableName}`);
          threadPools.push(tableName);
          
          // Create empty series for the basic metrics
          metricsToTrack.forEach(metricName => {
            const seriesKey = `${tableName}: ${metricName}`;
            if (!series[seriesKey]) {
              series[seriesKey] = [];
            }
          });
        }
      }
    });
    
    // If we found some thread pools, let's add at least one timestamp
    if (threadPools.length > 0 && timestamps.length === 0) {
      const defaultTimestamp = new Date().toISOString();
      timestamps.push(defaultTimestamp);
      
      // Add default values (zeros) for all series
      threadPools.forEach(pool => {
        metricsToTrack.forEach(metricName => {
          const seriesKey = `${pool}: ${metricName}`;
          series[seriesKey] = [0];
        });
      });
    }
  }
  
  // Add a final pass to ensure all thread pools have all standard metrics
  if (threadPools.length > 0) {
    console.log("Ensuring all thread pools have all standard metrics...");
    
    // Track which metrics were found in the data
    const allFoundMetrics = new Set<string>();
    Object.keys(series).forEach(seriesKey => {
      if (seriesKey.includes(': ')) {
        const metricName = seriesKey.split(': ')[1];
        allFoundMetrics.add(metricName);
      }
    });
    
    // Define the standard set of metrics that all thread pools should have
    const standardMetrics = [
      "Active",
      "Pending",
      "Delayed",
      "Completed",
      "Blocked",
      "All Time Blocked"
    ];
    
    // Add Shared and Stolen metrics only if they were found in any thread pool
    if (allFoundMetrics.has("Shared")) {
      standardMetrics.push("Shared");
    }
    
    if (allFoundMetrics.has("Stolen")) {
      standardMetrics.push("Stolen");
    }
    
    // For each thread pool, ensure all standard metrics exist
    threadPools.forEach(poolName => {
      standardMetrics.forEach(metric => {
        const seriesKey = `${poolName}: ${metric}`;
        
        // If this metric doesn't exist for this pool, create it with zeros
        if (!series[seriesKey]) {
          console.log(`Adding missing metric '${metric}' for pool '${poolName}'`);
          series[seriesKey] = new Array(timestamps.length).fill(0);
        }
      });
    });
    
    // Log summary of metrics per pool
    console.log(`Ensured ${standardMetrics.length} standard metrics for ${threadPools.length} thread pools`);
    console.log(`Total series: ${Object.keys(series).length}`);
  }
  
  // Normalize all series to have values for all timestamps
  normalizeSeriesData(series, timestamps);
  
  // Log results and stats
  const uniquePools = threadPools.length;
  const timestampCount = timestamps.length;
  const seriesCount = Object.keys(series).length;
  
  console.log(`parseThreadPoolMetrics: Found ${uniquePools} thread pools across ${timestampCount} timestamps`);
  console.log(`parseThreadPoolMetrics: Created ${seriesCount} time series`);
  
  if (threadPools.length > 0) {
    console.log("Thread pools found:", threadPools.join(", "));
  }
  
  // Extract all available metrics for each thread pool
  const poolMetrics: Record<string, string[]> = {};
  Object.keys(series).forEach(key => {
    const parts = key.split(': ');
    if (parts.length === 2) {
      const poolName = parts[0];
      const metricName = parts[1];
      
      if (!poolMetrics[poolName]) {
        poolMetrics[poolName] = [];
      }
      
      if (!poolMetrics[poolName].includes(metricName)) {
        poolMetrics[poolName].push(metricName);
      }
    }
  });
  
  return {
    timestamps,
    series,
    metadata: {
      threadPools,
      poolMetrics // Add detailed pool metrics to metadata
    }
  };
}

/**
 * Helper function to process multi-line format metrics
 */
function processMultiLineFormatMetrics(
  pendingMetrics: Record<string, Record<string, number>>,
  currentTimestamp: string,
  timestamps: string[],
  threadPools: string[],
  series: Record<string, number[]>,
  allMetricsToTrack: string[]
) {
  if (!currentTimestamp) return;
  
  // Convert timestamp to standard format
  const parsedTimestamp = new Date(currentTimestamp.replace(',', '.')).toISOString();
  
  // Add this timestamp if it doesn't exist
  if (!timestamps.includes(parsedTimestamp)) {
    timestamps.push(parsedTimestamp);
    timestamps.sort(); // Keep timestamps in order
  }
  
  // Find the index for this timestamp
  const timestampIndex = timestamps.indexOf(parsedTimestamp);
  
  // Process all pending pools
  Object.entries(pendingMetrics).forEach(([poolName, metrics]) => {
    // Add the pool name to our list if not already there
    if (!threadPools.includes(poolName)) {
      threadPools.push(poolName);
      
      // Create empty series for this pool for all metrics
      allMetricsToTrack.forEach(metricName => {
        const seriesKey = `${poolName}: ${metricName}`;
        if (!series[seriesKey]) {
          series[seriesKey] = new Array(timestamps.length).fill(0);
        }
      });
    }
    
    // Update series data for each metric
    Object.entries(metrics).forEach(([metricName, value]) => {
      const seriesKey = `${poolName}: ${metricName}`;
      
      // Create the series if it doesn't exist
      if (!series[seriesKey]) {
        series[seriesKey] = new Array(timestamps.length).fill(0);
      }
      
      // Update the value
      if (timestampIndex >= 0) {
        series[seriesKey][timestampIndex] = value;
      }
    });
  });
}

/**
 * Parse a single thread pool line into component parts
 */
function parseThreadPoolLine(line: string, headerColumns: string[]): any {
  // Remove any leading spaces
  line = line.trim();
  
  // Find where the numeric values start
  let numericStartIndex = -1;
  let firstNumberMatch = line.match(/\s+\d+\s+|\s+N\/A\s+/);
  
  if (firstNumberMatch) {
    numericStartIndex = firstNumberMatch.index || -1;
  }
  
  if (numericStartIndex === -1) {
    // Alternative approach: Look for a pattern of spaces followed by a number or N/A
    const alternativeMatch = line.match(/\s{2,}(?:\d+|N\/A)/);
    if (alternativeMatch) {
      numericStartIndex = alternativeMatch.index || -1;
    }
  }
  
  if (numericStartIndex === -1 || numericStartIndex < 3) {  // Allow shorter pool names but not too short
    console.warn(`Could not reliably determine where numbers start: ${line}`);
    return null;
  }
  
  // Extract the pool name (everything before the numeric values)
  const poolName = line.substring(0, numericStartIndex).trim();
  
  // Get the raw line text after the pool name for more robust extraction
  const valuesText = line.substring(numericStartIndex);
  
  // Parse the values based on the known structure of StatusLogger output
  // Create a result object starting with the pool name
  const result: Record<string, any> = {
    poolName
  };
  
  // Extract all numbers from the line
  const allNumbers: number[] = [];
  const numRegex = /\b(\d+)\b/g;
  let numMatch;
  while ((numMatch = numRegex.exec(valuesText)) !== null) {
    allNumbers.push(parseInt(numMatch[1], 10));
  }
  
  console.log(`Found ${allNumbers.length} numbers for pool ${poolName}: ${allNumbers.join(', ')}`);
  
  // Now map the numbers to our expected metrics based on their position
  if (allNumbers.length >= 1) result.active = allNumbers[0];
  if (allNumbers.length >= 2) result.pending = allNumbers[1];
  if (allNumbers.length >= 3) result.completed = allNumbers[2];
  if (allNumbers.length >= 4) result.blocked = allNumbers[3];
  if (allNumbers.length >= 5) result.alltimeblocked = allNumbers[4];
  
  // Fill in missing values with zeros
  result.active = result.active || 0;
  result.pending = result.pending || 0;
  result.completed = result.completed || 0;
  result.blocked = result.blocked || 0;
  result.alltimeblocked = result.alltimeblocked || 0;
  
  // Debug output for troubleshooting
  console.log(`Parsed ${poolName}:`, result);
  
  return result;
}

/**
 * Ensure all series have values for all timestamps
 */
function normalizeSeriesData(series: Record<string, number[]>, timestamps: string[]): void {
  for (const key in series) {
    // If a series has fewer points than timestamps, pad with zeros
    while (series[key].length < timestamps.length) {
      series[key].push(0);
    }
    
    // If a series has more points than timestamps (shouldn't happen), truncate
    if (series[key].length > timestamps.length) {
      series[key] = series[key].slice(0, timestamps.length);
    }
  }
}

/**
 * Parses system.log for tombstone query warnings
 */
export function parseTombstoneWarnings(logContent: string): ParsedTimeSeries {
  const tombstoneRegex = /WARN.*ReadCommand\.java:.*Read\s+(\d+)\s+live\s+rows\s+and\s+(\d+)\s+tombstone\s+cells\s+for\s+query\s+(.*)/;
  
  const timestamps: string[] = [];
  const series: Record<string, number[]> = {
    "Live Rows": [],
    "Tombstone Cells": [],
    "Tombstone Ratio": []
  };
  
  // Also collect query information for tabular display
  const queryData: Array<{
    query: string;
    liveRows: number;
    tombstones: number;
    ratio: number;
    timestamp: string;
    tableName: string;
  }> = [];
  
  // Track tombstones per table
  const tableStats: Record<string, number> = {};
  
  const lines = logContent.split('\n');
  
  for (const line of lines) {
    const match = line.match(tombstoneRegex);
    if (match) {
      // Extract timestamp using a separate regex
      const timestampMatch = line.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d{3})/);
      if (!timestampMatch) continue;
      
      const timestamp = timestampMatch[1];
      const [_, liveRowsStr, tombstonesStr, query] = match;
      
      // Convert to numbers
      const liveRows = parseInt(liveRowsStr, 10);
      const tombstones = parseInt(tombstonesStr, 10);
      const ratio = tombstones / (liveRows + tombstones);
      
      // Convert timestamp to a standard format
      const parsedTimestamp = new Date(timestamp.replace(',', '.')).toISOString();
      timestamps.push(parsedTimestamp);
      
      // Store values
      series["Live Rows"].push(liveRows);
      series["Tombstone Cells"].push(tombstones);
      series["Tombstone Ratio"].push(ratio);
      
      // Extract table name from query
      // Cassandra queries typically follow patterns like:
      // SELECT * FROM keyspace.table_name WHERE...
      // SELECT * FROM table_name WHERE...
      let tableName = "Unknown";
      
      const fromMatch = query.match(/\sFROM\s+([^\s(,;]+)(?:\.[^\s(,;]+)?/i);
      if (fromMatch) {
        // Get the table part, handling both "keyspace.table" and "table" formats
        const fromParts = fromMatch[1].split('.');
        tableName = fromParts.length > 1 ? fromParts[1] : fromParts[0];
      }
      
      // Add to tombstones per table counter
      tableStats[tableName] = (tableStats[tableName] || 0) + tombstones;
      
      // Add to query data for tabular display
      queryData.push({
        query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
        liveRows,
        tombstones,
        ratio,
        timestamp: parsedTimestamp,
        tableName
      });
    }
  }
  
  // Sort query data by tombstone count (descending)
  queryData.sort((a, b) => b.tombstones - a.tombstones);
  
  // Get top 20 queries
  const topQueries = queryData.slice(0, 20);
  
  // Convert table stats to array for easier processing
  const tablesArray = Object.entries(tableStats).map(([name, count]) => ({
    tableName: name,
    tombstones: count
  }));
  
  // Sort tables by tombstone count (descending)
  tablesArray.sort((a, b) => b.tombstones - a.tombstones);
  
  return {
    timestamps,
    series,
    metadata: {
      queryData: topQueries,
      tableStats: tablesArray
    }
  };
}

/**
 * Parses system.log for slow/timed out read warnings
 */
export function parseSlowReads(logContent: string): ParsedTimeSeries {
  const slowReadRegex = /WARN.*Timed out async read from.*for file\s+(\/\S+)/;
  
  const timestamps: string[] = [];
  const series: Record<string, number[]> = {
    "Timed Out Reads": []
  };
  
  // Track file paths and their timeout counts
  const fileCounts: Record<string, number> = {};
  
  const lines = logContent.split('\n');
  
  for (const line of lines) {
    const match = line.match(slowReadRegex);
    if (match) {
      // Extract timestamp using a separate regex
      const timestampMatch = line.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d{3})/);
      if (!timestampMatch) continue;
      
      const timestamp = timestampMatch[1];
      const [_, filePath] = match;
      
      // Convert timestamp to a standard format
      const parsedTimestamp = new Date(timestamp.replace(',', '.')).toISOString();
      timestamps.push(parsedTimestamp);
      
      // Store values (1 for each occurrence)
      series["Timed Out Reads"].push(1);
      
      // Count occurrences by file path
      const fileKey = filePath.split('/').slice(-2).join('/'); // Get last 2 parts of path
      fileCounts[fileKey] = (fileCounts[fileKey] || 0) + 1;
    }
  }
  
  // Add series for top files with timeouts
  const topFiles = Object.entries(fileCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
    
  for (const [file, count] of topFiles) {
    series[`File: ${file}`] = new Array(timestamps.length).fill(1);
  }
  
  return {
    timestamps,
    series,
    metadata: {
      fileCounts
    }
  };
}

/**
 * Main parser function for system.log - combines all parsers
 */
export function parseSystemLog(logContent: string): {
  gcEvents: ParsedTimeSeries;
  statusEvents: ParsedTimeSeries;
  threadPoolMetrics: ParsedTimeSeries;
  tombstoneWarnings: ParsedTimeSeries;
  slowReads: ParsedTimeSeries;
} {
  console.log("parseSystemLog: Starting to parse system log");
  
  if (!logContent) {
    console.error("parseSystemLog: Empty log content");
    // Return empty data sets
    return {
      gcEvents: { timestamps: [], series: {} },
      statusEvents: { timestamps: [], series: {} },
      threadPoolMetrics: { timestamps: [], series: {} },
      tombstoneWarnings: { timestamps: [], series: {} },
      slowReads: { timestamps: [], series: {} }
    };
  }
  
  console.log(`parseSystemLog: Log content length: ${logContent.length}`);
  console.log(`parseSystemLog: Sample lines: ${logContent.split('\n').slice(0, 2).join(' | ')}`);
  
  try {
    // Run diagnostic scan for thread pool data
    console.log("parseSystemLog: Running thread pool data scan diagnostic");
    scanForThreadPoolData(logContent);
    
    const gcEvents = parseGCEvents(logContent);
    const statusEvents = parseStatusLoggerEvents(logContent);
    const threadPoolMetrics = parseThreadPoolMetrics(logContent);
    const tombstoneWarnings = parseTombstoneWarnings(logContent);
    const slowReads = parseSlowReads(logContent);
    
    console.log("parseSystemLog: Parse complete", {
      gcEvents: gcEvents.timestamps.length,
      statusEvents: statusEvents.timestamps.length,
      threadPoolMetrics: threadPoolMetrics.timestamps.length,
      tombstoneWarnings: tombstoneWarnings.timestamps.length,
      slowReads: slowReads.timestamps.length
    });
    
    // Debug the thread pool data to ensure integrity
    console.log("parseSystemLog: Running thread pool data integrity check");
    debugThreadPoolData(threadPoolMetrics);
    
    return {
      gcEvents,
      statusEvents,
      threadPoolMetrics,
      tombstoneWarnings,
      slowReads
    };
  } catch (error) {
    console.error("parseSystemLog: Error parsing log", error);
    throw error;
  }
}

/**
 * Helper function to check thread pool metadata integrity
 */
export function debugThreadPoolData(data: ParsedTimeSeries): void {
  if (!data) {
    console.log("DEBUG: Thread pool data is null or undefined");
    return;
  }
  
  console.log("DEBUG: Thread pool data diagnostics:");
  console.log(`- Timestamps: ${data.timestamps?.length || 0}`);
  console.log(`- Series keys: ${Object.keys(data.series || {}).length}`);
  console.log(`- Thread pools in metadata: ${data.metadata?.threadPools?.length || 0}`);
  
  // Extract thread pools from series keys as verification
  const extractedPools = new Set<string>();
  Object.keys(data.series || {}).forEach(key => {
    if (key.includes(': ')) {
      const poolName = key.split(': ')[0];
      if (poolName && poolName.length > 0) {
        extractedPools.add(poolName);
      }
    }
  });
  
  console.log(`- Thread pools extractable from series keys: ${extractedPools.size}`);
  console.log(`- Extracted pools: ${Array.from(extractedPools).join(', ')}`);
  
  // Check if metadata has all pools from series keys
  const metadataPools = new Set(data.metadata?.threadPools || []);
  const missingPools = Array.from(extractedPools).filter(pool => !metadataPools.has(pool));
  if (missingPools.length > 0) {
    console.log(`- WARNING: ${missingPools.length} pools in series keys missing from metadata: ${missingPools.join(', ')}`);
  }
}

/**
 * New diagnostic function to scan log content for thread pool data
 */
export function scanForThreadPoolData(logContent: string): void {
  if (!logContent) {
    console.log("SCAN: Empty log content provided");
    return;
  }
  
  console.log(`SCAN: Log content length: ${logContent.length} bytes`);
  
  // Count lines with different thread pool indicators
  const lines = logContent.split('\n');
  const counts = {
    statusLogger51: 0,         // StatusLogger.java:51 lines
    statusLogger47: 0,         // StatusLogger.java:47 lines
    poolNameHeader: 0,         // Lines containing "Pool Name" header
    poolNameLine: 0,           // Lines containing pool name patterns
    threadPoolMetrics: 0       // Lines that might contain thread pool metrics
  };
  
  // Sample lines for inspection
  const samples = {
    statusLogger51: [] as string[],
    statusLogger47: [] as string[],
    poolNameHeader: [] as string[],
    poolNameLine: [] as string[]
  };
  
  // Identify potential pool names
  const poolNames = new Set<string>();
  
  lines.forEach(line => {
    if (line.includes("StatusLogger.java:51")) {
      counts.statusLogger51++;
      if (samples.statusLogger51.length < 5) {
        samples.statusLogger51.push(line);
      }
      
      // Try to extract pool name
      const contentMatch = line.match(/StatusLogger\.java:51\s+-\s+(\S+)/);
      if (contentMatch && contentMatch[1]) {
        const poolName = contentMatch[1].trim();
        if (poolName.length > 0 && !poolName.match(/^\d+$/) && poolName !== "..." && poolName !== "..") {
          poolNames.add(poolName);
        }
      }
    }
    
    if (line.includes("StatusLogger.java:47")) {
      counts.statusLogger47++;
      if (samples.statusLogger47.length < 3) {
        samples.statusLogger47.push(line);
      }
    }
    
    if (line.includes("Pool Name")) {
      counts.poolNameHeader++;
      if (samples.poolNameHeader.length < 3) {
        samples.poolNameHeader.push(line);
      }
    }
    
    // Generic thread pool name pattern detection
    // Look for lines with words followed by sequences of numbers which might be metrics
    const poolLineMatch = line.match(/^(\S+)\s+\d+\s+\d+\s+\d+/);
    if (poolLineMatch) {
      counts.poolNameLine++;
      if (samples.poolNameLine.length < 3) {
        samples.poolNameLine.push(line);
      }
      
      // Potential pool name
      const potentialPool = poolLineMatch[1].trim();
      if (potentialPool.length > 1 && !potentialPool.match(/^\d+$/) && !line.startsWith("INFO") && !line.startsWith("WARN")) {
        poolNames.add(potentialPool);
      }
    }
    
    // Count lines that might contain metrics
    if (/\d+\s+\d+\s+\d+\s+\d+\s+\d+/.test(line)) {
      counts.threadPoolMetrics++;
    }
  });
  
  // Report findings
  console.log("SCAN: Thread pool indicators found in log:");
  console.log(`- StatusLogger.java:51 lines: ${counts.statusLogger51}`);
  console.log(`- StatusLogger.java:47 lines: ${counts.statusLogger47}`);
  console.log(`- Pool Name headers: ${counts.poolNameHeader}`);
  console.log(`- Potential pool name lines: ${counts.poolNameLine}`);
  console.log(`- Potential metric lines: ${counts.threadPoolMetrics}`);
  console.log(`- Potential thread pools extracted: ${poolNames.size}`);
  
  if (poolNames.size > 0) {
    console.log("SCAN: Potential thread pool names found:", Array.from(poolNames).join(', '));
  }
  
  // Display samples
  if (samples.statusLogger51.length > 0) {
    console.log("SCAN: Sample StatusLogger.java:51 lines:");
    samples.statusLogger51.forEach((line, i) => console.log(`  ${i + 1}: ${line.substring(0, 150)}`));
  }
  
  if (samples.statusLogger47.length > 0) {
    console.log("SCAN: Sample StatusLogger.java:47 lines:");
    samples.statusLogger47.forEach((line, i) => console.log(`  ${i + 1}: ${line.substring(0, 150)}`));
  }
  
  if (samples.poolNameHeader.length > 0) {
    console.log("SCAN: Sample Pool Name header lines:");
    samples.poolNameHeader.forEach((line, i) => console.log(`  ${i + 1}: ${line.substring(0, 150)}`));
  }
  
  // Conclusion
  if (counts.statusLogger51 > 0 || counts.poolNameHeader > 0 || poolNames.size > 0) {
    console.log("SCAN: Thread pool data is likely present in this log");
  } else {
    console.log("SCAN: No reliable thread pool data indicators found in this log");
  }
}

/**
 * Expose diagnostic functions to window for debugging from browser console
 */
export function exposeThreadPoolDiagnostics(): void {
  try {
    if (typeof window !== 'undefined') {
      (window as any).threadPoolDiagnostics = {
        scan: scanForThreadPoolData,
        debug: debugThreadPoolData,
        // Add a helper to create empty thread pool data structure
        createEmptyThreadPoolData: (): ParsedTimeSeries => {
          console.log("Creating empty thread pool data structure");
          
          const timestamp = new Date().toISOString();
          
          return {
            timestamps: [timestamp],
            series: {},
            metadata: {
              threadPools: []
            }
          };
        }
      };
      
      console.log("Thread pool diagnostics exposed to window.threadPoolDiagnostics");
    }
  } catch (e) {
    console.error("Failed to expose thread pool diagnostics to window:", e);
  }
}

// Call the function to expose diagnostics
exposeThreadPoolDiagnostics();
