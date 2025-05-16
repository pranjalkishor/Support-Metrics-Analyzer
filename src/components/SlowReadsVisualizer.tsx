import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ParsedTimeSeries } from '../types';

interface SlowReadsVisualizerProps {
  slowReadsData: ParsedTimeSeries;
}

// Define the structure of file counts in metadata
interface FileCounts {
  [filePath: string]: number;
}

export const SlowReadsVisualizer: React.FC<SlowReadsVisualizerProps> = ({ slowReadsData }) => {
  // For timeline chart (by hour) - used for aggregated trend line
  const hourlyData = useMemo(() => {
    if (!slowReadsData || !slowReadsData.timestamps || !slowReadsData.timestamps.length) {
      return [];
    }

    // Group by hour
    const hourCounts: Record<string, { 
      hour: string, 
      count: number,
      timestamp: number,
      formattedHour: string
    }> = {};

    slowReadsData.timestamps.forEach((timestamp) => {
      const date = new Date(timestamp);
      // Round to the hour
      const hourDate = new Date(date);
      hourDate.setMinutes(0, 0, 0);
      
      const hourKey = hourDate.toISOString();
      const hourTimestamp = hourDate.getTime();
      const formattedHour = hourDate.toLocaleString(undefined, {
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      if (!hourCounts[hourKey]) {
        hourCounts[hourKey] = {
          hour: hourDate.toISOString().replace('T', ' ').substring(0, 13) + ":00",
          formattedHour,
          count: 0,
          timestamp: hourTimestamp
        };
      }
      
      hourCounts[hourKey].count += 1;
    });

    // Convert to array and sort by timestamp
    return Object.values(hourCounts)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [slowReadsData]);

  if (!slowReadsData || !slowReadsData.timestamps || slowReadsData.timestamps.length === 0) {
    return <div>No slow reads data available.</div>;
  }

  return (
    <div className="slow-reads-visualizer">
      <h2>Slow Async Reads</h2>
      
      <div className="summary-info" style={{ 
        padding: '1rem', 
        borderRadius: '8px', 
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)', 
        width: '30%', 
        textAlign: 'center',
        margin: '0 auto 20px auto'
      }}>
        <h3>Total Slow Async Reads</h3>
        <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>{slowReadsData.timestamps.length}</p>
      </div>
      
      <div className="chart-container" style={{ height: '500px' }}>
        <h3>Slow Async Reads Trend by Hour</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={hourlyData}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="formattedHour" 
              tick={{ fontSize: 10 }} 
              angle={-45} 
              textAnchor="end"
              height={80}
              interval={Math.max(1, Math.floor(hourlyData.length / 10))} // Show ~10 ticks
            />
            <YAxis 
              label={{ value: 'Message Count', angle: -90, position: 'insideLeft' }}
              allowDecimals={false}
            />
            <Tooltip 
              formatter={(value) => [`${value} messages`, 'Message Count']}
              labelFormatter={(label) => `Time: ${label}`}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="count" 
              name="Slow Async Reads" 
              stroke="#FF5C35" 
              strokeWidth={3}
              dot={{ r: 5, fill: "#FF5C35" }}
              activeDot={{ r: 7 }}
              connectNulls={true}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="example-message" style={{ 
        marginTop: '30px',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '5px',
        border: '1px solid #dee2e6',
        fontFamily: 'monospace',
        fontSize: '14px',
        overflowX: 'auto'
      }}>
        <h3>Example Message</h3>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          WARN  [CoreThread-3] 2025-05-15 12:45:28,318  NoSpamLogger.java:97 - Timed out async read from org.apache.cassandra.io.sstable.format.AsyncPartitionReader for file /data/cassandra/data/efxprod/acct_details-53b5aad2c05411e7bd96cb28320625f3/ad-273688-bti-Data.db
        </pre>
      </div>
    </div>
  );
}; 