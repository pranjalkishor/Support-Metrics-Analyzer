const fs = require('fs');
const path = require('path');

// Manual test of the thread pool parsing logic
function parseThreadPoolNames(logContent) {
  const lines = logContent.split('\n');
  const threadPools = [];
  
  console.log(`Processing ${lines.length} lines`);
  
  // Track multi-line format state
  let inStatusLogger174Section = false;
  let nextLineIsPoolName = false;
  
  // Find thread pool entries - look for StatusLogger lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Look for the new format (StatusLogger.java:174)
    if (line.includes("StatusLogger.java:174")) {
      inStatusLogger174Section = true;
      
      // Usually the Pool Name header is in the next line or two
      for (let j = 1; j < 3 && i + j < lines.length; j++) {
        const headerLine = lines[i + j].trim();
        if (headerLine.includes("Pool Name")) {
          // Skip ahead to the line after the header
          i += j + 1;
          nextLineIsPoolName = true;
          console.log("Found StatusLogger.java:174 header");
          break;
        }
      }
      continue;
    }
    
    // If we're in a 174 section and the next line is expected to be a pool name
    if (inStatusLogger174Section && nextLineIsPoolName) {
      // Extract pool name - it's usually at the beginning of the line
      // followed by a series of spaces, then metrics
      const poolNameMatch = line.match(/^(\S[\S\s]+?)(?:\s{2,}|$)/);
      
      if (poolNameMatch && !line.startsWith("INFO") && !line.startsWith("WARN")) {
        const poolName = poolNameMatch[1].trim();
        
        // Skip invalid pool names
        if (!poolName || poolName === "..." || poolName === "N/A" || 
            poolName.match(/^\d+$/) || poolName.length < 2) {
          // Skip metrics line that follows this pool
          i++;
          continue;
        }
        
        // Add to thread pool list if not already there
        if (!threadPools.includes(poolName)) {
          threadPools.push(poolName);
          console.log(`Found thread pool (174 format): ${poolName}`);
        }
        
        // Skip the metrics line that follows this pool name line
        i++;
      } 
      // Check if we've reached the end of the pool section
      else if (line.startsWith("INFO") || line.startsWith("WARN") || line === "") {
        nextLineIsPoolName = false;
        inStatusLogger174Section = false;
      }
      
      continue;
    }
    
    // Handle the original StatusLogger.java:51 format
    if (line.includes("StatusLogger.java:51")) {
      try {
        // Example: INFO [ScheduledTasks:1] 2024-04-11 13:47:59,901 StatusLogger.java:51 - ReadStage 1 0 3350878 0 0
        
        // Extract thread pool info after StatusLogger.java:51 -
        const contentMatch = line.match(/StatusLogger\.java:51\s+-\s+(.*)/);
        if (!contentMatch) {
          continue;
        }
        
        // Get just the thread pool content part
        const threadPoolContent = contentMatch[1].trim();
        
        // Extract the pool name - first non-whitespace word
        const poolNameMatch = threadPoolContent.match(/^(\S+)/);
        if (!poolNameMatch) {
          continue;
        }
        
        const poolName = poolNameMatch[1].trim();
        
        // Skip invalid pool names
        if (!poolName || poolName === "..." || poolName.match(/^\d+$/) || poolName.length < 2) {
          continue;
        }
        
        // Add to thread pool list if not already there
        if (!threadPools.includes(poolName)) {
          threadPools.push(poolName);
          console.log(`Found thread pool (51 format): ${poolName}`);
        }
      } catch (error) {
        console.error("Error processing line:", error);
      }
    }
  }
  
  return threadPools;
}

// Read the system.log file
fs.readFile('system.log', 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading log file:', err);
    return;
  }
  
  console.log('Log file read successfully, length:', data.length);
  
  // Parse thread pool names
  const threadPools = parseThreadPoolNames(data);
  
  console.log('Thread pools found:', threadPools.length);
  console.log('Thread pool names:', threadPools);
}); 