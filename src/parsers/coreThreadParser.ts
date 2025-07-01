import { ParsedTimeSeries } from "../types";

export function parseCoreThread(content: string): ParsedTimeSeries {
  const lines = content.split('\n');
  const timestamps: string[] = [];
  const series: { [metric: string]: number[] } = {};
  
  const allThreadNames = new Set<string>();
  
  // First pass: Collect all timestamps and unique thread metric names
  lines.forEach(line => {
    const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+\d{4})/);
    if (timestampMatch) {
      const timestamp = timestampMatch[1];
      if (!timestamps.includes(timestamp)) {
        timestamps.push(timestamp);
      }
    } else if (line.includes("CoreThread-")) {
      const threadMatch = line.match(/user=([\d.]+)%.* - (CoreThread-\d+)/);
      if (threadMatch) {
        const threadName = threadMatch[2];
        const metricName = `${threadName} %user`;
        allThreadNames.add(metricName);
      }
    }
  });

  // Initialize all series with 0s for each timestamp
  allThreadNames.forEach(metricName => {
    series[metricName] = new Array(timestamps.length).fill(0);
  });
  
  let currentTimestamp = "";
  // Second pass: Populate the series with actual values
  lines.forEach(line => {
    const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+\d{4})/);
    if (timestampMatch) {
      currentTimestamp = timestampMatch[1];
    } else if (currentTimestamp && line.includes("CoreThread-")) {
      const threadMatch = line.match(/user=([\d.]+)%.* - (CoreThread-\d+)/);
      if (threadMatch) {
        const userPercent = parseFloat(threadMatch[1]);
        const threadName = threadMatch[2];
        const metricName = `${threadName} %user`;
        
        const timestampIndex = timestamps.indexOf(currentTimestamp);
        if (timestampIndex !== -1) {
          series[metricName][timestampIndex] = userPercent;
        }
      }
    }
  });

  return {
    timestamps,
    series
  };
} 