export interface ParsedTimeSeries {
  timestamps: string[];
  series: { [metric: string]: number[] };
}
