import { ParsedTimeSeries } from "../types";

export interface ThreadStats {
  id: string;
  name: string;
  state: string;
  cpuUsage: number;
  allocRate: number;
}

export interface ProcessSummary {
  timestamp: number;
  cpuUsage: number;
  heapAllocRate: number;
  threads: ThreadStats[];
}

function parseAllocRate(str: string): number {
  // Handles values like '11mb/s', '2361kb/s', '1423b/s'
  const match = str.trim().match(/([\d.]+)\s*(mb|kb|b)\/s/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  let bytes = 0;
  if (unit === 'mb') bytes = value * 1024 * 1024;
  else if (unit === 'kb') bytes = value * 1024;
  else if (unit === 'b') bytes = value;
  // Filter out values above 10,000 MB/s (10,000 * 1024 * 1024 bytes)
  if (bytes > 10000 * 1024 * 1024) return 0;
  return bytes;
}

function parseJvmThreadDump(content: string): ProcessSummary[] {
  const blocks = content.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  const results: ProcessSummary[] = [];

  for (const block of blocks) {
    const lines = block.split(/\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 6) continue;

    // Parse header
    const timestampMatch = lines[0].match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+\d{4})/);
    const cpuMatch = lines[1].match(/process cpu=([\d.]+)%/);
    const heapAllocMatch = lines[5].match(/heap allocation rate ([^\s]+)/i);
    if (!timestampMatch || !cpuMatch || !heapAllocMatch) continue;

    const timestamp = Date.parse(timestampMatch[1]);
    const cpuUsage = parseFloat(cpuMatch[1]);
    const heapAllocRate = parseAllocRate(heapAllocMatch[1]);

    // Parse threads
    const threads: ThreadStats[] = [];
    for (let i = 6; i < lines.length; i++) {
      const threadLine = lines[i];
      const threadMatch = threadLine.match(/^\[(\d+)\] user=\s*([\-\d.]+)% sys=\s*([\-\d.]+)% alloc=\s*([^\s]+) - (.+)$/);
      if (threadMatch) {
        const id = threadMatch[1];
        const userCpu = parseFloat(threadMatch[2]);
        const sysCpu = parseFloat(threadMatch[3]);
        const allocRate = parseAllocRate(threadMatch[4]);
        const name = threadMatch[5].trim();
        // State is not present, so we can set it as 'UNKNOWN' or parse from name if needed
        threads.push({
          id,
          name,
          state: 'UNKNOWN',
          cpuUsage: userCpu + sysCpu,
          allocRate,
        });
      }
    }

    results.push({
      timestamp,
      cpuUsage,
      heapAllocRate,
      threads,
    });
  }

  return results;
}

// Convert ProcessSummary[] to ParsedTimeSeries for compatibility with the existing app
export function parseSwissJavaKnife(content: string): ParsedTimeSeries {
  const processData = parseJvmThreadDump(content);
  
  if (!processData.length) {
    return { timestamps: [], series: {} };
  }

  // Sort by timestamp to ensure chronological order
  processData.sort((a, b) => a.timestamp - b.timestamp);
  
  // Extract timestamps
  const timestamps = processData.map(sample => 
    new Date(sample.timestamp).toISOString()
  );
  
  // Initialize series object with process-level metrics
  const series: { [metric: string]: number[] } = {
    "Process CPU Usage (%)": processData.map(sample => sample.cpuUsage),
    "Heap Allocation Rate (bytes/s)": processData.map(sample => sample.heapAllocRate),
  };
  
  // Get unique thread IDs across all samples
  const threadIds = new Set<string>();
  processData.forEach(sample => {
    sample.threads.forEach(thread => {
      threadIds.add(thread.id);
    });
  });
  
  // Create series for each thread's CPU usage and allocation rate
  threadIds.forEach(threadId => {
    // Find a sample that has this thread to get the name
    const threadInfo = processData
      .flatMap(sample => sample.threads)
      .find(thread => thread.id === threadId);
    
    if (threadInfo) {
      const threadName = threadInfo.name;
      
      // Initialize CPU usage and allocation rate series for this thread
      const cpuUsageSeries: number[] = [];
      const allocRateSeries: number[] = [];
      
      // Populate series with data, using 0 for missing values
      processData.forEach(sample => {
        const threadData = sample.threads.find(t => t.id === threadId);
        cpuUsageSeries.push(threadData ? threadData.cpuUsage : 0);
        allocRateSeries.push(threadData ? threadData.allocRate : 0);
      });
      
      // Add to overall series object
      series[`Thread ${threadId} CPU (%) - ${threadName}`] = cpuUsageSeries;
      series[`Thread ${threadId} Alloc (bytes/s) - ${threadName}`] = allocRateSeries;
    }
  });
  
  return {
    timestamps,
    series,
  };
} 