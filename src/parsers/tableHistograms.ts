import { ParsedTimeSeries } from "../types";

export function parseTableHistograms(content: string): ParsedTimeSeries {
  console.log("Starting tablehistograms parsing with correct pattern matching");
  
  const lines = content.split("\n");
  const timestamps: string[] = [];
  const series: { [metric: string]: number[] } = {};
  
  // Define the expected column headers
  const columnTypes = [
    { name: "SSTables", operation: "SSTables" },
    { name: "Write Latency", operation: "Write Latency" },
    { name: "Read Latency", operation: "Read Latency" }, 
    { name: "Partition Size", operation: "Partition Size" },
    { name: "Cell Count", operation: "Cell Count" }
  ];
  
  let currentTimestamp = "";
  let timestampIndex = -1;
  
  // Process line by line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Detect timestamp line (ISO format with timezone)
    if (line.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
      currentTimestamp = line;
      if (!timestamps.includes(currentTimestamp)) {
        timestamps.push(currentTimestamp);
        timestampIndex = timestamps.length - 1;
        console.log(`Found timestamp #${timestampIndex}: ${currentTimestamp}`);
      } else {
        timestampIndex = timestamps.indexOf(currentTimestamp);
      }
      continue;
    }
    
    // Detect table name line (ends with "histograms")
    if (line.endsWith("histograms")) {
      const tableName = line.replace("histograms", "").trim();
      console.log(`Processing table: ${tableName}`);
      
      // Skip header and units lines
      i += 2;
      
      // Process the 7 percentile rows (50%, 75%, 95%, 98%, 99%, Min, Max)
      for (let p = 0; p < 7; p++) {
        if (i + p >= lines.length) break;
        
        const percentileLine = lines[i + p].trim();
        if (!percentileLine) continue;
        
        const parts = percentileLine.split(/\s+/);
        if (parts.length < 2) continue;
        
        const percentile = parts[0];
        console.log(`  Processing ${percentile} row`);
        
        // Process each metric column (starting from index 1)
        for (let c = 0; c < columnTypes.length && c + 1 < parts.length; c++) {
          const value = parts[c + 1];
          
          // Skip NaN values
          if (value === "NaN" || value === "N/A") continue;
          
          const numValue = parseFloat(value);
          if (isNaN(numValue)) continue;
          
          // Create metric name in the format "table | operation | percentile"
          const metricName = `${tableName} | ${columnTypes[c].operation} | ${percentile}`;
          
          // Initialize series if it doesn't exist
          if (!series[metricName]) {
            series[metricName] = Array(timestamps.length).fill(NaN);
            console.log(`    Created metric: ${metricName}`);
          }
          
          // Add the value at the current timestamp index
          series[metricName][timestampIndex - 1] = numValue;
        }
      }
      
      // Skip past the percentile rows
      i += 6;
      continue;
    }
  }
  
  console.log(`Extracted ${Object.keys(series).length} metrics across ${timestamps.length} timestamps`);
  
  // If no metrics were found, log an error
  if (Object.keys(series).length === 0) {
    console.error("No metrics were extracted from the file");
  }
  
  return { timestamps, series };
} 