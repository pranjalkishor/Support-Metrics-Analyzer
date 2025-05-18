import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { ParsedTimeSeries } from '../types';
import './StatusLoggerVisualizer.css';

interface StatusLoggerVisualizerProps {
  threadPoolMetricsData: ParsedTimeSeries;
}

export const StatusLoggerVisualizer: React.FC<StatusLoggerVisualizerProps> = ({ threadPoolMetricsData }) => {
  // States for UI controls
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [showPoolTypes, setShowPoolTypes] = useState<Record<string, boolean>>({
    'standard': true,
    'tpc': true
  });
  const [isAutoScale, setIsAutoScale] = useState<boolean>(true);
  const [yAxisScale, setYAxisScale] = useState<number | null>(null);
  
  // Selected pools with metrics - this directly controls what's plotted
  const [selectedPoolsWithMetrics, setSelectedPoolsWithMetrics] = useState<{
    pool: string;
    metrics: string[];
  }[]>([]);
  
  // Available metrics that can be selected for thread pools
  const AVAILABLE_METRICS = ['Active', 'Pending', 'Completed', 'Blocked', 'All Time Blocked'];

  // Extract available thread pools and metrics
  const { threadPools, poolCategories } = useMemo(() => {
    const pools: string[] = [];
    const categories: Record<string, string[]> = {
      'standard': [],
      'tpc': []
    };
    
    if (threadPoolMetricsData?.metadata?.threadPools) {
      pools.push(...threadPoolMetricsData.metadata.threadPools);
      
      // Categorize pools
      threadPoolMetricsData.metadata.threadPools.forEach((pool: string) => {
        if (pool.startsWith('TPC/')) {
          categories['tpc'].push(pool);
        } else {
          categories['standard'].push(pool);
        }
      });
    } else if (threadPoolMetricsData?.series) {
      // Extract pool names from series keys if metadata is not available
      Object.keys(threadPoolMetricsData.series).forEach(key => {
        const parts = key.split(': ');
        if (parts.length === 2 && !pools.includes(parts[0])) {
          pools.push(parts[0]);
          
          // Categorize the pool
          if (parts[0].startsWith('TPC/')) {
            if (!categories['tpc'].includes(parts[0])) {
              categories['tpc'].push(parts[0]);
            }
          } else {
            if (!categories['standard'].includes(parts[0])) {
              categories['standard'].push(parts[0]);
            }
          }
        }
      });
    }
    
    return { threadPools: pools, poolCategories: categories };
  }, [threadPoolMetricsData]);

  // Filtered pools based on search and category selection
  const filteredPools = useMemo(() => {
    let filtered = [...threadPools];
    
    // Filter by pool type
    filtered = filtered.filter(pool => {
      if (pool.startsWith('TPC/')) {
        return showPoolTypes['tpc'];
      }
      return showPoolTypes['standard'];
    });
    
    // Filter by search term if provided
    if (searchFilter) {
      filtered = filtered.filter(pool => 
        pool.toLowerCase().includes(searchFilter.toLowerCase())
      );
    }
    
    return filtered.sort(); // Sort alphabetically
  }, [threadPools, searchFilter, showPoolTypes]);

  // Prepare chart data for each selected pool
  const poolChartData = useMemo(() => {
    if (!threadPoolMetricsData?.timestamps || !threadPoolMetricsData?.series) {
      return {};
    }
    
    const result: Record<string, any[]> = {};
    
    // Prepare data for each pool
    selectedPoolsWithMetrics.forEach(selection => {
      if (selection.metrics.length === 0) return;
      
      const poolData = threadPoolMetricsData.timestamps.map((timestamp, index) => {
        const dataPoint: Record<string, any> = {
          timestamp,
          formattedTime: new Date(timestamp).toLocaleString()
        };
        
        // Add value for each selected metric for this pool
        selection.metrics.forEach(metric => {
          const seriesKey = `${selection.pool}: ${metric}`;
          if (threadPoolMetricsData.series[seriesKey]) {
            dataPoint[metric] = threadPoolMetricsData.series[seriesKey][index];
          }
        });
        
        return dataPoint;
      });
      
      result[selection.pool] = poolData;
    });
    
    return result;
  }, [threadPoolMetricsData, selectedPoolsWithMetrics]);

  // Calculate max y-axis value for each pool
  const poolMaxValues = useMemo(() => {
    if (!threadPoolMetricsData?.series) return {};
    
    const result: Record<string, number> = {};
    
    selectedPoolsWithMetrics.forEach(selection => {
      let poolMax = 0;
      
      selection.metrics.forEach(metric => {
        const seriesKey = `${selection.pool}: ${metric}`;
        if (threadPoolMetricsData.series[seriesKey]) {
          const metricMax = Math.max(...threadPoolMetricsData.series[seriesKey]);
          poolMax = Math.max(poolMax, metricMax);
        }
      });
      
      // Add a 10% margin
      result[selection.pool] = Math.ceil(poolMax * 1.1);
    });
    
    return result;
  }, [threadPoolMetricsData, selectedPoolsWithMetrics]);

  // Example log from the raw data
  const exampleLog = useMemo(() => {
    if (threadPoolMetricsData?.timestamps?.length > 0) {
      const selectedPoolNames = selectedPoolsWithMetrics.map(selection => selection.pool);
      return `INFO  [OptionalTasks:1] ${new Date(threadPoolMetricsData.timestamps[0]).toISOString().replace('T', ' ').slice(0, 19)}  StatusLogger.java:174 -
Pool Name                                     Active      Pending (w/Backpressure)   Delayed      Completed   Blocked  All Time Blocked
${selectedPoolNames.map(pool => {
  const active = threadPoolMetricsData.series[`${pool}: Active`]?.[0] || 0;
  const pending = threadPoolMetricsData.series[`${pool}: Pending`]?.[0] || 0;
  const blocked = threadPoolMetricsData.series[`${pool}: Blocked`]?.[0] || 0;
  const allTimeBlocked = threadPoolMetricsData.series[`${pool}: All Time Blocked`]?.[0] || 0;
  return `${pool.padEnd(40)} ${String(active).padStart(5)}        ${String(pending).padStart(5)} (N/A)       N/A              0    ${String(blocked).padStart(5)}        ${String(allTimeBlocked).padStart(15)}`;
}).join('\n')}`;
    }
    return '';
  }, [threadPoolMetricsData, selectedPoolsWithMetrics]);

  // Toggle a thread pool's selection
  const togglePool = (pool: string) => {
    setSelectedPoolsWithMetrics(prev => {
      // Check if the pool is already selected
      const existingIndex = prev.findIndex(item => item.pool === pool);
      
      if (existingIndex >= 0) {
        // Remove the pool
        return prev.filter(item => item.pool !== pool);
      } else {
        // Add the pool with default metrics
        return [...prev, { pool, metrics: ['Active'] }];
      }
    });
  };

  // Toggle a metric for a specific pool
  const toggleMetric = (pool: string, metric: string) => {
    setSelectedPoolsWithMetrics(prev => {
      return prev.map(item => {
        if (item.pool === pool) {
          // Find if this metric is already selected
          const isMetricSelected = item.metrics.includes(metric);
          
          if (isMetricSelected) {
            // Remove the metric
            const newMetrics = item.metrics.filter(m => m !== metric);
            // If no metrics left, return null to filter out the pool
            return newMetrics.length > 0 ? { ...item, metrics: newMetrics } : null;
          } else {
            // Add the metric
            return { ...item, metrics: [...item.metrics, metric] };
          }
        }
        return item;
      }).filter(Boolean) as { pool: string, metrics: string[] }[];
    });
  };

  // Remove a pool from the selection
  const removePool = (pool: string) => {
    setSelectedPoolsWithMetrics(prev => 
      prev.filter(item => item.pool !== pool)
    );
  };

  // Toggle a pool category
  const togglePoolType = (type: string) => {
    setShowPoolTypes(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  // Clear all selected pools
  const clearSelection = () => {
    setSelectedPoolsWithMetrics([]);
  };

  // Helper to select top active pools
  const selectTopActivePools = () => {
    if (!threadPoolMetricsData?.series) return;
    
    // Find pools with highest active values
    const poolsWithActive: {pool: string, maxActive: number}[] = [];
    
    threadPools.forEach(pool => {
      const seriesKey = `${pool}: Active`;
      if (threadPoolMetricsData.series[seriesKey]) {
        const maxActive = Math.max(...threadPoolMetricsData.series[seriesKey]);
        poolsWithActive.push({ pool, maxActive });
      }
    });
    
    // Sort by maxActive (descending) and take top 5
    poolsWithActive.sort((a, b) => b.maxActive - a.maxActive);
    const topPools = poolsWithActive.slice(0, 5).map(item => ({
      pool: item.pool,
      metrics: ['Active'] // Default to just the Active metric
    }));
    
    setSelectedPoolsWithMetrics(topPools);
  };

  // Handle scaling options
  const toggleAutoScale = () => {
    setIsAutoScale(!isAutoScale);
  };

  // Check if a pool is selected
  const isPoolSelected = (pool: string): boolean => {
    return selectedPoolsWithMetrics.some(item => item.pool === pool);
  };
  
  // Check if a metric is selected for a pool
  const isMetricSelected = (pool: string, metric: string): boolean => {
    const poolSelection = selectedPoolsWithMetrics.find(item => item.pool === pool);
    return poolSelection ? poolSelection.metrics.includes(metric) : false;
  };

  if (!threadPoolMetricsData || !threadPoolMetricsData.timestamps || threadPoolMetricsData.timestamps.length === 0) {
    return <div className="status-logger-visualizer empty-state">No Status Logger thread pool data available.</div>;
  }

  return (
    <div className="status-logger-visualizer">
      <h2>Thread Pool Metrics</h2>
      
      {/* Summary */}
      <div className="summary-info">
        <h3>Thread Pool Status Samples</h3>
        <p className="summary-count">{threadPoolMetricsData.timestamps.length}</p>
        <div className="pool-summary">
          <div>Total Thread Pools: <span className="highlight">{threadPools.length}</span></div>
          <div>Standard Pools: <span className="highlight">{poolCategories.standard.length}</span></div>
          <div>TPC Pools: <span className="highlight">{poolCategories.tpc.length}</span></div>
        </div>
      </div>
      
      {/* Controls */}
      <div className="controls-panel">
        <div className="filter-row">
          <div className="filter-group">
            <label className="filter-label">Pool Types:</label>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={showPoolTypes.standard} 
                  onChange={() => togglePoolType('standard')}
                />
                Standard
              </label>
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={showPoolTypes.tpc} 
                  onChange={() => togglePoolType('tpc')}
                />
                TPC
              </label>
            </div>
          </div>
          
          <div className="filter-group">
            <label className="filter-label">Search:</label>
            <input 
              type="text" 
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter thread pools..."
              className="search-input"
            />
          </div>
          
          <div className="filter-group">
            <label className="filter-label">Y-Axis:</label>
            <div className="scale-controls">
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={isAutoScale} 
                  onChange={toggleAutoScale}
                /> 
                Auto-scale
              </label>
            </div>
          </div>
          
          <div className="action-buttons">
            <button onClick={clearSelection} className="clear-button">
              Clear All
            </button>
            <button onClick={selectTopActivePools} className="top-button">
              Show Top Active Pools
            </button>
          </div>
        </div>
        
        {/* Thread Pool Selection */}
        <div className="thread-pool-selection">
          <div className="thread-pool-list">
            {filteredPools.map(pool => (
              <div 
                key={pool} 
                className={`pool-item ${isPoolSelected(pool) ? 'selected' : ''}`}
                onClick={() => togglePool(pool)}
              >
                <div className="pool-name">
                  <input 
                    type="checkbox" 
                    checked={isPoolSelected(pool)}
                    onChange={() => {}} // Handled by the div click
                    onClick={e => e.stopPropagation()}
                  />
                  <span>{pool}</span>
                </div>
                
                {isPoolSelected(pool) && (
                  <div className="metric-options" onClick={e => e.stopPropagation()}>
                    {AVAILABLE_METRICS.map(metric => (
                      <label key={metric} className="metric-option">
                        <input 
                          type="checkbox"
                          checked={isMetricSelected(pool, metric)}
                          onChange={() => toggleMetric(pool, metric)}
                        />
                        {metric}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Charts - One per thread pool */}
      {selectedPoolsWithMetrics.length === 0 ? (
        <div className="no-selection-message">
          Select thread pools to visualize data
        </div>
      ) : (
        <div className="charts-container">
          {selectedPoolsWithMetrics.map((poolSelection, index) => (
            <div key={poolSelection.pool} className="individual-chart-container">
              <div className="chart-header">
                <h3>{poolSelection.pool}</h3>
                <button 
                  className="remove-chart-button" 
                  onClick={() => removePool(poolSelection.pool)}
                >
                  &times;
                </button>
              </div>
              
              {poolSelection.metrics.length === 0 ? (
                <div className="no-metrics-message">
                  Select metrics for this thread pool
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart
                    data={poolChartData[poolSelection.pool]}
                    margin={{ top: 10, right: 20, left: 10, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="formattedTime" 
                      tick={{ fontSize: 10 }} 
                      angle={-45} 
                      textAnchor="end"
                      height={50}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      domain={isAutoScale ? ['auto', 'auto'] : [0, poolMaxValues[poolSelection.pool] || 'auto']}
                    />
                    <Tooltip 
                      formatter={(value, name) => [value, name]}
                      labelFormatter={(label) => `Time: ${label}`}
                    />
                    <Legend />
                    <ReferenceLine y={0} stroke="#666" />
                    
                    {poolSelection.metrics.map((metric, metricIndex) => (
                      <Line 
                        key={metric}
                        type="monotone" 
                        dataKey={metric}
                        name={metric}
                        stroke={getColor(metricIndex)}
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        activeDot={{ r: 5 }}
                        connectNulls={true}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Example Log */}
      <div className="example-message">
        <h3>Example Log Format</h3>
        <pre>
          {exampleLog}
        </pre>
      </div>
    </div>
  );
};

// Helper function to get a color for a line
function getColor(index: number): string {
  const colors = [
    '#3A36DB', // DataStax blue
    '#FF5C35', // DataStax orange
    '#22C55E', // Green
    '#8884d8', // Purple
    '#FF8042', // Orange
    '#00C49F', // Teal
    '#FFBB28', // Yellow
    '#0088FE', // Blue
    '#FF6B6B', // Red
    '#82CA9D', // Light green
    '#8DD1E1', // Light blue
    '#A4DE6C', // Lime green
    '#D0ED57', // Yellow green
    '#FFC658', // Gold
    '#FF8C00', // Dark orange
  ];
  
  return colors[index % colors.length];
} 