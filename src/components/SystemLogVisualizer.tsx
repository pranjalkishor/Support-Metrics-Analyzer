import React, { useState, useEffect } from 'react';
import { parseSystemLog } from '../parsers/systemLog';
import { GCVisualizer } from './GCVisualizer';
import { TombstoneWarningsVisualizer } from './TombstoneWarningsVisualizer';
import { SlowReadsVisualizer } from './SlowReadsVisualizer';
import { StatusLoggerVisualizer } from './StatusLoggerVisualizer';
import './SystemLogVisualizer.css'; // We'll create this CSS file

interface SystemLogVisualizerProps {
  logContent: string;
}

export const SystemLogVisualizer: React.FC<SystemLogVisualizerProps> = ({ logContent }) => {
  const [activeTab, setActiveTab] = useState<'gc' | 'tombstones' | 'slowReads' | 'threadPools'>('gc');
  const [parsedData, setParsedData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!logContent) {
      console.log("SystemLogVisualizer: No log content provided");
      setLoading(false);
      setError("No log content provided. Please upload a system.log file.");
      return;
    }

    console.log("SystemLogVisualizer: Processing log content, size:", logContent.length);
    console.log("SystemLogVisualizer: First 100 chars:", logContent.substring(0, 100));

    try {
      // Parse system.log content
      const data = parseSystemLog(logContent);
      console.log("SystemLogVisualizer: Parse successful", {
        gcEvents: data.gcEvents?.timestamps?.length || 0,
        threadPoolMetrics: data.threadPoolMetrics?.timestamps?.length || 0,
        tombstoneWarnings: data.tombstoneWarnings?.timestamps?.length || 0,
        slowReads: data.slowReads?.timestamps?.length || 0
      });
      
      setParsedData(data);
      setError(null);

      // Automatically select the tab with the most data
      const tabCounts: Record<'gc' | 'threadPools' | 'tombstones' | 'slowReads', number> = {
        gc: data.gcEvents?.timestamps?.length || 0,
        threadPools: data.threadPoolMetrics?.timestamps?.length || 0,
        tombstones: data.tombstoneWarnings?.timestamps?.length || 0,
        slowReads: data.slowReads?.timestamps?.length || 0
      };
      
      // Find the tab with the most entries
      let maxTab: 'gc' | 'threadPools' | 'tombstones' | 'slowReads' = 'gc';
      let maxCount = 0;
      
      Object.entries(tabCounts).forEach(([tab, count]) => {
        if (count > maxCount) {
          maxCount = count;
          maxTab = tab as 'gc' | 'threadPools' | 'tombstones' | 'slowReads';
        }
      });
      
      setActiveTab(maxTab);
    } catch (err) {
      console.error('Error parsing system.log:', err);
      setError('Error parsing system.log file. Please check the log format.');
    } finally {
      setLoading(false);
    }
  }, [logContent]);

  if (loading) {
    return <div className="loading">Loading system log data...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (!parsedData) {
    return <div className="no-data">No system log data available.</div>;
  }

  // Check if we have any data in the different sections
  const hasGCData = parsedData.gcEvents && 
                   parsedData.gcEvents.timestamps && 
                   parsedData.gcEvents.timestamps.length > 0;
  
  // Enhanced thread pool data detection that checks multiple indicators
  const hasThreadPoolData = parsedData.threadPoolMetrics && (
    // Check timestamps
    (parsedData.threadPoolMetrics.timestamps && 
     parsedData.threadPoolMetrics.timestamps.length > 0) ||
    // Check series data 
    (parsedData.threadPoolMetrics.series && 
     Object.keys(parsedData.threadPoolMetrics.series).length > 0) ||
    // Check metadata for thread pools
    (parsedData.threadPoolMetrics.metadata && 
     parsedData.threadPoolMetrics.metadata.threadPools && 
     Array.isArray(parsedData.threadPoolMetrics.metadata.threadPools) && 
     parsedData.threadPoolMetrics.metadata.threadPools.length > 0)
  );

  const hasTombstoneData = parsedData.tombstoneWarnings && 
                          parsedData.tombstoneWarnings.timestamps && 
                          parsedData.tombstoneWarnings.timestamps.length > 0;
  
  const hasSlowReadsData = parsedData.slowReads && 
                          parsedData.slowReads.timestamps && 
                          parsedData.slowReads.timestamps.length > 0;

  return (
    <div className="system-log-visualizer">
      <h1>System Log Analysis</h1>
      
      <div className="stats-summary">
        <div className="stat-box">
          <h3>GC Events</h3>
          <p>{hasGCData ? parsedData.gcEvents.timestamps.length : 0}</p>
        </div>
        <div className="stat-box">
          <h3>Thread Pool Samples</h3>
          <p>{hasThreadPoolData ? parsedData.threadPoolMetrics.timestamps.length : 0}</p>
        </div>
        <div className="stat-box">
          <h3>Tombstone Warnings</h3>
          <p>{hasTombstoneData ? parsedData.tombstoneWarnings.timestamps.length : 0}</p>
        </div>
        <div className="stat-box">
          <h3>Slow Async Reads</h3>
          <p>{hasSlowReadsData ? parsedData.slowReads.timestamps.length : 0}</p>
        </div>
      </div>
      
      <div className="tab-navigation">
        <button 
          className={activeTab === 'gc' ? 'active' : ''} 
          onClick={() => setActiveTab('gc')}
          disabled={!hasGCData}
        >
          Garbage Collection
        </button>
        <button 
          className={activeTab === 'threadPools' ? 'active' : ''} 
          onClick={() => setActiveTab('threadPools')}
          disabled={!hasThreadPoolData}
        >
          Thread Pools
        </button>
        <button 
          className={activeTab === 'tombstones' ? 'active' : ''} 
          onClick={() => setActiveTab('tombstones')}
          disabled={!hasTombstoneData}
        >
          Tombstone Warnings
        </button>
        <button 
          className={activeTab === 'slowReads' ? 'active' : ''} 
          onClick={() => setActiveTab('slowReads')}
          disabled={!hasSlowReadsData}
        >
          Slow Async Reads
        </button>
      </div>
      
      <div className="tab-content">
        {activeTab === 'gc' && hasGCData && (
          <GCVisualizer gcData={parsedData.gcEvents} />
        )}
        
        {activeTab === 'threadPools' && hasThreadPoolData && (
          <StatusLoggerVisualizer threadPoolMetricsData={parsedData.threadPoolMetrics} />
        )}
        
        {activeTab === 'tombstones' && hasTombstoneData && (
          <TombstoneWarningsVisualizer tombstoneData={parsedData.tombstoneWarnings} />
        )}
        
        {activeTab === 'slowReads' && hasSlowReadsData && (
          <SlowReadsVisualizer slowReadsData={parsedData.slowReads} />
        )}
        
        {activeTab === 'gc' && !hasGCData && (
          <div className="no-data-message">No garbage collection events found in the log.</div>
        )}
        
        {activeTab === 'threadPools' && !hasThreadPoolData && (
          <div className="no-data-message">No StatusLogger thread pool metrics found in the log.</div>
        )}
        
        {activeTab === 'tombstones' && !hasTombstoneData && (
          <div className="no-data-message">No tombstone warnings found in the log.</div>
        )}
        
        {activeTab === 'slowReads' && !hasSlowReadsData && (
          <div className="no-data-message">No slow async reads found in the log.</div>
        )}
      </div>
    </div>
  );
}; 