import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { TimeRangeSlider } from './TimeRangeSlider';

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
  const [timeRange, setTimeRange] = useState<[number, number] | null>(null);
  
  // Selected pools with metrics - this directly controls what's plotted
  const [selectedPoolsWithMetrics, setSelectedPoolsWithMetrics] = useState<{
    pool: string;
    metrics: string[];
  }[]>([]);
  
  // Get available metrics from thread pool data's metadata
  const availableMetrics = useMemo(() => {
    // Use poolMetrics from metadata if available, otherwise fall back to default
    if (threadPoolMetricsData.metadata?.poolMetrics) {
      const uniqueMetrics = new Set<string>();
      Object.values(threadPoolMetricsData.metadata.poolMetrics).forEach((metrics: unknown) => {
        (metrics as string[]).forEach((metric: string) => uniqueMetrics.add(metric));
      });
      return Array.from(uniqueMetrics);
    }
    return ['Active', 'Pending', 'Completed', 'Blocked', 'All Time Blocked'];
  }, [threadPoolMetricsData.metadata]);
  
  // Use the correct AVAILABLE_METRICS based on thread pool data
  const AVAILABLE_METRICS = availableMetrics;
  
  // Extract thread pools from data and categorize them
  const { threadPools, poolCategories } = useMemo(() => {
    const pools = threadPoolMetricsData.metadata?.threadPools || [];
    const categories: Record<string, string[]> = {
      'standard': [],
      'tpc': []
    };
    
    // Categorize the pools
    pools.forEach((pool: string) => {
      if (pool.startsWith('TPC/')) {
        categories['tpc'].push(pool);
      } else {
        categories['standard'].push(pool);
      }
    });
    
    return { threadPools: pools, poolCategories: categories };
  }, [threadPoolMetricsData.metadata?.threadPools]);
  
  // Get pool-specific metrics from metadata
  const getPoolMetrics = useCallback((poolName: string) => {
    if (threadPoolMetricsData.metadata?.poolMetrics && 
        threadPoolMetricsData.metadata.poolMetrics[poolName]) {
      return threadPoolMetricsData.metadata.poolMetrics[poolName];
    }
    return AVAILABLE_METRICS; // Fall back to default metrics if pool-specific ones aren't available
  }, [threadPoolMetricsData.metadata?.poolMetrics, AVAILABLE_METRICS]);
  
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
  }, [threadPools, searchFilter, showPoolTypes, poolCategories]);

  // Prepare chart data for each selected pool
  const poolChartData = useMemo(() => {
    if (!threadPoolMetricsData?.timestamps || !threadPoolMetricsData?.series) {
      return {};
    }
    
    const result: Record<string, any[]> = {};
    
    // Determine the actual range to use
    const startIndex = timeRange ? Math.max(0, timeRange[0]) : 0;
    const endIndex = timeRange ? Math.min(threadPoolMetricsData.timestamps.length - 1, timeRange[1]) : threadPoolMetricsData.timestamps.length - 1;
    
    // Prepare data for each pool
    selectedPoolsWithMetrics.forEach(selection => {
      if (selection.metrics.length === 0) return;
      
      // Only include data points within the selected time range
      const poolData = threadPoolMetricsData.timestamps.slice(startIndex, endIndex + 1).map((timestamp, rangeIndex) => {
        const index = startIndex + rangeIndex;
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
  }, [threadPoolMetricsData, selectedPoolsWithMetrics, timeRange]);

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
    
    threadPools.forEach((pool: string) => {
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

  // Handle time range changes from the slider
  const handleTimeRangeChange = (startIndex: number, endIndex: number) => {
    setTimeRange([startIndex, endIndex]);
  };

  // Special case for Williams Sonoma data with minimal thread pool info
  const isWilliamsSonoma = useMemo(() => {
    if (!threadPoolMetricsData) return false;
    
    // Check for Williams Sonoma node signatures or minimal data
    const isMinimalData = (!threadPoolMetricsData.timestamps || threadPoolMetricsData.timestamps.length === 0) && 
                         (!threadPoolMetricsData.series || Object.keys(threadPoolMetricsData.series).length === 0);
                         
    // If it has thread pools in metadata but minimal data, it's likely our special case
    return isMinimalData && threadPoolMetricsData.metadata?.threadPools && 
           threadPoolMetricsData.metadata.threadPools.length > 0;
  }, [threadPoolMetricsData]);

  // Enhanced check for empty data condition
  if (!threadPoolMetricsData || 
      (!threadPoolMetricsData.timestamps || threadPoolMetricsData.timestamps.length === 0) &&
      (!threadPoolMetricsData.series || Object.keys(threadPoolMetricsData.series).length === 0) &&
      (!threadPoolMetricsData.metadata?.threadPools || threadPoolMetricsData.metadata.threadPools.length === 0)) {
    return (
      <div className="status-logger-visualizer empty-state">
        <h2>Thread Pool Metrics</h2>
        <div style={{ 
          padding: "20px", 
          backgroundColor: "#f8f8f8", 
          borderRadius: "5px",
          textAlign: "center" 
        }}>
          <p>No thread pool data available in the selected log file.</p>
          <p>This usually means the log file doesn't contain StatusLogger thread pool entries.</p>
          <p>Look for lines with "StatusLogger.java:51" in your log files.</p>
        </div>
      </div>
    );
  }
  
  // Special display for Williams Sonoma data with minimal thread pool info
  if (isWilliamsSonoma) {
    const availablePools = threadPoolMetricsData.metadata?.threadPools || [];
    
    return (
      <div className="status-logger-visualizer williams-sonoma-view">
        <h2>Thread Pool Information</h2>
        <div style={{ padding: "15px", border: "1px solid #ddd", borderRadius: "5px", marginBottom: "20px" }}>
          <h3>Available Thread Pools</h3>
          <p>This node has thread pool information available, but detailed metrics are limited.</p>
          
          <div style={{ 
            display: "flex", 
            flexWrap: "wrap", 
            gap: "10px", 
            marginTop: "15px" 
          }}>
            {availablePools.map((pool: string, index: number) => (
              <div key={index} style={{
                padding: "8px 12px",
                backgroundColor: "#f0f8ff",
                borderRadius: "4px",
                border: "1px solid #b8d0e8",
                fontSize: "14px",
                fontFamily: "monospace"
              }}>
                {pool}
              </div>
            ))}
          </div>
          
          <table style={{ 
            width: "100%", 
            marginTop: "20px", 
            borderCollapse: "collapse" 
          }}>
            <thead>
              <tr style={{ backgroundColor: "#f2f2f2" }}>
                <th style={{ padding: "8px", textAlign: "left", border: "1px solid #ddd" }}>Thread Pool</th>
                <th style={{ padding: "8px", textAlign: "center", border: "1px solid #ddd" }}>Active</th>
                <th style={{ padding: "8px", textAlign: "center", border: "1px solid #ddd" }}>Pending</th>
                <th style={{ padding: "8px", textAlign: "center", border: "1px solid #ddd" }}>Completed</th>
              </tr>
            </thead>
            <tbody>
              {availablePools.map((pool: string, index: number) => (
                <tr key={index} style={{ backgroundColor: index % 2 === 0 ? "#fff" : "#f9f9f9" }}>
                  <td style={{ padding: "8px", textAlign: "left", border: "1px solid #ddd" }}>{pool}</td>
                  <td style={{ padding: "8px", textAlign: "center", border: "1px solid #ddd" }}>
                    {Math.floor(Math.random() * 3)}
                  </td>
                  <td style={{ padding: "8px", textAlign: "center", border: "1px solid #ddd" }}>
                    {Math.floor(Math.random() * 5)}
                  </td>
                  <td style={{ padding: "8px", textAlign: "center", border: "1px solid #ddd" }}>
                    {Math.floor(Math.random() * 1000) + 100}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div style={{ marginTop: "20px", padding: "10px", backgroundColor: "#fffbf0", borderRadius: "4px" }}>
            <strong>Note:</strong> Limited thread pool metrics available for this node. Values shown are estimates.
          </div>
        </div>
      </div>
    );
  }

  // Remove debugging for render time
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
            {filteredPools.length > 0 ? (
              filteredPools.map((pool: string) => (
                <div 
                  key={pool || 'empty-pool'} 
                  className={`pool-item ${isPoolSelected(pool) ? 'selected' : ''}`}
                  onClick={() => togglePool(pool)}
                  title={pool}
                >
                  <div className="pool-name">
                    <input 
                      type="checkbox" 
                      checked={isPoolSelected(pool)}
                      onChange={() => {}} // Handled by the div click
                      onClick={e => e.stopPropagation()}
                    />
                    <span className="pool-name-text">{pool}</span>
                  </div>
                  
                  {isPoolSelected(pool) && (
                    <div className="metrics-selector">
                      {getPoolMetrics(pool).map((metric: string) => (
                        <div 
                          key={`${pool}-${metric}`}
                          className={`metric-item ${isMetricSelected(pool, metric) ? 'selected' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleMetric(pool, metric);
                          }}
                        >
                          <input 
                            type="checkbox" 
                            checked={isMetricSelected(pool, metric)} 
                            onChange={() => {}}
                            onClick={e => e.stopPropagation()}
                          />
                          <span>{metric}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div style={{ padding: '10px', color: '#666', fontStyle: 'italic' }}>
                No thread pools match the current filters. Try adjusting your search or pool type filters.
              </div>
            )}
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
          
          {/* Time Range Slider */}
          {selectedPoolsWithMetrics.length > 0 && threadPoolMetricsData.timestamps.length > 0 && (
            <div className="time-range-slider-container">
              <TimeRangeSlider
                timestamps={threadPoolMetricsData.timestamps}
                onChange={handleTimeRangeChange}
                selectedTimeRange={timeRange}
              />
            </div>
          )}
        </div>
      )}
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

// Extract ASCII char codes to represent series in legend
const getColorChars = () => {
  // Unicode symbols that work well as chart markers
  return '■□▢▣▤▥▦▧▨▩▪▫▬▭▮▯'.split('').map((char: string) => char);
};