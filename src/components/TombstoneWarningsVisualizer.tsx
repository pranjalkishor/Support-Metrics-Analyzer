import React, { useState, useMemo } from 'react';
import { ComposedChart, BarChart, LineChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Scatter } from 'recharts';
import { ParsedTimeSeries } from '../types';

interface TombstoneWarningsVisualizerProps {
  tombstoneData: ParsedTimeSeries;
}

export const TombstoneWarningsVisualizer: React.FC<TombstoneWarningsVisualizerProps> = ({ tombstoneData }) => {
  const [sortField, setSortField] = useState<string>('tombstones');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [activeTab, setActiveTab] = useState<'queries' | 'tables'>('queries');

  // Prepare data for the chart - individual log entries
  const timelineData = useMemo(() => {
    if (!tombstoneData || !tombstoneData.timestamps || !tombstoneData.timestamps.length) {
      return [];
    }

    // Create data points for each log entry
    return tombstoneData.timestamps.map((timestamp, index) => {
      const date = new Date(timestamp);
      return {
        timestamp,
        formattedTime: date.toISOString().replace('T', ' ').substring(0, 19),
        tombstones: tombstoneData.series["Tombstone Cells"][index] || 0,
        liveRows: tombstoneData.series["Live Rows"][index] || 0,
        value: 1 // Just tracking occurrence
      };
    }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [tombstoneData]);

  // Prepare data for table statistics
  const tableStatsData = useMemo(() => {
    if (!tombstoneData?.metadata?.tableStats) return [];
    return tombstoneData.metadata.tableStats;
  }, [tombstoneData]);

  // Prepare table data with details of each query with tombstones
  const queryTableData = useMemo(() => {
    if (!tombstoneData?.metadata?.queryData) return [];

    // Create a copy for sorting
    const sortedData = [...tombstoneData.metadata.queryData];
    
    return sortedData.sort((a, b) => {
      if (sortField === 'timestamp') {
        const aTime = new Date(a.timestamp).getTime();
        const bTime = new Date(b.timestamp).getTime();
        return sortDirection === 'asc' ? aTime - bTime : bTime - aTime;
      } else {
        const aVal = a[sortField as keyof typeof a] || 0;
        const bVal = b[sortField as keyof typeof b] || 0;
        return sortDirection === 'asc' 
          ? (aVal < bVal ? -1 : aVal > bVal ? 1 : 0)
          : (aVal > bVal ? -1 : aVal < bVal ? 1 : 0);
      }
    });
  }, [tombstoneData, sortField, sortDirection]);

  // Handle sort column click
  const handleSortClick = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Render sort indicator
  const renderSortIndicator = (field: string) => {
    if (sortField !== field) return null;
    return <span>{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>;
  };

  if (!tombstoneData || !tombstoneData.timestamps || tombstoneData.timestamps.length === 0) {
    return <div>No tombstone warning data available.</div>;
  }

  return (
    <div className="tombstone-warnings-visualizer">
      <h2>Tombstone Warnings Analysis</h2>
      
      {/* Summary Statistics */}
      <div className="summary-boxes" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div className="summary-box" style={{ padding: '1rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', width: '30%', textAlign: 'center' }}>
          <h3>Total Warnings</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>{tombstoneData.timestamps.length}</p>
        </div>
        <div className="summary-box" style={{ padding: '1rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', width: '30%', textAlign: 'center' }}>
          <h3>Total Tombstones</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>
            {tombstoneData.series["Tombstone Cells"].reduce((a, b) => a + b, 0).toLocaleString()}
          </p>
        </div>
        <div className="summary-box" style={{ padding: '1rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', width: '30%', textAlign: 'center' }}>
          <h3>Unique Tables</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>{tableStatsData.length}</p>
        </div>
      </div>
      
      <div className="chart-container" style={{ height: '400px' }}>
        <h3>Tombstone Warnings Timeline</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={timelineData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
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
              label={{ value: 'Tombstones Count', angle: -90, position: 'insideLeft' }}
              domain={[0, 'dataMax']}
            />
            <Tooltip 
              formatter={(value, name) => [value.toLocaleString(), name]}
              labelFormatter={(label) => `Time: ${label}`}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="tombstones" 
              name="Tombstones in Message" 
              stroke="#ff7300"
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
            <Scatter 
              dataKey="value" 
              fill="#8884d8" 
              name="Warning Message" 
              shape="circle"
              line={{ stroke: 'rgba(136, 132, 216, 0.3)', strokeWidth: 1 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {/* Table Statistics Chart */}
      <div className="chart-container" style={{ height: '400px', marginTop: '30px' }}>
        <h3>Tombstones by Table</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={tableStatsData.slice(0, 10)} // Show top 10 tables
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            layout="vertical"
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis 
              type="category"
              dataKey="tableName" 
              width={150}
              tick={{ fontSize: 12 }}
            />
            <Tooltip />
            <Legend />
            <Bar 
              dataKey="tombstones" 
              name="Tombstone Cells"
              fill="#ff7300" 
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Tab Navigation */}
      <div className="tab-navigation" style={{ marginTop: '30px', marginBottom: '15px' }}>
        <button 
          className={activeTab === 'queries' ? 'active' : ''}
          style={{ 
            padding: '8px 16px', 
            backgroundColor: activeTab === 'queries' ? '#3A36DB' : '#f1f1f1',
            color: activeTab === 'queries' ? 'white' : 'black',
            border: 'none',
            borderRadius: '4px',
            marginRight: '10px',
            cursor: 'pointer'
          }}
          onClick={() => setActiveTab('queries')}
        >
          Top Queries
        </button>
        <button 
          className={activeTab === 'tables' ? 'active' : ''}
          style={{ 
            padding: '8px 16px', 
            backgroundColor: activeTab === 'tables' ? '#3A36DB' : '#f1f1f1',
            color: activeTab === 'tables' ? 'white' : 'black',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
          onClick={() => setActiveTab('tables')}
        >
          Tables
        </button>
      </div>
      
      {/* Top Queries Table */}
      {activeTab === 'queries' && (
        <div className="table-container">
          <h3>Top 20 Queries with Tombstone Warnings</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th onClick={() => handleSortClick('timestamp')}>
                    Timestamp{renderSortIndicator('timestamp')}
                  </th>
                  <th onClick={() => handleSortClick('tableName')}>
                    Table{renderSortIndicator('tableName')}
                  </th>
                  <th onClick={() => handleSortClick('liveRows')}>
                    Live Rows{renderSortIndicator('liveRows')}
                  </th>
                  <th onClick={() => handleSortClick('tombstones')}>
                    Tombstones{renderSortIndicator('tombstones')}
                  </th>
                  <th onClick={() => handleSortClick('ratio')}>
                    Tombstone Ratio{renderSortIndicator('ratio')}
                  </th>
                  <th>Query</th>
                </tr>
              </thead>
              <tbody>
                {queryTableData.map((row, index) => (
                  <tr key={index}>
                    <td>{new Date(row.timestamp).toLocaleString()}</td>
                    <td>{row.tableName}</td>
                    <td>{row.liveRows}</td>
                    <td>{row.tombstones}</td>
                    <td>{(row.ratio * 100).toFixed(2)}%</td>
                    <td className="query-text">{row.query}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Tables Stats Table */}
      {activeTab === 'tables' && (
        <div className="table-container">
          <h3>Tombstones by Table</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th onClick={() => handleSortClick('tableName')}>
                    Table Name{renderSortIndicator('tableName')}
                  </th>
                  <th onClick={() => handleSortClick('tombstones')}>
                    Total Tombstones{renderSortIndicator('tombstones')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {tableStatsData.map((row: { tableName: string; tombstones: number }, index: number) => (
                  <tr key={index}>
                    <td>{row.tableName}</td>
                    <td>{row.tombstones.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}; 