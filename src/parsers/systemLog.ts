import { ParsedTimeSeries } from "../types";

/**
 * Parses system.log file to extract GCInspector logs
 */
export function parseGCEvents(logContent: string): ParsedTimeSeries {
  console.log("parseGCEvents: Starting to parse GC events");
  
  // Use a more general regex that captures the full line for inspection
  const gcRegex = /INFO\s+\[GCInspector:1\]\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d{3})\s+GCInspector\.java:\d+\s+-\s+(.*)\s+in\s+(\d+)ms/;
  
  // Add a fallback regex in case the first one doesn't match
  const fallbackGcRegex = /\[GCInspector.*?\]\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}).*?in\s+(\d+)ms/;
  
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
    
    // Try the main regex first
    const match = line.match(gcRegex);
    if (match) {
      isMatch = true;
      matchCount++;
      let durationStr;
      [, timestamp, gcDescription, durationStr] = match;
      duration = parseInt(durationStr, 10);
      rawDescriptions.push(gcDescription);
    } 
    // If main regex fails, try the fallback and use the whole line for type detection
    else if (line.includes("GCInspector") && line.includes("ms")) {
      const fallbackMatch = line.match(fallbackGcRegex);
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
  
  console.log(`parseGCEvents: Found ${matchCount} primary GC events and ${fallbackMatchCount} fallback matches`);
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
  
  // Initialize data structures
  const timestamps: string[] = [];
  const series: Record<string, number[]> = {};
  const threadPools: string[] = [];
  
  // These are the metrics we're interested in tracking
  const metricsToTrack = ["Active", "Pending", "Completed", "Blocked", "All Time Blocked"];
  
  try {
    // Split the content into lines
    const lines = logContent.split('\n');
    
    // Variables to track the current state
    let currentTimestamp = "";
    let inThreadPoolSection = false;
    let threadPoolHeaderLine = "";
    let headerColumns: string[] = [];
    
    // Process each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Look for StatusLogger header lines
      if (line.includes("StatusLogger.java")) {
        // Extract timestamp from the line
        const timestampMatch = line.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d{3})/);
        if (timestampMatch) {
          currentTimestamp = timestampMatch[1];
          inThreadPoolSection = false; // Reset section flag
        }
        continue;
      }
      
      // Detect thread pool header line
      if (line.includes("Pool Name") && line.includes("Active") && line.includes("Pending")) {
        threadPoolHeaderLine = line;
        inThreadPoolSection = true;
        
        // Extract header columns to understand the data structure
        headerColumns = line.split(/\s{2,}/).map(col => col.trim());
        continue;
      }
      
      // If we're in the thread pool section and have a timestamp, parse the thread pool data lines
      if (inThreadPoolSection && currentTimestamp) {
        // Skip if empty or seems like a header or other type of log message
        if (!line.trim() || 
            line.includes("Memtable") || 
            line.includes("---") || 
            line.includes("Table") ||
            line.startsWith("INFO") ||
            line.startsWith("WARN") ||
            line.startsWith("ERROR") ||
            line.startsWith("DEBUG") ||
            !line.match(/\s+\d+\s+/) // Line must contain numbers surrounded by spaces to be a thread pool line
           ) {
          continue;
        }
        
        // Extract pool name and metrics from the line
        try {
          const poolData = parseThreadPoolLine(line, headerColumns);
          if (poolData && poolData.poolName) {
            // Additional validation: Check if the pool name looks like a log message
            if (poolData.poolName.includes("[") && poolData.poolName.includes("]")) {
              console.warn(`Skipping likely non-thread pool line: ${line.substring(0, 30)}...`);
              continue;
            }
            
            // Add this thread pool to our list if not already there
            if (!threadPools.includes(poolData.poolName)) {
              threadPools.push(poolData.poolName);
            }
            
            // Convert timestamp to a standard format for chart display
            const parsedTimestamp = new Date(currentTimestamp.replace(',', '.')).toISOString();
            
            // Ensure timestamp exists in our timestamps array
            if (!timestamps.includes(parsedTimestamp)) {
              timestamps.push(parsedTimestamp);
            }
            
            // For each metric we want to track, add a data point
            for (const metric of metricsToTrack) {
              const metricKey = `${poolData.poolName}: ${metric}`;
              // Map the normalized metric name to our internal field name
              const fieldName = metric.toLowerCase().replace(/ /g, '');
              
              // For "All Time Blocked", map to alltimeblocked
              const internalField = fieldName === 'alltimeblocked' ? 'alltimeblocked' : fieldName;
              
              // Get the value, defaulting to 0 if not found
              const metricValue = poolData[internalField] || 0;
              
              // Initialize series if needed
              if (!series[metricKey]) {
                series[metricKey] = new Array(timestamps.length - 1).fill(0);
              }
              
              // Add value for this timestamp
              series[metricKey].push(metricValue);
            }
          }
        } catch (e) {
          console.warn(`Error parsing thread pool line: ${line}`, e);
        }
      }
      
      // If we hit a line that indicates the end of thread pool section, reset the flag
      if (inThreadPoolSection && (line.includes("Memtable Metrics") || line.includes("Keyspace Metrics"))) {
        inThreadPoolSection = false;
      }
    }
    
    // Ensure all series have values for all timestamps
    normalizeSeriesData(series, timestamps);
    
    console.log(`Parsed ${threadPools.length} thread pools across ${timestamps.length} timestamps`);
    
    return {
      timestamps,
      series,
      metadata: {
        threadPools
      }
    };
  } catch (error) {
    console.error("Error parsing thread pool metrics:", error);
    return {
      timestamps: [],
      series: {},
      metadata: {
        threadPools: []
      }
    };
  }
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
  
  if (numericStartIndex === -1 || numericStartIndex < 10) {
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
  
  // Directly extract metrics using regex patterns for more reliability
  
  // Extract Active value (first number in the line)
  const activeMatch = valuesText.match(/^\s*(\d+)/);
  result.active = activeMatch ? parseInt(activeMatch[1], 10) : 0;
  
  // Extract Pending value - this should be the second number in the line
  // Be more specific to avoid capturing the first (Active) value
  const pendingRegex = new RegExp(`^\\s*\\d+\\s+([\\d]+)`);
  const pendingMatch = valuesText.match(pendingRegex);
  result.pending = pendingMatch ? parseInt(pendingMatch[1], 10) : 0;
  
  // Add extra debugging for pending values
  console.log(`For ${poolName}: Active=${result.active}, Pending=${result.pending}`);
  
  // Extract Completed value - typically the third number after Active and Pending
  // Look for a pattern of "N/A" followed by a number
  const completedMatch = valuesText.match(/N\/A\s+(\d+)/);
  result.completed = completedMatch ? parseInt(completedMatch[1], 10) : 0;

  // If the above pattern didn't work, try to get the third number in the line 
  if (result.completed === 0) {
    const thirdNumberMatch = valuesText.match(/^\s*\d+\s+\d+\s+(?:N\/A\s+)?(\d+)/);
    if (thirdNumberMatch) {
      result.completed = parseInt(thirdNumberMatch[1], 10);
    }
  }
  
  // Extract Blocked value - typically the second-to-last number
  // Get all numbers in the line
  const allNumbers: number[] = [];
  let numMatch;
  const numRegex = /\b(\d+)\b/g;
  while ((numMatch = numRegex.exec(valuesText)) !== null) {
    allNumbers.push(parseInt(numMatch[1], 10));
  }
  
  if (allNumbers.length >= 2) {
    result.blocked = allNumbers[allNumbers.length - 2];
  } else {
    result.blocked = 0;
  }
  
  // Extract All Time Blocked - typically the last number
  if (allNumbers.length >= 1) {
    result.alltimeblocked = allNumbers[allNumbers.length - 1];
  } else {
    result.alltimeblocked = 0;
  }
  
  // Create a mapping between our internal keys and the expected metric keys
  const metricsMapping: Record<string, string> = {
    'active': 'active',
    'pending': 'pending',
    'completed': 'completed',
    'blocked': 'blocked',
    'alltimeblocked': 'alltimeblocked'
  };
  
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