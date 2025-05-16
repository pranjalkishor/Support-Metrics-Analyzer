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
  const [selectedPools, setSelectedPools] = useState<string[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<string>('Active');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [showPoolTypes, setShowPoolTypes] = useState<Record<string, boolean>>({
    'standard': true,
    'tpc': true
  });
  const [isAutoScale, setIsAutoScale] = useState<boolean>(true);
  const [yAxisScale, setYAxisScale] = useState<number | null>(null);

  // Extract available thread pools and metrics
  const { threadPools, metrics, poolCategories } = useMemo(() => {
    const pools: string[] = [];
    const allMetrics = ['Active', 'Pending', 'Blocked', 'All Time Blocked', 'Completed'];
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
    
    return { threadPools: pools, metrics: allMetrics, poolCategories: categories };
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
    
    return filtered;
  }, [threadPools, searchFilter, showPoolTypes]);

  // Calculate max y-axis value for the selected data
  const maxValue = useMemo(() => {
    if (!threadPoolMetricsData?.series || selectedPools.length === 0) return 0;
    
    let max = 0;
    selectedPools.forEach(pool => {
      const seriesKey = `${pool}: ${selectedMetric}`;
      if (threadPoolMetricsData.series[seriesKey]) {
        const poolMax = Math.max(...threadPoolMetricsData.series[seriesKey]);
        max = Math.max(max, poolMax);
      }
    });
    
    // Add a 10% margin
    return Math.ceil(max * 1.1);
  }, [threadPoolMetricsData, selectedPools, selectedMetric]);

  // Prepare data for the chart
  const chartData = useMemo(() => {
    if (!threadPoolMetricsData?.timestamps || !threadPoolMetricsData?.series) {
      return [];
    }

    return threadPoolMetricsData.timestamps.map((timestamp, index) => {
      const dataPoint: Record<string, any> = {
        timestamp,
        formattedTime: new Date(timestamp).toLocaleString()
      };
      
      // Add value for each selected pool
      selectedPools.forEach(pool => {
        const seriesKey = `${pool}: ${selectedMetric}`;
        if (threadPoolMetricsData.series[seriesKey]) {
          dataPoint[pool] = threadPoolMetricsData.series[seriesKey][index];
        }
      });
      
      return dataPoint;
    });
  }, [threadPoolMetricsData, selectedPools, selectedMetric]);

  // Example log from the raw data
  const exampleLog = useMemo(() => {
    if (threadPoolMetricsData?.timestamps?.length > 0) {
      return `INFO  [OptionalTasks:1] ${new Date(threadPoolMetricsData.timestamps[0]).toISOString().replace('T', ' ').slice(0, 19)}  StatusLogger.java:174 -
Pool Name                                     Active      Pending (w/Backpressure)   Delayed      Completed   Blocked  All Time Blocked
${selectedPools.map(pool => {
  const active = threadPoolMetricsData.series[`${pool}: Active`]?.[0] || 0;
  const pending = threadPoolMetricsData.series[`${pool}: Pending`]?.[0] || 0;
  const blocked = threadPoolMetricsData.series[`${pool}: Blocked`]?.[0] || 0;
  const allTimeBlocked = threadPoolMetricsData.series[`${pool}: All Time Blocked`]?.[0] || 0;
  return `${pool.padEnd(40)} ${String(active).padStart(5)}        ${String(pending).padStart(5)} (N/A)       N/A              0    ${String(blocked).padStart(5)}        ${String(allTimeBlocked).padStart(15)}`;
}).join('\n')}`;
    }
    return '';
  }, [threadPoolMetricsData, selectedPools]);

  // Handle pool selection
  const togglePoolSelection = (pool: string) => {
    setSelectedPools(prev => 
      prev.includes(pool)
        ? prev.filter(p => p !== pool)
        : [...prev, pool]
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
    setSelectedPools([]);
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
    const topPools = poolsWithActive.slice(0, 5).map(item => item.pool);
    
    setSelectedPools(topPools);
  };

  // Handle scaling options
  const toggleAutoScale = () => {
    setIsAutoScale(!isAutoScale);
    if (isAutoScale) {
      setYAxisScale(maxValue);
    } else {
      setYAxisScale(null);
    }
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
      <div className="controls">
        <div className="metric-selector">
          <label>Metric: </label>
          <select 
            value={selectedMetric} 
            onChange={(e) => setSelectedMetric(e.target.value)}
          >
            {metrics.map(metric => (
              <option key={metric} value={metric}>{metric}</option>
            ))}
          </select>
        </div>
        
        <div className="scaling-options">
          <label>
            <input 
              type="checkbox" 
              checked={isAutoScale} 
              onChange={toggleAutoScale}
            /> 
            Auto-scale Y-axis
          </label>
          {!isAutoScale && (
            <input 
              type="number" 
              value={yAxisScale || 0} 
              onChange={(e) => setYAxisScale(parseInt(e.target.value, 10))}
              className="scale-input"
            />
          )}
        </div>
        
        <div className="filter-controls">
          <div className="pool-type-filters">
            <label>
              <input 
                type="checkbox" 
                checked={showPoolTypes.standard} 
                onChange={() => togglePoolType('standard')}
              />
              Standard Pools
            </label>
            <label>
              <input 
                type="checkbox" 
                checked={showPoolTypes.tpc} 
                onChange={() => togglePoolType('tpc')}
              />
              TPC Pools
            </label>
          </div>
          
          <div className="search-box">
            <input 
              type="text" 
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search thread pools..."
            />
          </div>
          
          <div className="selection-actions">
            <button onClick={clearSelection} disabled={selectedPools.length === 0}>
              Clear Selection
            </button>
            <button onClick={selectTopActivePools}>
              Select Top Active Pools
            </button>
          </div>
        </div>
        
        <div className="pool-selector">
          <div className="pool-selector-header">Select Thread Pools</div>
          <div className="pool-list">
            {filteredPools.map(pool => (
              <div key={pool} className="pool-item">
                <label>
                  <input 
                    type="checkbox" 
                    checked={selectedPools.includes(pool)}
                    onChange={() => togglePoolSelection(pool)}
                  />
                  {pool}
                </label>
              </div>
            ))}
            {filteredPools.length === 0 && (
              <div className="no-pools-message">No thread pools matching your filters</div>
            )}
          </div>
        </div>
      </div>
      
      {/* Chart */}
      <div className="chart-container">
        <h3>{selectedMetric} Thread Pool Metrics Over Time</h3>
        {selectedPools.length === 0 ? (
          <div className="no-selection-message">
            Select one or more thread pools to visualize data
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={500}>
            <LineChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="formattedTime" 
                tick={{ fontSize: 10 }} 
                angle={-45} 
                textAnchor="end"
                height={80}
                interval="preserveStartEnd"
              />
              <YAxis 
                label={{ value: selectedMetric, angle: -90, position: 'insideLeft' }}
                domain={isAutoScale ? ['auto', 'auto'] : [0, yAxisScale || 'auto']}
              />
              <Tooltip 
                formatter={(value, name) => [value, name]}
                labelFormatter={(label) => `Time: ${label}`}
              />
              <Legend />
              {/* Zero reference line */}
              <ReferenceLine y={0} stroke="#666" />
              
              {selectedPools.map((pool, index) => (
                <Line 
                  key={pool}
                  type="monotone" 
                  dataKey={pool} 
                  name={pool}
                  stroke={getColor(index)} 
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                  connectNulls={true}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      
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