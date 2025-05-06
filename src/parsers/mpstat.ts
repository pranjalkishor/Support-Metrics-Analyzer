import { ParsedTimeSeries } from "../types";

export function parseMpstat(content: string): ParsedTimeSeries {
  const lines = content.split("\n");
  const timestamps: string[] = [];
  const series: { [metric: string]: number[] } = {};
  let currentTimestamp = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^\d{2}:\d{2}:\d{2}/.test(line)) {
      currentTimestamp = line.split(/\s+/)[0];
      timestamps.push(currentTimestamp);
      // Find header
      while (i < lines.length && !lines[i].includes("CPU")) i++;
      if (i >= lines.length) break;
      const header = lines[i].trim().split(/\s+/);
      // Next lines: data for each CPU
      let j = i + 1;
      while (j < lines.length && lines[j].trim() && !/^\d{2}:\d{2}:\d{2}/.test(lines[j])) {
        const row = lines[j].trim().split(/\s+/);
        const cpu = row[1];
        for (let k = 2; k < row.length; k++) {
          const metric = `CPU${cpu} ${header[k]}`;
          if (!series[metric]) series[metric] = Array(timestamps.length - 1).fill(NaN);
          series[metric].push(Number(row[k]));
        }
        j++;
      }
      Object.keys(series).forEach(metric => {
        if (series[metric].length < timestamps.length) {
          series[metric].push(NaN);
        }
      });
      i = j - 1;
    }
  }
  return { timestamps, series };
}
