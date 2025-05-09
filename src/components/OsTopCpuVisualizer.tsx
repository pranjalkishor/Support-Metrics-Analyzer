import React, { useState, useEffect } from 'react';
import { parseOsTopCpu, convertTopSnapshotsToTimeSeries } from '../parsers/os_top_cpu';
import { TopProcessTable } from './TopProcessTable';
import { SynchronizedCharts } from './ZoomableCharts';
import { TimeRangeSlider } from './TimeRangeSlider';

interface OsTopCpuVisualizerProps {
  fileContent: string;
  darkMode: boolean;
}

export const OsTopCpuVisualizer: React.FC<OsTopCpuVisualizerProps> = ({ 
  fileContent, 
  darkMode 
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<any>(null);
  const [currentSnapshotIndex, setCurrentSnapshotIndex] = useState<number>(0);
  const [chartData, setChartData] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<[number, number] | null>(null);
  
  // When file content changes, parse it
  useEffect(() => {
    setLoading(true);
    setError(null);
    
    try {
      // Log a bit of the file content for debugging
      console.log(`Processing file with ${fileContent.length} characters`);
      console.log(`First 50 chars: ${fileContent.substring(0, 50)}...`);

      const parsed = parseOsTopCpu(fileContent);
      setParsedData(parsed);
      
      if (parsed.snapshots.length === 0) {
        // Provide a more helpful error message
        setError(
          "No valid data found in the file. This could be because: \n" +
          "1. The file format doesn't match what the parser expects\n" +
          "2. The file doesn't contain 'top' command output\n" +
          "3. The timestamp format is different from what's expected\n\n" +
          "Please check the console for more details."
        );
        setLoading(false);
        return;
      }
      
      // Convert to time series format for charts
      const timeseriesData = convertTopSnapshotsToTimeSeries(parsed.snapshots);
      
      // Create chart-friendly data format
      const formattedData = timeseriesData.timestamps.map((timestamp, index) => {
        const dataPoint: any = { timestamp };
        
        Object.keys(timeseriesData.series).forEach(metricKey => {
          dataPoint[metricKey] = timeseriesData.series[metricKey][index];
        });
        
        return dataPoint;
      });
      
      setChartData(formattedData);
      
      // Find top processes by CPU and Memory
      const processMetrics = Object.keys(timeseriesData.series)
        .filter(key => key.startsWith('CPU | ') || key.startsWith('MEM | '));
      
      // Get system-wide metrics
      const systemMetrics = Object.keys(timeseriesData.series)
        .filter(key => key.startsWith('System | '));
      
      // Start with system metrics for CPU usage
      const initialSelectedMetrics = systemMetrics.length > 0 ? 
        systemMetrics.filter(m => m.includes('CPU')) : [];
      
      // Add top CPU consuming processes if available
      const topCpuMetrics = processMetrics
        .filter(key => key.startsWith('CPU | '))
        .sort((a, b) => {
          const aValues = timeseriesData.series[a];
          const bValues = timeseriesData.series[b];
          
          // Calculate average value, ignoring NaN
          const aAvg = aValues.filter((v: number) => !isNaN(v))
            .reduce((sum: number, v: number) => sum + v, 0) / 
            aValues.filter((v: number) => !isNaN(v)).length;
          
          const bAvg = bValues.filter((v: number) => !isNaN(v))
            .reduce((sum: number, v: number) => sum + v, 0) / 
            bValues.filter((v: number) => !isNaN(v)).length;
          
          return bAvg - aAvg; // Descending order
        })
        .slice(0, 5); // Get top 5
      
      // Create initial selection
      const defaultMetrics = [...initialSelectedMetrics, ...topCpuMetrics.slice(0, 5)];
      
      // Create formatted metrics for chart
      const formattedMetrics = processMetrics.map(metric => {
        // Extract process name
        const match = metric.match(/^(CPU|MEM) \| (.+) \((\d+)\)$/);
        let name = metric;
        let color = '#3A36DB'; // Default color
        
        if (match) {
          const [_, type, processName, pid] = match;
          name = `${type} | ${processName} (${pid})`;
          
          if (type === 'CPU') {
            color = '#FF5C35'; // CPU in orange
          } else if (type === 'MEM') {
            color = '#00C7B7'; // Memory in teal
          }
        } else if (metric.includes('User')) {
          color = '#6C11A5'; // User CPU in purple
        } else if (metric.includes('System')) {
          color = '#DDB247'; // System CPU in gold
        } else if (metric.includes('Idle')) {
          color = '#4DB39E'; // Idle CPU in green
        }
        
        return {
          dataKey: metric,
          name: name,
          color: color
        };
      });
      
      // Add system metrics
      const systemMetricsFormatted = systemMetrics.map(metric => {
        let color = '#3A36DB'; // Default blue
        
        if (metric.includes('User')) {
          color = '#6C11A5'; // User CPU in purple
        } else if (metric.includes('System')) {
          color = '#DDB247'; // System CPU in gold
        } else if (metric.includes('Idle')) {
          color = '#4DB39E'; // Idle CPU in green
        }
        
        return {
          dataKey: metric,
          name: metric,
          color: color
        };
      });
      
      setMetrics([...systemMetricsFormatted, ...formattedMetrics]);
      setSelectedMetrics(defaultMetrics);
      
      // Default to first snapshot
      setCurrentSnapshotIndex(0);
      
      // Set initial time range to everything
      setTimeRange([0, parsed.snapshots.length - 1]);
      
      setLoading(false);
    } catch (err) {
      console.error("Error parsing OS top CPU data:", err);
      // Show more details about the error 
      setError(`Failed to parse file: ${err instanceof Error ? err.message : String(err)}\n\nPlease check the file format and try again.`);
      setLoading(false);
    }
  }, [fileContent]);
  
  const handleTimeRangeChange = (start: number, end: number) => {
    setTimeRange([start, end]);
    
    // Set current snapshot to end of selected range for most recent data
    setCurrentSnapshotIndex(end);
  };
  
  const handleSnapshotChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    if (!isNaN(value) && value >= 0 && value < (parsedData?.snapshots.length || 0)) {
      setCurrentSnapshotIndex(value);
    }
  };
  
  const handleMetricChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const options = event.target.options;
    const selectedOptions = [];
    
    for (let i = 0; i < options.length; i++) {
      if (options[i].selected) {
        selectedOptions.push(options[i].value);
      }
    }
    
    setSelectedMetrics(selectedOptions);
  };
  
  if (loading) {
    return (
      <div style={{
        backgroundColor: darkMode ? '#1e1e30' : '#ffffff',
        color: darkMode ? '#e1e1e1' : '#333333',
        borderRadius: '8px',
        padding: '24px',
        textAlign: 'center',
        boxShadow: `0 2px 4px ${darkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)'}`,
      }}>
        <h3>Loading Data...</h3>
        <p>Please wait while we process the file</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div style={{
        backgroundColor: darkMode ? '#2a2a2a' : '#fff8f8',
        color: darkMode ? '#ff7373' : '#d32f2f',
        borderRadius: '8px',
        padding: '24px',
        textAlign: 'center',
        boxShadow: `0 2px 4px ${darkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)'}`,
        border: `1px solid ${darkMode ? '#5a3d3d' : '#ffcdd2'}`,
      }}>
        <h3>Error</h3>
        <div style={{ whiteSpace: 'pre-line', textAlign: 'left', marginTop: '16px' }}>
          {error}
        </div>
        <div style={{ marginTop: '24px', fontSize: '14px', color: darkMode ? '#999' : '#666' }}>
          <p>Expected format: output from Linux/Unix 'top' command</p>
          <p>Example of expected content:</p>
          <pre style={{ 
            textAlign: 'left', 
            backgroundColor: darkMode ? '#222' : '#f5f5f5',
            padding: '8px',
            borderRadius: '4px',
            overflowX: 'auto',
            fontSize: '12px'
          }}>
            {`2025-02-27T13:24:23+0100
top - 13:24:23 up 134 days, 21:55,  1 user,  load average: 3.47, 2.64, 2.51
Tasks: 493 total,   3 running, 490 sleeping,   0 stopped,   0 zombie
%Cpu(s): 19.7 us, 17.7 sy,  0.3 ni, 59.5 id,  2.6 wa,  0.0 hi,  0.3 si,  0.0 st
KiB Mem : 13183766+total,  2788284 free, 48820748 used, 80228632 buff/cache
KiB Swap:        0 total,        0 free,        0 used. 82035528 avail Mem 

  PID USER      PR  NI    VIRT    RES    SHR S  %CPU %MEM     TIME+ COMMAND
27937 cassand+  20   0  270.2g  48.7g   8.3g S 105.3 38.7  12074:06 java
...`}
          </pre>
        </div>
      </div>
    );
  }
  
  if (!parsedData || parsedData.snapshots.length === 0) {
    return (
      <div style={{
        backgroundColor: darkMode ? '#1e1e30' : '#ffffff',
        color: darkMode ? '#e1e1e1' : '#333333',
        borderRadius: '8px',
        padding: '24px',
        textAlign: 'center',
        boxShadow: `0 2px 4px ${darkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)'}`,
      }}>
        <h3>No Data Available</h3>
        <p>The file doesn't contain valid top command output data</p>
      </div>
    );
  }
  
  const selectedChartMetrics = metrics.filter(m => 
    selectedMetrics.includes(m.dataKey)
  );
  
  return (
    <div>
      {/* Time navigation */}
      <div style={{
        backgroundColor: darkMode ? '#1e1e30' : '#ffffff',
        color: darkMode ? '#e1e1e1' : '#333333',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '24px',
        boxShadow: `0 2px 4px ${darkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)'}`,
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>CPU & Memory Usage Over Time</h3>
        
        <div style={{ 
          marginBottom: '16px',
          display: 'flex', 
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'flex-start' 
        }}>
          <div style={{ flex: '1', minWidth: '300px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: 'bold'
            }}>
              Select Metrics to Display:
            </label>
            <select 
              multiple 
              value={selectedMetrics}
              onChange={handleMetricChange}
              style={{
                width: '100%',
                minHeight: '150px',
                padding: '8px',
                borderRadius: '4px',
                backgroundColor: darkMode ? '#2a2a40' : '#fff',
                color: darkMode ? '#e1e1e1' : '#333',
                border: `1px solid ${darkMode ? '#444' : '#ddd'}`,
              }}
            >
              {metrics.map(metric => (
                <option 
                  key={metric.dataKey} 
                  value={metric.dataKey}
                  style={{
                    padding: '4px 8px',
                    borderBottom: `1px solid ${darkMode ? '#333' : '#eee'}`,
                  }}
                >
                  {metric.name}
                </option>
              ))}
            </select>
            <div style={{ 
              fontSize: '12px', 
              marginTop: '4px',
              color: darkMode ? '#999' : '#666'
            }}>
              Hold Ctrl/Cmd to select multiple metrics
            </div>
          </div>
          
          <div style={{ flex: '1', minWidth: '300px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: 'bold'
            }}>
              Current Time: {parsedData.snapshots[currentSnapshotIndex]?.timestamp || 'N/A'}
            </label>
            <div style={{ marginBottom: '16px' }}>
              <input
                type="range"
                min="0"
                max={(parsedData.snapshots.length - 1).toString()}
                value={currentSnapshotIndex}
                onChange={handleSnapshotChange}
                style={{
                  width: '100%',
                  height: '24px',
                  borderRadius: '4px',
                  backgroundColor: darkMode ? '#2a2a40' : '#f5f5f8',
                  accentColor: '#3A36DB'
                }}
              />
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                fontSize: '12px',
                color: darkMode ? '#999' : '#666',
                marginTop: '4px'
              }}>
                <div>{parsedData.snapshots[0]?.timestamp}</div>
                <div>{parsedData.snapshots[parsedData.snapshots.length - 1]?.timestamp}</div>
              </div>
            </div>
            
            <div style={{ fontSize: '14px' }}>
              <div><strong>System Info at Current Time:</strong></div>
              <div style={{ marginTop: '8px', color: darkMode ? '#e1e1e1' : '#555' }}>
                <div>{parsedData.snapshots[currentSnapshotIndex]?.systemInfo.uptime}</div>
                <div>{parsedData.snapshots[currentSnapshotIndex]?.systemInfo.tasks}</div>
                <div>{parsedData.snapshots[currentSnapshotIndex]?.systemInfo.cpuStats}</div>
                <div>{parsedData.snapshots[currentSnapshotIndex]?.systemInfo.memoryStats}</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* CPU Chart */}
        {chartData.length > 0 && selectedChartMetrics.length > 0 && (
          <div style={{ height: '400px', marginTop: '24px' }}>
            <SynchronizedCharts
              data={chartData}
              metrics={selectedChartMetrics}
              darkMode={darkMode}
              isLogarithmic={false}
              unitSuffix="%"
            />
          </div>
        )}
      </div>
      
      {/* Process Table */}
      <TopProcessTable
        snapshots={parsedData.snapshots}
        currentSnapshotIndex={currentSnapshotIndex}
        darkMode={darkMode}
      />
    </div>
  );
}; 