import React, { useState, useEffect } from 'react';
import { SynchronizedCharts } from './ZoomableCharts';
import { ParsedTimeSeries } from '../types';

interface ZoomableTimeSeriesChartsProps {
  data: ParsedTimeSeries;
  selectedMetrics: string[];
  darkMode: boolean;
  isLogarithmic?: boolean;
}

// Color palette for charts
const CHART_COLORS = [
  '#3A36DB', // DataStax blue
  '#FF5C35', // DataStax orange
  '#00C7B7', // Teal
  '#6C11A5', // Purple
  '#19CDD7', // Light blue
  '#DDB247', // Gold
  '#4DB39E', // Green
  '#9F44D3', // Purple
  '#F05E6E', // Pink
  '#1A9F29', // Dark green
];

export const ZoomableTimeSeriesCharts: React.FC<ZoomableTimeSeriesChartsProps> = ({
  data,
  selectedMetrics,
  darkMode,
  isLogarithmic = false,
}) => {
  const [formattedData, setFormattedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInMilliseconds, setShowInMilliseconds] = useState(false);
  
  // Check if we're showing latency data
  const isLatencyData = selectedMetrics.some(metric => 
    metric.toLowerCase().includes('latency')
  );

  // Debug log for incoming data
  useEffect(() => {
    console.log("ZoomableTimeSeriesCharts received data:", {
      hasData: !!data,
      timestamps: data?.timestamps?.length || 0,
      metrics: selectedMetrics,
      firstTimestamp: data?.timestamps?.[0] || 'none',
      seriesKeys: data ? Object.keys(data.series || {}).length : 0,
      isLatencyData,
      showInMilliseconds
    });
  }, [data, selectedMetrics, isLatencyData, showInMilliseconds]);

  // Format data for zoomable charts when data or selected metrics change
  useEffect(() => {
    setLoading(true);
    
    if (!data || !data.timestamps || !data.series || selectedMetrics.length === 0) {
      console.warn("Missing required data for charts:", {
        hasData: !!data,
        hasTimestamps: !!data?.timestamps,
        timestampsLength: data?.timestamps?.length || 0,
        hasSeries: !!data?.series,
        selectedMetricsCount: selectedMetrics.length
      });
      setFormattedData([]);
      setLoading(false);
      return;
    }

    try {
      console.log("Processing data for charts:", {
        timestampsCount: data.timestamps.length,
        sampleTimestamp: data.timestamps[0],
        selectedMetrics,
        sampleMetricData: selectedMetrics.length > 0 ? 
          data.series[selectedMetrics[0]]?.slice(0, 5) : []
      });

      // Create formatted data points with timestamps and selected metrics
      const formattedPoints = data.timestamps.map((timestamp, index) => {
        // Create a data point with the timestamp
        const dataPoint: any = {
          timestamp,
        };
        
        // Add values for each selected metric
        selectedMetrics.forEach(metric => {
          if (data.series[metric] && data.series[metric][index] !== undefined) {
            // Convert string values to numbers to ensure proper rendering
            const value = data.series[metric][index];
            let numericValue: number;
            
            if (typeof value === 'string') {
              // Try to parse as float
              numericValue = parseFloat(value);
            } else if (typeof value === 'number') {
              numericValue = value;
            } else {
              // Default fallback
              numericValue = 0;
              console.warn(`Invalid value type for metric ${metric} at index ${index}:`, value);
            }
            
            // Apply milliseconds conversion for latency if needed
            if (showInMilliseconds && metric.toLowerCase().includes('latency') && !isNaN(numericValue)) {
              numericValue = numericValue / 1000;
            }
            
            // Only add non-NaN values
            if (!isNaN(numericValue)) {
              dataPoint[metric] = numericValue;
            } else {
              dataPoint[metric] = null;
              console.warn(`NaN value found for metric ${metric} at index ${index}`);
            }
          } else {
            dataPoint[metric] = null; // Use null for missing values
          }
        });
        
        return dataPoint;
      });
      
      // Log some diagnostic information
      const hasValidData = formattedPoints.some(point => {
        return selectedMetrics.some(metric => point[metric] !== null && point[metric] !== undefined);
      });
      
      console.log("Formatted chart data:", {
        pointsCount: formattedPoints.length,
        samplePoints: formattedPoints.slice(0, 2), // Show first two points
        hasValidData,
        validPointCount: formattedPoints.filter(point => 
          selectedMetrics.some(metric => point[metric] !== null && point[metric] !== undefined)
        ).length
      });
      
      if (!hasValidData) {
        console.error("No valid data points found for any selected metrics!");
      }
      
      setFormattedData(formattedPoints);
    } catch (error) {
      console.error("Error formatting data for zoomable charts:", error);
      setFormattedData([]);
    } finally {
      setLoading(false);
    }
  }, [data, selectedMetrics, showInMilliseconds]);
  
  // Force a small timeout to ensure component mounts correctly
  useEffect(() => {
    const timer = setTimeout(() => {
      // This empty timeout helps ensure stable rendering
    }, 100);
    return () => clearTimeout(timer);
  }, [formattedData]);

  // Configure metrics for display
  const chartMetrics = selectedMetrics.map((metric, index) => ({
    dataKey: metric,
    name: metric,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));

  // Determine the display name for each metric (clean up long names)
  const getDisplayName = (metric: string): string => {
    // For table histograms with format "table | metric | percentile"
    if (metric.includes(" | ")) {
      const parts = metric.split(" | ");
      if (parts.length >= 3) {
        return `${parts[1]} (${parts[2]})`;
      } else if (parts.length === 2) {
        return parts[1];
      }
    }
    return metric;
  };

  // Update metrics with display names
  const displayMetrics = chartMetrics.map(metric => ({
    ...metric,
    name: getDisplayName(metric.dataKey)
  }));

  // If no data or loading, show appropriate message
  if (loading) {
    return (
      <div style={{
        height: 200,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: darkMode ? '#1e1e30' : '#f5f5f5',
        color: darkMode ? '#e1e1e1' : '#333',
        borderRadius: '8px',
        border: `1px solid ${darkMode ? '#444' : '#ddd'}`
      }}>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <h3>Preparing Chart Data...</h3>
        </div>
      </div>
    );
  }

  if (formattedData.length === 0 || displayMetrics.length === 0) {
    return (
      <div style={{
        height: 200,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: darkMode ? '#1e1e30' : '#f5f5f5',
        color: darkMode ? '#e1e1e1' : '#333',
        borderRadius: '8px',
        border: `1px solid ${darkMode ? '#444' : '#ddd'}`
      }}>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <h3>No data to display</h3>
          <p>Please select different metrics or check that your data contains valid values.</p>
        </div>
      </div>
    );
  }

  // Render unit toggle only for latency metrics
  const renderUnitToggle = () => {
    if (!isLatencyData) return null;
    
    return (
      <div style={{
        marginBottom: '15px',
        padding: '10px 15px',
        backgroundColor: darkMode ? '#2a2a40' : '#f5f5f8',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        border: `1px solid ${darkMode ? '#3d3d52' : '#e0e0e0'}`,
      }}>
        <div style={{ fontWeight: 'bold', fontSize: '14px', color: darkMode ? '#e1e1e1' : '#333' }}>
          Latency Unit:
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            cursor: 'pointer',
            backgroundColor: !showInMilliseconds ? (darkMode ? '#3A36DB' : '#e6e9fd') : 'transparent',
            padding: '5px 10px',
            borderRadius: '4px',
            color: !showInMilliseconds ? (darkMode ? 'white' : '#3A36DB') : (darkMode ? '#999' : '#666'),
            fontWeight: !showInMilliseconds ? 'bold' : 'normal',
            border: `1px solid ${darkMode ? '#3d3d52' : '#e0e0e0'}`,
          }}>
            <input
              type="radio"
              checked={!showInMilliseconds}
              onChange={() => setShowInMilliseconds(false)}
              style={{ marginRight: '5px', display: 'none' }}
            />
            Microseconds (µs)
          </label>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            cursor: 'pointer',
            backgroundColor: showInMilliseconds ? (darkMode ? '#3A36DB' : '#e6e9fd') : 'transparent',
            padding: '5px 10px',
            borderRadius: '4px',
            color: showInMilliseconds ? (darkMode ? 'white' : '#3A36DB') : (darkMode ? '#999' : '#666'),
            fontWeight: showInMilliseconds ? 'bold' : 'normal',
            border: `1px solid ${darkMode ? '#3d3d52' : '#e0e0e0'}`,
          }}>
            <input
              type="radio"
              checked={showInMilliseconds}
              onChange={() => setShowInMilliseconds(true)}
              style={{ marginRight: '5px', display: 'none' }}
            />
            Milliseconds (ms)
          </label>
        </div>
      </div>
    );
  };

  return (
    <div>
      {renderUnitToggle()}
      <SynchronizedCharts 
        data={formattedData} 
        metrics={displayMetrics}
        darkMode={darkMode}
        isLogarithmic={isLogarithmic}
        unitSuffix={isLatencyData ? (showInMilliseconds ? ' ms' : ' µs') : ''}
      />
    </div>
  );
}; 