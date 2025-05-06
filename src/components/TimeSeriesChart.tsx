import React from "react";
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
  const plotData = selectedMetrics.map(metric => {
    return {
      x: data.timestamps,
      y: data.series[metric],
      type: 'scatter' as const,
      mode: 'lines' as const,
      name: metric,
      line: {
        width: 2,
        shape: 'spline' as 'spline'
      }
    };
  });

  // Determine if we're showing latency metrics to adjust y-axis title
  const showingLatency = selectedMetrics.some(m => m.toLowerCase().includes('latency'));
  const yAxisTitle = showingLatency ? 'Latency (milliseconds)' : 'Value';

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

  return (
    <Plot
      data={plotData}
      layout={layout}
      config={config}
      style={{ width: '100%', height: '100%' }}
    />
  );
};
