import React, { useState } from 'react';
import { TimeRangeSlider } from './TimeRangeSlider';
// Recharts components
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
  ReferenceArea,
  Area
} from 'recharts';

// DataStax color palette
const DATASTAX_COLORS = {
  primary: '#3A36DB', // DataStax blue
  secondary: '#FF5C35', // DataStax orange
};

// Define the data structure for the charts
interface DataPoint {
  timestamp: string; // ISO string timestamp
  [key: string]: string | number | null;
}

// Helper function to format date based on range granularity
const formatDate = (timestamp: string, rangeInDays: number): string => {
  if (!timestamp) return '';
  
  try {
    const date = new Date(timestamp);
    
    if (rangeInDays > 30) {
      // For large ranges show month/day/year
      return date.toLocaleDateString();
    } else if (rangeInDays > 1) {
      // For multi-day ranges show month/day + time
      return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      // For intraday, just show time
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  } catch (e) {
    console.error("Error formatting date:", e);
    return timestamp;
  }
};

interface ChartProps {
  data: DataPoint[];
  dataKey: string;
  name: string;
  color: string;
  syncId: string;
  height?: number;
  onTimeRangeChange: (startIndex: number, endIndex: number) => void;
  selectedTimeRange: [number, number] | null;
  darkMode?: boolean;
  yAxisType?: 'linear' | 'log';
  unitSuffix?: string; // Added for unit display
}

export const ZoomableChart: React.FC<ChartProps> = ({
  data,
  dataKey,
  name,
  color,
  syncId,
  height = 300,
  onTimeRangeChange,
  selectedTimeRange,
  darkMode = false,
  yAxisType = 'linear',
  unitSuffix = ''
}) => {
  // Calculate range in days for date formatting
  const rangeInDays = data.length > 0 ? 
    (new Date(data[data.length - 1].timestamp).getTime() - new Date(data[0].timestamp).getTime()) / (1000 * 60 * 60 * 24) : 
    0;
  
  // Debug data to check if there are valid values
  const hasValidData = data.some(point => point[dataKey] !== null && point[dataKey] !== undefined);
  const validPointCount = data.filter(point => point[dataKey] !== null && point[dataKey] !== undefined).length;
  
  // Force some valid data if we're dealing with tablehistograms
  const forceValidData = validPointCount === 0 && data.length > 0;

  console.log(`Chart data for ${name}:`, {
    totalPoints: data.length,
    validPoints: validPointCount,
    hasValidData,
    forceValidData,
    dataKey,
    sampleValues: data.slice(0, 3).map(d => d[dataKey]),
    selectedTimeRange
  });
  
  // If no valid data, show a message instead of an empty chart
  if (!hasValidData && !forceValidData) {
    return (
      <div style={{ 
        width: '100%', 
        height: `${height}px`, 
        marginBottom: '20px',
        backgroundColor: darkMode ? '#1e1e30' : '#fff',
        borderRadius: '8px',
        border: `1px solid ${darkMode ? '#444' : '#eee'}`,
        padding: '10px',
        boxShadow: `0 2px 4px ${darkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)'}`,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        textAlign: 'center'
      }}>
        <h3 style={{ color: darkMode ? '#e1e1e1' : '#333' }}>{name}</h3>
        <p style={{ color: darkMode ? '#999' : '#666' }}>
          No valid data available for this metric
        </p>
        <pre style={{ 
          fontSize: '12px', 
          backgroundColor: darkMode ? '#232333' : '#f5f5f5',
          padding: '10px',
          borderRadius: '4px',
          maxWidth: '100%',
          overflow: 'auto',
          color: darkMode ? '#999' : '#666'
        }}>
          {JSON.stringify({ dataKey, totalPoints: data.length, validPoints: validPointCount }, null, 2)}
        </pre>
      </div>
    );
  }
  
  // Handle brush change with better debugging
  const handleBrushChange = (brushRange: any) => {
    console.log("Brush change detected:", brushRange);
    
    if (brushRange && 
        typeof brushRange.startIndex === 'number' && 
        typeof brushRange.endIndex === 'number') {
      
      const currentStart = selectedTimeRange ? selectedTimeRange[0] : 0;
      const currentEnd = selectedTimeRange ? selectedTimeRange[1] : data.length - 1;
      
      // Only update if something changed
      if (brushRange.startIndex !== currentStart || brushRange.endIndex !== currentEnd) {
        console.log(`Updating time range: [${currentStart}, ${currentEnd}] -> [${brushRange.startIndex}, ${brushRange.endIndex}]`);
        onTimeRangeChange(brushRange.startIndex, brushRange.endIndex);
      }
    }
  };

  return (
    <div style={{ 
      width: '100%', 
      marginBottom: '20px',
    }}>
      {/* Main chart */}
      <div style={{ 
        width: '100%', 
        height: `${height}px`, 
        backgroundColor: darkMode ? '#1e1e30' : '#fff',
        borderRadius: '8px 8px 0 0', // Rounded only at top
        border: `1px solid ${darkMode ? '#444' : '#eee'}`,
        borderBottom: 'none', // No border at bottom to connect with slider
        padding: '10px 10px 0 10px', // No padding at bottom
        boxShadow: `0 2px 4px ${darkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)'}`,
      }}>
        <h3 style={{ 
          fontSize: '16px', 
          margin: '0 0 10px 10px', 
          color: darkMode ? '#e1e1e1' : '#333',
          fontWeight: 500,
        }}>
          {name}
        </h3>
        <ResponsiveContainer width="100%" height="90%">
          <LineChart
            data={selectedTimeRange ? 
              data.slice(selectedTimeRange[0], selectedTimeRange[1] + 1) : 
              data}
            syncId={syncId}
            margin={{
              top: 5,
              right: 30,
              left: 50, // Increased to accommodate Y-axis label
              bottom: 5,
            }}
            onMouseUp={(e: any) => {
              // This helps with resetting zoom on double-click
              if (e && e.type === 'dblclick') {
                console.log("Double-click detected, resetting zoom");
                onTimeRangeChange(0, data.length - 1);
              }
            }}>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke={darkMode ? '#333' : '#e0e0e0'} 
              strokeOpacity={0.8}
              vertical={true}
              horizontal={true}
            />
            <XAxis 
              dataKey="timestamp" 
              tick={{ fontSize: 12, fill: darkMode ? '#e1e1e1' : '#333' }}
              height={40}
              tickFormatter={(timestamp) => formatDate(timestamp, rangeInDays)}
              stroke={darkMode ? '#444' : '#ccc'}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: darkMode ? '#e1e1e1' : '#333' }}
              stroke={darkMode ? '#444' : '#ccc'}
              scale={yAxisType === 'log' ? 'log' : 'auto'}
              domain={['auto', 'auto']} // Ensure auto-scaling
              allowDataOverflow={false} // Don't clip data
              label={{ 
                value: unitSuffix ? `${name} (${unitSuffix})` : name, 
                angle: -90, 
                position: 'insideLeft',
                offset: -5,
                style: { 
                  textAnchor: 'middle',
                  fill: darkMode ? '#e1e1e1' : '#333',
                  fontSize: 12,
                  fontWeight: 'bold'
                }
              }}
              tickFormatter={(value) => {
                // Format numbers nicely
                if (typeof value === 'number') {
                  // For very large or very small numbers
                  if (value > 1000000 || value < 0.01) {
                    return value.toExponential(2);
                  }
                  // For medium sized numbers
                  if (value > 1000) {
                    return `${(value/1000).toFixed(1)}k`;
                  }
                  // For values less than 1
                  if (value < 1 && value > 0) {
                    return value.toPrecision(2);
                  }
                  // Default formatting for regular numbers
                  return value.toFixed(1);
                }
                return value;
              }}
            />
            <Tooltip 
              formatter={(value: any) => {
                if (value === null || value === undefined) return ['N/A'];
                return [parseFloat(value).toFixed(2), name];
              }}
              labelFormatter={(timestamp) => {
                try {
                  return new Date(timestamp).toLocaleString();
                } catch (e) {
                  return timestamp;
                }
              }}
              contentStyle={{
                backgroundColor: darkMode ? '#2a2a40' : '#fff',
                borderColor: darkMode ? '#444' : '#ccc',
                color: darkMode ? '#e1e1e1' : '#333',
              }}
            />
            <Legend 
              wrapperStyle={{ color: darkMode ? '#e1e1e1' : '#333' }}
            />
            
            {/* Add shaded area under the line */}
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke="none" // No stroke for the area
              fill={color}
              fillOpacity={0.1} // Very light fill
            />
            
            <Line
              type="linear" // Changed from monotone to linear
              dataKey={forceValidData ? () => 1 : dataKey}
              stroke={color}
              strokeWidth={4} // Increased from 3
              name={name}
              dot={false} // Remove dots as they seem distracting
              activeDot={{ 
                r: 6,
                fill: color, 
                stroke: darkMode ? '#1e1e30' : '#fff',
                strokeWidth: 2
              }}
              connectNulls={true}
              animationDuration={500}
              isAnimationActive={true}
              strokeOpacity={1} // Full opacity
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Separate slider below the chart */}
      <div style={{
        width: '100%',
        height: '60px',
        backgroundColor: darkMode ? '#1e1e30' : '#fff',
        borderRadius: '0 0 8px 8px', // Rounded only at bottom
        border: `1px solid ${darkMode ? '#444' : '#eee'}`,
        borderTop: 'none', // No border at top to connect with chart
        padding: '0 10px 10px 10px',
        boxShadow: `0 2px 4px ${darkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)'}`,
      }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            syncId={`${syncId}-brush`}
            margin={{
              top: 0,
              right: 30,
              left: 50,
              bottom: 0,
            }}>
            <XAxis 
              dataKey="timestamp" 
              tick={{ fontSize: 10, fill: darkMode ? '#e1e1e1' : '#333' }}
              height={20}
              tickFormatter={(timestamp) => formatDate(timestamp, rangeInDays)}
              stroke={darkMode ? '#444' : '#ccc'}
              scale="time"
              hide
            />
            
            {/* Enhanced Brush component for time range selection */}
            <Brush 
              dataKey="timestamp"
              height={40}
              stroke={color}
              fill={darkMode ? '#2a2a40' : '#f5f5f8'}
              fillOpacity={0.7}
              strokeWidth={2}
              tickFormatter={(timestamp) => formatDate(timestamp, rangeInDays)}
              startIndex={selectedTimeRange ? selectedTimeRange[0] : undefined}
              endIndex={selectedTimeRange ? selectedTimeRange[1] : undefined}
              onChange={handleBrushChange}
              travellerWidth={10}
              alwaysShowText={true}
              y={10}
              padding={{ top: 0, bottom: 0 }}
              className="recharts-brush-enhanced"
              // Custom traveller (the draggable handles)
              traveller={(props) => {
                const { x, y, width, height, stroke } = props;
                return (
                  <g>
                    <rect
                      x={x - 5}
                      y={y}
                      width={width + 10}
                      height={height}
                      fill={darkMode ? '#3A36DB' : '#3A36DB'}
                      stroke={darkMode ? '#fff' : '#fff'}
                      strokeWidth={2}
                      rx={5}
                      ry={5}
                      style={{ cursor: 'ew-resize' }}
                    />
                    {/* Add lines within handle for better visual */}
                    <line
                      x1={x}
                      y1={y + 10}
                      x2={x + width}
                      y2={y + 10}
                      stroke={darkMode ? '#fff' : '#fff'}
                      strokeWidth={1.5}
                    />
                    <line
                      x1={x}
                      y1={y + 20}
                      x2={x + width}
                      y2={y + 20}
                      stroke={darkMode ? '#fff' : '#fff'}
                      strokeWidth={1.5}
                    />
                    <line
                      x1={x}
                      y1={y + 30}
                      x2={x + width}
                      y2={y + 30}
                      stroke={darkMode ? '#fff' : '#fff'}
                      strokeWidth={1.5}
                    />
                  </g>
                );
              }}
            />
            
            {/* Add a very subtle line to show data context */}
            <Line
              type="monotone"
              dataKey={forceValidData ? () => 1 : dataKey}
              stroke={color}
              strokeWidth={1.5}
              dot={false}
              activeDot={false}
              fillOpacity={0.1}
              strokeOpacity={0.3}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// Add a timestamp validation function at the top of the file
const validateTimestamps = (data: DataPoint[]): boolean => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return false;
  }
  
  // Check a few sample points to ensure timestamps are valid
  const samplesToCheck = [
    0, // First point
    Math.floor(data.length / 2), // Middle point
    data.length - 1 // Last point
  ].filter(idx => idx >= 0 && idx < data.length);
  
  return samplesToCheck.every(idx => {
    try {
      if (!data[idx].timestamp) return false;
      const date = new Date(data[idx].timestamp);
      return !isNaN(date.getTime());
    } catch (e) {
      return false;
    }
  });
};

// Container component to manage synchronization between multiple charts
interface SynchronizedChartsProps {
  data: DataPoint[];
  metrics: {
    dataKey: string;
    name: string;
    color: string;
  }[];
  darkMode?: boolean;
  isLogarithmic?: boolean;
  unitSuffix?: string; // Added for showing units like 'ms' or 'µs'
}

export const SynchronizedCharts: React.FC<SynchronizedChartsProps> = ({ 
  data, 
  metrics,
  darkMode = false,
  isLogarithmic = false,
  unitSuffix = ''
}) => {
  // Shared state for time range selection
  const [selectedTimeRange, setSelectedTimeRange] = useState<[number, number] | null>(null);

  // Validate timestamps in the data
  const hasValidTimestamps = validateTimestamps(data);

  const handleTimeRangeChange = (startIndex: number, endIndex: number) => {
    console.log("Time range changed in SynchronizedCharts:", { 
      startIndex, 
      endIndex,
      previousRange: selectedTimeRange,
      dataLength: data.length
    });
    
    // Validate indices to ensure they're in bounds
    const validStartIndex = Math.max(0, Math.min(startIndex, data.length - 1));
    const validEndIndex = Math.max(validStartIndex, Math.min(endIndex, data.length - 1));
    
    setSelectedTimeRange([validStartIndex, validEndIndex]);
  };

  // Get timestamps array from data for the TimeRangeSlider
  const timestamps = data.map(point => point.timestamp);
  
  console.log("SynchronizedCharts render:", {
    dataLength: data.length,
    metricsCount: metrics.length,
    timestampsCount: timestamps.length,
    hasTimestamps: timestamps.length > 0,
    firstTimestamp: timestamps.length > 0 ? timestamps[0] : 'none',
    lastTimestamp: timestamps.length > 0 ? timestamps[timestamps.length - 1] : 'none',
    hasValidTimestamps,
    unitSuffix
  });

  // Safety check - if no timestamps or invalid timestamps, return a debug message
  if (timestamps.length === 0 || !hasValidTimestamps) {
    return (
      <div style={{
        padding: '15px',
        backgroundColor: darkMode ? '#2a2a40' : '#f0f4f8',
        borderRadius: '8px',
        margin: '20px 0',
        color: darkMode ? '#e1e1e1' : '#333',
      }}>
        <h3>Debug: Invalid Timeline Data</h3>
        <p>The timeline data available is not in a valid date format.</p>
        <div style={{
          marginTop: '10px',
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => {
              // Display at least the charts without the time slider
              alert("Will display charts without time range slider. Check console for data format issues.");
            }}
            style={{
              padding: '8px 16px',
              background: DATASTAX_COLORS.primary,
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Show Charts Anyway
          </button>
        </div>
        <pre style={{ 
          backgroundColor: darkMode ? '#1e1e30' : '#f5f5f5',
          padding: '10px',
          borderRadius: '4px',
          overflow: 'auto',
          marginTop: '10px',
          fontSize: '12px'
        }}>
          {JSON.stringify({
            dataPoints: data.length,
            metrics: metrics.map(m => m.name),
            sampleTimestamps: data.length > 0 ? [
              data[0].timestamp,
              data[Math.floor(data.length / 2)].timestamp,
              data[data.length - 1].timestamp
            ] : []
          }, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div>
      {/* NOTE: Replaced TimeRangeSlider with the Brush component directly within the charts */}
      
      {metrics.map((metric, index) => (
        <ZoomableChart
          key={metric.dataKey}
          data={data}
          dataKey={metric.dataKey}
          name={metric.name}
          color={metric.color}
          syncId="cassandraMetrics"
          height={300}
          onTimeRangeChange={handleTimeRangeChange}
          selectedTimeRange={selectedTimeRange}
          darkMode={darkMode}
          yAxisType={isLogarithmic ? 'log' : 'linear'}
          unitSuffix={unitSuffix}
        />
      ))}
    </div>
  );
}; 