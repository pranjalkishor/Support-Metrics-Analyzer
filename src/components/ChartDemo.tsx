import React, { useState, useEffect } from 'react';
import { SynchronizedCharts } from './ZoomableCharts';

const DATASTAX_COLORS = {
  primary: '#3A36DB', // DataStax blue
  secondary: '#FF5C35', // DataStax orange
  tertiary: '#00C7B7', // Teal
  quaternary: '#6C11A5', // Purple
};

// Sample data generator
const generateSampleData = (count: number = 100) => {
  const data = [];
  
  // Start date 24 hours ago
  const now = new Date();
  const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  for (let i = 0; i < count; i++) {
    // Create timestamps at regular intervals
    const timestamp = new Date(startTime.getTime() + i * (24 * 60 * 60 * 1000 / count));
    
    // CPU data with a sine wave pattern (25-75% range)
    const cpuValue = 50 + 25 * Math.sin(i / 10) + Math.random() * 10;
    
    // Heap data with a growth and GC pattern
    let heapValue = 200 + i * 8 + Math.random() * 20;
    // Simulate occasional GC
    if (i % 25 === 0) {
      heapValue = 200 + Math.random() * 50;
    }
    
    data.push({
      timestamp: timestamp.toISOString(),
      cpu: cpuValue.toFixed(2),
      heap: heapValue.toFixed(2),
      latency: (50 + 20 * Math.sin(i / 5) + Math.random() * 30).toFixed(2),
      throughput: (500 + 100 * Math.cos(i / 15) + Math.random() * 50).toFixed(2)
    });
  }
  
  return data;
};

export const ChartDemo: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  
  // Generate sample data on component mount
  useEffect(() => {
    setData(generateSampleData(100));
  }, []);
  
  // Define the metrics to display
  const metrics = [
    {
      dataKey: 'cpu',
      name: 'CPU Usage (%)',
      color: DATASTAX_COLORS.primary
    },
    {
      dataKey: 'heap',
      name: 'Heap Allocation (MB)',
      color: DATASTAX_COLORS.secondary
    },
    {
      dataKey: 'latency',
      name: 'Latency (ms)',
      color: DATASTAX_COLORS.tertiary
    },
    {
      dataKey: 'throughput',
      name: 'Throughput (ops/sec)',
      color: DATASTAX_COLORS.quaternary
    }
  ];
  
  return (
    <div style={{
      padding: 24,
      maxWidth: '1400px',
      margin: '0 auto'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        padding: '24px',
        marginBottom: '24px'
      }}>
        <h1 style={{ 
          margin: '0 0 16px 0', 
          fontSize: '24px' 
        }}>
          Synchronized Zoomable Charts Demo
        </h1>
        <p>
          This demo shows synchronized charts with zoom functionality. Select a time range in any chart to zoom all charts simultaneously.
        </p>
      </div>
      
      {data.length > 0 ? (
        <div style={{
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          padding: '24px'
        }}>
          <SynchronizedCharts 
            data={data} 
            metrics={metrics} 
          />
        </div>
      ) : (
        <div style={{
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          padding: '24px',
          textAlign: 'center'
        }}>
          Loading data...
        </div>
      )}
    </div>
  );
}; 