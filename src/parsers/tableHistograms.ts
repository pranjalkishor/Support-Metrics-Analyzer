import { ParsedTimeSeries } from "../types";

export function parseTableHistograms(content: string): ParsedTimeSeries {
  console.log("Starting tablehistograms parsing with improved Max handling");
  
  const lines = content.split("\n");
  const timestamps: string[] = [];
  const series: { [metric: string]: number[] } = {};
  
  // Define expected columns
  const OPERATIONS = [
    "SSTables", "Write Latency", "Read Latency", 
    "Partition Size", "Cell Count"
  ];
  
  // Define expected percentiles
  const PERCENTILES = ["50%", "75%", "95%", "98%", "99%", "Min", "Max"];
  
  // Create a map for case-insensitive percentile matching
  const percentileMap = new Map(
    PERCENTILES.map(p => [p.toLowerCase(), p])
  );
  
  let currentTimestamp = "";
  let currentTable = "";
  
  // First pass: collect all timestamps
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Match timestamp lines
    if (line.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
      if (!timestamps.includes(line)) {
        timestamps.push(line);
      }
    }
  }
  
  console.log(`Found ${timestamps.length} timestamps`);
  
  // Second pass: extract data for each timestamp
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Match timestamp lines
    if (line.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
      currentTimestamp = line;
      continue;
    }
    
    // Match table names (ends with "histograms")
    if (line.endsWith("histograms")) {
      currentTable = line.replace("histograms", "").trim();
      console.log(`Processing table: ${currentTable}`);
      
      // Skip header and unit lines
      i += 2;
      
      // Process rows until we find the next timestamp or table
      const foundPercentiles = new Set<string>();
      let rowsProcessed = 0;
      
      while (i + rowsProcessed < lines.length) {
        const pLine = lines[i + rowsProcessed].trim();
        
        // Check if we've reached a new section
        if (!pLine || 
            pLine.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/) || 
            pLine.endsWith("histograms")) {
          break;
        }
        
        // Split line into columns and get the percentile
        const parts = pLine.split(/\s+/);
        if (parts.length < 2) {
          rowsProcessed++;
          continue;
        }
        
        // Get the percentile from the first column, normalize it
        let percentile = parts[0];
        
        // Map to standard percentile name if needed
        const standardPercentile = percentileMap.get(percentile.toLowerCase());
        if (standardPercentile) {
          percentile = standardPercentile;
          foundPercentiles.add(percentile);
          
          // Process each operation column
          for (let colIndex = 0; colIndex < OPERATIONS.length && colIndex + 1 < parts.length; colIndex++) {
            const value = parts[colIndex + 1]; // +1 to skip percentile column
            
            // Skip N/A values
            if (value === "N/A" || value === "NaN") continue;
            
            const numValue = parseFloat(value);
            if (isNaN(numValue)) continue;
            
            // Create the metric key
            const metricKey = `${currentTable} | ${OPERATIONS[colIndex]} | ${percentile}`;
            
            // Initialize array if needed
            if (!series[metricKey]) {
              series[metricKey] = new Array(timestamps.length).fill(NaN);
            }
            
            // Find timestamp index and update value
            const timestampIndex = timestamps.indexOf(currentTimestamp);
            if (timestampIndex !== -1) {
              series[metricKey][timestampIndex] = numValue;
            }
          }
        } else {
          console.log(`Unknown percentile format: "${percentile}" in line: "${pLine}"`);
        }
        
        rowsProcessed++;
      }
      
      // Log which percentiles we found and didn't find
      const missingPercentiles = PERCENTILES.filter(p => !foundPercentiles.has(p));
      if (missingPercentiles.length > 0) {
        console.warn(`For table ${currentTable}, missing percentiles: ${missingPercentiles.join(', ')}`);
      }
      
      // Skip the rows we've processed
      i += rowsProcessed - 1;
    }
  }
  
  // Add list of found metrics for each percentile for debugging
  PERCENTILES.forEach(percentile => {
    const metricsWithPercentile = Object.keys(series).filter(key => key.endsWith(` | ${percentile}`));
    console.log(`Metrics with ${percentile}: ${metricsWithPercentile.length}`);
    if (metricsWithPercentile.length === 0) {
      console.warn(`No metrics found with percentile: ${percentile}`);
    }
  });
  
  console.log(`Processed ${Object.keys(series).length} metrics`);
  
  // Debug: Check data consistency
  if (Object.keys(series).length > 0) {
    const firstMetric = Object.keys(series)[0];
    console.log(`Sample metric: ${firstMetric}`);
    console.log(`Data points: ${series[firstMetric].length}`);
    console.log(`Timestamps: ${timestamps.length}`);
    console.log(`First few values:`, series[firstMetric].slice(0, 5));
    
    // Check if all arrays have the correct length
    const wrongLength = Object.keys(series).filter(key => 
      series[key].length !== timestamps.length
    );
    
    if (wrongLength.length > 0) {
      console.error(`Found ${wrongLength.length} metrics with wrong array length`);
      // Fix any inconsistencies
      wrongLength.forEach(key => {
        const currentLength = series[key].length;
        if (currentLength < timestamps.length) {
          // Add NaN values to reach correct length
          series[key] = [
            ...series[key],
            ...new Array(timestamps.length - currentLength).fill(NaN)
          ];
        } else if (currentLength > timestamps.length) {
          // Trim extra values
          series[key] = series[key].slice(0, timestamps.length);
        }
      });
    }
  } else {
    console.error("No metrics found in the input file");
  }
  
  // Return the parsed data
  return { timestamps, series };
} 