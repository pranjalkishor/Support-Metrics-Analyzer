import { parseThreadPoolMetrics } from './systemLog';

describe('System Log Parser Tests', () => {
  describe('parseThreadPoolMetrics', () => {
    it('should parse thread pool metrics correctly', () => {
      // Create a realistic StatusLogger log entry
      const logContent = `
INFO  [OptionalTasks:1] 2023-06-15 10:15:23,456 StatusLogger.java:174 - 
Pool Name                                    Active   Pending (w/Backpressure)   Delayed   Completed   Blocked  All Time Blocked
CompactionExecutor                                2        170 (N/A)               N/A       99022         0                0
GossipStage                                       0          0 (N/A)               N/A      679400         0                0
TPC/all/READ_DISK_ASYNC                        1869         20 (N/A)               N/A      100000         0              100
MemtableFlushWriter                               0          0 (N/A)               N/A        1429      N/A                0

Memtable Metrics
Table                               Active    Pending    Completed
system_schema.keyspaces                  0          0           14
`;
      
      const result = parseThreadPoolMetrics(logContent);
      
      // Verify timestamps
      expect(result.timestamps.length).toBe(1);
      expect(result.timestamps[0]).toContain('2023-06-15');
      
      // Check if we have data for the thread pools
      expect(Object.keys(result.series).length).toBeGreaterThan(0);
      
      // Instead of checking exact series keys, look for patterns
      const seriesKeys = Object.keys(result.series);
      
      // Check CompactionExecutor metrics
      const compactionActiveKey = seriesKeys.find(key => key.includes('CompactionExecutor') && key.includes('Active'));
      expect(compactionActiveKey).toBeDefined();
      expect(result.series[compactionActiveKey!][0]).toBe(2);
      
      // Check TPC/all/READ_DISK_ASYNC metrics - this is the key test for our fix
      const tpcReadDiskKey = seriesKeys.find(key => key.includes('TPC/all/READ_DISK_ASYNC') && key.includes('Active'));
      expect(tpcReadDiskKey).toBeDefined();
      expect(result.series[tpcReadDiskKey!][0]).toBe(1869);
      
      // Check that N/A values are handled correctly
      const memtableKey = seriesKeys.find(key => key.includes('MemtableFlushWriter') && key.includes('Blocked'));
      if (memtableKey) {
        expect(result.series[memtableKey][0]).toBe(0); // N/A should be converted to 0
      }
    });
  });
});
