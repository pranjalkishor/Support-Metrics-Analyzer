import React, { useEffect, useState } from "react";
import Plot from "react-plotly.js";
import { ParsedTimeSeries } from "../types";
import { PlotData } from 'plotly.js';

declare module 'react-plotly.js';

type Props = {
  data: ParsedTimeSeries;
  selectedMetrics: string[];
  isLogarithmic?: boolean; // Add this prop
  darkMode: boolean;
};

export const TimeSeriesChart: React.FC<Props> = ({ data, selectedMetrics, isLogarithmic = false, darkMode }) => {
  // State for user preference of latency unit display
  const [showInMilliseconds, setShowInMilliseconds] = useState(false);
  
  // Check if we're showing any latency metrics
  const showingLatency = selectedMetrics.some(m => m.toLowerCase().includes('latency'));
  
  // Debug logging on render
  useEffect(() => {
    console.log("TimeSeriesChart rendering with:", {
      timestamps: data.timestamps.length,
      selectedMetrics,
      hasData: selectedMetrics.every(m => data.series[m] && data.series[m].some(v => !isNaN(v))),
      showInMilliseconds
    });
    
    // Debug data for the first selected metric
    if (selectedMetrics.length > 0) {
      const firstMetric = selectedMetrics[0];
      if (data.series[firstMetric]) {
        const values = data.series[firstMetric];
        const validCount = values.filter(v => !isNaN(v)).length;
        console.log(`First metric "${firstMetric}": ${validCount}/${values.length} valid data points`);
      } else {
        console.error(`Metric "${firstMetric}" not found in data series!`);
      }
    }
  }, [data, selectedMetrics, showInMilliseconds]);

  // Determine appropriate y-axis title based on unit preference
  const yAxisTitle = showingLatency 
    ? `Latency (${showInMilliseconds ? 'milliseconds' : 'microseconds'})`
    : 'Value';

  // Process and validate data for plotting
  const plotData = selectedMetrics
    .filter(metric => data.series[metric]) // Only include metrics that exist in the data
    .map(metric => {
      const isLatencyMetric = metric.toLowerCase().includes('latency');
      
      // Create clean data without NaN values for better visualization
      const cleanData = data.series[metric].map((y, i) => {
        if (isNaN(y)) return null;
        
        // For latency metrics, convert based on user preference
        let convertedValue = y;
        let unit = '';
        
        if (isLatencyMetric && showInMilliseconds) {
          // Convert to milliseconds when user has selected that option
          convertedValue = y / 1000;
          unit = 'ms';
        } else if (isLatencyMetric) {
          // Keep in microseconds (default)
          unit = 'µs';
        }
        
        return { 
          x: data.timestamps[i], 
          y: convertedValue,
          unit: unit
        };
      }).filter((point): point is {x: string, y: number, unit: string} => point !== null);
      
      return {
        x: cleanData.map(p => p.x),
        y: cleanData.map(p => p.y),
        type: 'scatter' as const,
        mode: 'lines+markers' as const,
        name: metric,
        line: {
          width: 2,
          shape: 'spline' as 'spline'
        },
        marker: {
          size: 4
        },
        customdata: cleanData.map(p => p.unit),
        hovertemplate: isLatencyMetric 
          ? '%{y:.2f} %{customdata}<br>%{x}<extra>%{fullData.name}</extra>' 
          : '%{y}<br>%{x}<extra>%{fullData.name}</extra>'
      };
    });

  const layout = {
    autosize: true,
    height: 500,
    margin: { l: 60, r: 50, b: 50, t: 30, pad: 4 },
    paper_bgcolor: darkMode ? '#1e1e30' : 'white',
    plot_bgcolor: darkMode ? '#1e1e30' : 'white',
    font: {
      family: 'Arial, sans-serif',
      size: 12,
      color: darkMode ? '#e1e1e1' : '#333'
    },
    legend: {
      font: {
        family: 'Arial, sans-serif',
        size: 10,
        color: darkMode ? '#e1e1e1' : '#333'
      }
    },
    xaxis: {
      gridcolor: darkMode ? '#333' : '#eee',
      linecolor: darkMode ? '#444' : '#ccc',
      tickfont: {
        color: darkMode ? '#e1e1e1' : '#333'
      },
      title: 'Time'
    },
    yaxis: {
      type: isLogarithmic ? ('log' as 'log') : ('linear' as 'linear'),
      gridcolor: darkMode ? '#333' : '#eee',
      linecolor: darkMode ? '#444' : '#ccc',
      tickfont: {
        color: darkMode ? '#e1e1e1' : '#333'
      },
      title: yAxisTitle
    },
    hovermode: 'closest' as 'closest'
  };

  const config = {
    responsive: true,
    displayModeBar: true
  };

  // Conditional rendering based on data availability
  if (plotData.length === 0) {
    return (
      <div style={{
        height: 500,
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

  // Render unit toggle only when showing latency metrics
  const renderUnitToggle = () => {
    if (!showingLatency) return null;
    
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginBottom: '12px'
      }}>
        <span style={{ 
          fontSize: '14px', 
          marginRight: '10px',
          color: darkMode ? '#e1e1e1' : '#333'
        }}>
          Show latency in:
        </span>
        <label style={{ 
          display: 'inline-flex',
          alignItems: 'center',
          marginRight: '10px',
          cursor: 'pointer',
          color: darkMode ? '#e1e1e1' : '#333'
        }}>
          <input
            type="radio"
            checked={!showInMilliseconds}
            onChange={() => setShowInMilliseconds(false)}
            style={{ marginRight: '5px' }}
          />
          Microseconds (µs)
        </label>
        <label style={{ 
          display: 'inline-flex',
          alignItems: 'center',
          cursor: 'pointer',
          color: darkMode ? '#e1e1e1' : '#333'
        }}>
          <input
            type="radio"
            checked={showInMilliseconds}
            onChange={() => setShowInMilliseconds(true)}
            style={{ marginRight: '5px' }}
          />
          Milliseconds (ms)
        </label>
      </div>
    );
  };

  return (
    <div>
      {renderUnitToggle()}
      <Plot
        data={plotData}
        layout={layout}
        config={config}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};
