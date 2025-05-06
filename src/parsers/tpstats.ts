import { ParsedTimeSeries } from "../types";

export function parseTpstats(content: string): ParsedTimeSeries {
  const lines = content.split("\n");
  const timestamps: string[] = [];
  const series: { [metric: string]: number[] } = {};
  let currentTimestamp = "";
  
  // Hardcoded known headers from tpstats format
  const KNOWN_HEADERS = [
    "Active", "Pending", "Backpressure", "Delayed", 
    "Shared", "Stolen", "Completed", "Blocked", "All time blocked"
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(line)) {
      currentTimestamp = line;
      timestamps.push(currentTimestamp);

      // Find the line with "Pools" and skip to the next line
      while (i < lines.length && !lines[i].includes("Pools")) i++;
      if (i >= lines.length) break;
      i++; // Skip the header line entirely since we're using hardcoded headers
      
      let j = i + 1; // Start from the first data row
      while (
        j < lines.length &&
        lines[j].trim() &&
        !lines[j].includes("Meters") &&
        !lines[j].startsWith("Messages")
      ) {
        const line = lines[j].trim();
        
        // Extract pool name and values
        const parts = line.split(/\s{2,}/);
        if (parts.length < 2) {
          j++;
          continue;
        }
        
        const poolName = parts[0].trim();
        
        // Map the values to our known headers
        for (let k = 0; k < KNOWN_HEADERS.length && (k + 1) < parts.length; k++) {
          const metricName = `${poolName} ${KNOWN_HEADERS[k]}`;
          const value = parts[k + 1] === "N/A" ? NaN : Number(parts[k + 1]);
          
          if (!series[metricName]) {
            series[metricName] = Array(timestamps.length - 1).fill(NaN);
          }
          
          series[metricName].push(value);
        }
        
        j++;
      }
      
      // Fill missing metrics for this timestamp
      Object.keys(series).forEach(metric => {
        if (series[metric].length < timestamps.length) {
          series[metric].push(NaN);
        }
      });
      
      i = j;
    }
  }
  
  // DEBUG: Add more info for diagnosing
  console.log('PARSED METRICS (NEW):', Object.keys(series).slice(0, 10));
  
  return { timestamps, series };
}
