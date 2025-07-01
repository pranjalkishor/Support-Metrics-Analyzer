import { ParsedTimeSeries } from "../types";

export function parseProxyHistograms(content: string): ParsedTimeSeries {
  console.log("Parsing proxy histograms with simplified robust parser");
  const lines = content.split("\n");
  const timestamps: string[] = [];
  const series: { [metric: string]: number[] } = {};

  let currentTimestamp = "";
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Match timestamp pattern (more lenient)
    if (line.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)) {
      currentTimestamp = line;
      if (!timestamps.includes(currentTimestamp)) {
        timestamps.push(currentTimestamp);
        console.log(`Found timestamp: ${currentTimestamp}`);
      }
      continue;
    }
    
    // Look for the header line with "Percentile" and various latencies
    if (line.includes("Percentile") && line.includes("Latency")) {
      const headerLine = line;
      console.log("Found header line:", headerLine);
      
      // Skip the micros line
      i++;
      
      // Now process the percentile rows (typically 7 of them: 50%, 75%, 95%, 98%, 99%, Min, Max)
      const percentiles = ["50%", "75%", "95%", "98%", "99%", "Min", "Max"];
      const prefixes = ["p50", "p75", "p95", "p98", "p99", "min", "max"];
      
      for (let p = 0; p < percentiles.length && i + p + 1 < lines.length; p++) {
        const percentileLine = lines[i + p + 1].trim();
        if (!percentileLine || !percentileLine.startsWith(percentiles[p])) continue;
        
        console.log(`Processing ${percentiles[p]} line:`, percentileLine);
        
        // Split the line into columns
        const parts = percentileLine.split(/\s+/);
        
        // Extract metrics for each column after the percentile
        // Column 1 = Read Latency, Column 2 = Write Latency, Column 3 = Range Latency, etc.
        const operations = [
          "Read Latency", 
          "Write Latency", 
          "Range Latency", 
          "CAS Read Latency", 
          "CAS Write Latency", 
          "View Write Latency"
        ];
        
        for (let op = 0; op < operations.length && op + 1 < parts.length; op++) {
          const value = parseFloat(parts[op + 1]);
          if (isNaN(value)) continue;
          
          const metricName = `${prefixes[p]} ${operations[op]}`;
          
          if (!series[metricName]) {
            series[metricName] = Array(timestamps.length - 1).fill(NaN);
          }
          
          // The value is already in microseconds, so no conversion is needed.
          series[metricName].push(value);
          console.log(`Added ${value}µs to ${metricName}`);
        }
      }
      
      // Skip past the percentile rows
      i += 8;
    }
  }
  
  // Ensure all series have the same length
  Object.keys(series).forEach(metric => {
    while (series[metric].length < timestamps.length) {
      series[metric].push(NaN);
    }
  });
  
  console.log(`Extracted ${Object.keys(series).length} metrics across ${timestamps.length} timestamps`);
  
  if (Object.keys(series).length === 0) {
    console.error("No metrics were extracted");
    
    // Create a dummy metric for debugging
    if (timestamps.length === 0) {
      timestamps.push(new Date().toISOString());
    }
    
    series["ERROR_NO_METRICS"] = [0];
  }
  
  return { timestamps, series };
}
