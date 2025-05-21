export interface ParsedTimeSeries {
  timestamps: string[];
  series: { [metric: string]: number[] };
  metadata?: any;
}

export interface NodeInfo {
  id: string;
  ip: string;
  name?: string;
  path?: string;
}

export interface NodeSystemLog {
  gcEvents?: ParsedTimeSeries;
  threadPoolMetrics?: ParsedTimeSeries;
  tombstoneWarnings?: ParsedTimeSeries;
  slowReads?: ParsedTimeSeries;
  priority?: number;
  dataQuality?: {
    hasGC: boolean;
    hasThreadPools: boolean;
    hasTombstones: boolean;
    hasSlowReads: boolean;
    gcCount: number;
    threadPoolCount: number;
    threadPoolMetricCount: number;
    tombstoneCount: number;
    slowReadsCount: number;
    totalTimestamps: number;
    score: number;
  };
  [key: string]: any; // Allow for additional properties
}

export interface ClusterData {
  nodes: {
    [nodeId: string]: {
      info: NodeInfo;
      systemLog?: NodeSystemLog;
      // Other log types could be added here
    };
  };
  mergedTimeline?: string[]; // Optional merged timeline across all nodes
  selectedNodes?: string[]; // Currently selected nodes for visualization
}
