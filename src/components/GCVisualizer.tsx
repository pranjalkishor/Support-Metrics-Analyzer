import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ParsedTimeSeries } from '../types';

interface GCVisualizerProps {
  gcData: ParsedTimeSeries;
}

export const GCVisualizer: React.FC<GCVisualizerProps> = ({ gcData }) => {
  const [sortField, setSortField] = useState<string>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Prepare data for the chart
  const chartData = useMemo(() => {
    if (!gcData || !gcData.timestamps || !gcData.series || gcData.timestamps.length === 0) {
      return [];
    }

    // Get GC types from metadata
    const gcTypes = gcData.metadata?.gcTypes || [];

    return gcData.timestamps.map((timestamp, index) => {
      const formattedTime = new Date(timestamp).toLocaleString();
      
      return {
        timestamp: formattedTime,
        duration: gcData.series["GC Duration (ms)"][index],
        type: gcTypes[index] || 'unknown',
        rawTimestamp: timestamp, // Keep original for sorting
      };
    });
  }, [gcData]);

  // Prepare data for the table with sorting
  const tableData = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return [];
    }

    // Create a copy of the data for sorting
    const sortedData = [...chartData];
    
    // Sort the data
    return sortedData.sort((a, b) => {
      if (sortField === 'timestamp') {
        const aVal = new Date(a.rawTimestamp).getTime();
        const bVal = new Date(b.rawTimestamp).getTime();
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      } else if (sortField === 'type') {
        // Sort alphabetically for type field
        return sortDirection === 'asc' 
          ? a.type.localeCompare(b.type)
          : b.type.localeCompare(a.type);
      } else {
        const aVal = a[sortField as keyof typeof a] || 0;
        const bVal = b[sortField as keyof typeof b] || 0;
        return sortDirection === 'asc' 
          ? (aVal < bVal ? -1 : aVal > bVal ? 1 : 0)
          : (aVal > bVal ? -1 : aVal < bVal ? 1 : 0);
      }
    });
  }, [chartData, sortField, sortDirection]);

  // Handle sort column click
  const handleSortClick = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc'); // Default to descending for new sort field
    }
  };

  // Render sort indicator
  const renderSortIndicator = (field: string) => {
    if (sortField !== field) return null;
    return <span>{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>;
  };

  // Generate data for the GC type counts and create series for the chart
  const gcTypeCounts = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return { young: 0, old: 0, unknown: 0 };
    }

    return chartData.reduce((counts, item) => {
      counts[item.type] = (counts[item.type] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
  }, [chartData]);

  if (!gcData || !gcData.timestamps || gcData.timestamps.length === 0) {
    return <div>No GC data available.</div>;
  }

  return (
    <div className="gc-visualizer">
      <h2>Garbage Collection Analysis</h2>
      
      <div className="summary-boxes" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div className="summary-box" style={{ padding: '1rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', width: '30%', textAlign: 'center' }}>
          <h3>Total GC Events</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>{gcData.timestamps.length}</p>
        </div>
        <div className="summary-box" style={{ padding: '1rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', width: '30%', textAlign: 'center' }}>
          <h3>Young Generation</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>{gcTypeCounts.young || 0}</p>
        </div>
        <div className="summary-box" style={{ padding: '1rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', width: '30%', textAlign: 'center' }}>
          <h3>Old Generation</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>{gcTypeCounts.old || 0}</p>
        </div>
      </div>
      
      <div className="chart-container" style={{ height: '400px' }}>
        <h3>GC Duration Over Time</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="timestamp" 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
              }}
            />
            <YAxis 
              label={{ value: 'Duration (ms)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              formatter={(value, name) => {
                return [`${value} ms`, name === 'duration' ? 'GC Duration' : 'Duration'];
              }}
              labelFormatter={(label) => `Time: ${label}`}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="duration" 
              name="GC Duration"
              stroke="#8884d8" 
              activeDot={{ r: 8 }} 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="table-container" style={{ marginTop: '30px' }}>
        <h3>GC Events</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => handleSortClick('timestamp')}>
                  Timestamp{renderSortIndicator('timestamp')}
                </th>
                <th onClick={() => handleSortClick('duration')}>
                  Duration (ms){renderSortIndicator('duration')}
                </th>
                <th onClick={() => handleSortClick('type')}>
                  Type{renderSortIndicator('type')}
                </th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, index) => (
                <tr key={index}>
                  <td>{row.timestamp}</td>
                  <td>{row.duration}</td>
                  <td style={{ textTransform: 'capitalize' }}>{row.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}; 