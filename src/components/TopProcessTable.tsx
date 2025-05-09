import React, { useState, useEffect } from 'react';
import { ProcessData, TopSnapshot } from '../parsers/os_top_cpu';

interface TopProcessTableProps {
  snapshots: TopSnapshot[];
  currentSnapshotIndex: number;
  darkMode: boolean;
}

type SortField = 'pid' | 'user' | 'cpuPercentage' | 'memPercentage' | 'virtualMem' | 'residentMem' | 'command';
type SortDirection = 'asc' | 'desc';

export const TopProcessTable: React.FC<TopProcessTableProps> = ({ 
  snapshots, 
  currentSnapshotIndex,
  darkMode
}) => {
  const [sortField, setSortField] = useState<SortField>('cpuPercentage');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [processes, setProcesses] = useState<ProcessData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMinCpu, setFilterMinCpu] = useState(0);
  const [filterMinMem, setFilterMinMem] = useState(0);
  
  // Format memory values (like 270.2g, 48.7g) for proper sorting
  const parseMemValue = (value: string): number => {
    const match = value.match(/^(\d+(?:\.\d+)?)([a-zA-Z]*)$/);
    if (!match) return 0;
    
    const num = parseFloat(match[1]);
    const unit = match[2]?.toLowerCase() || '';
    
    switch (unit) {
      case 't': return num * 1024 * 1024 * 1024 * 1024;
      case 'g': return num * 1024 * 1024 * 1024;
      case 'm': return num * 1024 * 1024;
      case 'k': return num * 1024;
      default: return num;
    }
  };
  
  // Update processes when current snapshot changes
  useEffect(() => {
    if (snapshots.length === 0 || currentSnapshotIndex < 0 || currentSnapshotIndex >= snapshots.length) {
      setProcesses([]);
      return;
    }
    
    setProcesses(snapshots[currentSnapshotIndex].processes);
  }, [snapshots, currentSnapshotIndex]);
  
  // Handle sorting
  const handleSort = (field: SortField) => {
    if (field === sortField) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to descending for CPU and MEM, ascending for others
      setSortField(field);
      if (field === 'cpuPercentage' || field === 'memPercentage') {
        setSortDirection('desc');
      } else {
        setSortDirection('asc');
      }
    }
  };
  
  // Sort and filter processes
  const sortedProcesses = [...processes]
    .filter(process => {
      // Apply search term filter
      if (searchTerm && !process.command.toLowerCase().includes(searchTerm.toLowerCase()) && 
          !process.user.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !process.pid.toString().includes(searchTerm)) {
        return false;
      }
      
      // Apply CPU and memory filters
      if (process.cpuPercentage < filterMinCpu || process.memPercentage < filterMinMem) {
        return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'pid':
          comparison = a.pid - b.pid;
          break;
        case 'user':
          comparison = a.user.localeCompare(b.user);
          break;
        case 'cpuPercentage':
          comparison = a.cpuPercentage - b.cpuPercentage;
          break;
        case 'memPercentage':
          comparison = a.memPercentage - b.memPercentage;
          break;
        case 'virtualMem':
          comparison = parseMemValue(a.virtualMem) - parseMemValue(b.virtualMem);
          break;
        case 'residentMem':
          comparison = parseMemValue(a.residentMem) - parseMemValue(b.residentMem);
          break;
        case 'command':
          comparison = a.command.localeCompare(b.command);
          break;
        default:
          comparison = 0;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  
  // Get timestamp and load average for the current snapshot
  const currentTimestamp = snapshots[currentSnapshotIndex]?.timestamp || 'No data';
  const currentLoad = snapshots[currentSnapshotIndex]?.systemInfo.load || 'N/A';
  
  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  };
  
  return (
    <div style={{
      backgroundColor: darkMode ? '#1e1e30' : '#ffffff',
      color: darkMode ? '#e1e1e1' : '#333333',
      borderRadius: '8px',
      padding: '16px',
      boxShadow: `0 2px 4px ${darkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)'}`,
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h3 style={{ margin: '0 0 8px 0' }}>Process Usage at {currentTimestamp}</h3>
          <div style={{ fontSize: '14px' }}>Load Average: {currentLoad}</div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '12px', marginBottom: '4px' }}>Search:</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by command, user, PID..."
              style={{
                padding: '8px',
                border: `1px solid ${darkMode ? '#444' : '#ddd'}`,
                borderRadius: '4px',
                backgroundColor: darkMode ? '#2a2a40' : '#fff',
                color: darkMode ? '#e1e1e1' : '#333',
              }}
            />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '12px', marginBottom: '4px' }}>Min CPU %:</label>
            <input
              type="number"
              min="0"
              max="100"
              value={filterMinCpu}
              onChange={(e) => setFilterMinCpu(parseFloat(e.target.value) || 0)}
              style={{
                padding: '8px',
                border: `1px solid ${darkMode ? '#444' : '#ddd'}`,
                borderRadius: '4px',
                backgroundColor: darkMode ? '#2a2a40' : '#fff',
                color: darkMode ? '#e1e1e1' : '#333',
                width: '80px'
              }}
            />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '12px', marginBottom: '4px' }}>Min MEM %:</label>
            <input
              type="number"
              min="0"
              max="100"
              value={filterMinMem}
              onChange={(e) => setFilterMinMem(parseFloat(e.target.value) || 0)}
              style={{
                padding: '8px',
                border: `1px solid ${darkMode ? '#444' : '#ddd'}`,
                borderRadius: '4px',
                backgroundColor: darkMode ? '#2a2a40' : '#fff',
                color: darkMode ? '#e1e1e1' : '#333',
                width: '80px'
              }}
            />
          </div>
        </div>
      </div>
      
      <div style={{ overflowX: 'auto' }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          fontSize: '14px',
        }}>
          <thead>
            <tr style={{
              backgroundColor: darkMode ? '#2a2a40' : '#f5f5f8',
              color: darkMode ? '#e1e1e1' : '#333333',
            }}>
              <th 
                onClick={() => handleSort('pid')} 
                style={{ 
                  padding: '10px', 
                  textAlign: 'left', 
                  borderBottom: `1px solid ${darkMode ? '#444' : '#ddd'}`,
                  cursor: 'pointer'
                }}
              >
                PID {renderSortIndicator('pid')}
              </th>
              <th 
                onClick={() => handleSort('user')} 
                style={{ 
                  padding: '10px', 
                  textAlign: 'left', 
                  borderBottom: `1px solid ${darkMode ? '#444' : '#ddd'}`,
                  cursor: 'pointer'
                }}
              >
                USER {renderSortIndicator('user')}
              </th>
              <th style={{ 
                padding: '10px', 
                textAlign: 'left', 
                borderBottom: `1px solid ${darkMode ? '#444' : '#ddd'}`,
              }}>
                PR
              </th>
              <th style={{ 
                padding: '10px', 
                textAlign: 'left', 
                borderBottom: `1px solid ${darkMode ? '#444' : '#ddd'}`,
              }}>
                NI
              </th>
              <th 
                onClick={() => handleSort('virtualMem')} 
                style={{ 
                  padding: '10px', 
                  textAlign: 'left', 
                  borderBottom: `1px solid ${darkMode ? '#444' : '#ddd'}`,
                  cursor: 'pointer'
                }}
              >
                VIRT {renderSortIndicator('virtualMem')}
              </th>
              <th 
                onClick={() => handleSort('residentMem')} 
                style={{ 
                  padding: '10px', 
                  textAlign: 'left', 
                  borderBottom: `1px solid ${darkMode ? '#444' : '#ddd'}`,
                  cursor: 'pointer'
                }}
              >
                RES {renderSortIndicator('residentMem')}
              </th>
              <th style={{ 
                padding: '10px', 
                textAlign: 'left', 
                borderBottom: `1px solid ${darkMode ? '#444' : '#ddd'}`,
              }}>
                SHR
              </th>
              <th style={{ 
                padding: '10px', 
                textAlign: 'left', 
                borderBottom: `1px solid ${darkMode ? '#444' : '#ddd'}`,
              }}>
                S
              </th>
              <th 
                onClick={() => handleSort('cpuPercentage')} 
                style={{ 
                  padding: '10px', 
                  textAlign: 'right', 
                  borderBottom: `1px solid ${darkMode ? '#444' : '#ddd'}`,
                  cursor: 'pointer'
                }}
              >
                %CPU {renderSortIndicator('cpuPercentage')}
              </th>
              <th 
                onClick={() => handleSort('memPercentage')} 
                style={{ 
                  padding: '10px', 
                  textAlign: 'right', 
                  borderBottom: `1px solid ${darkMode ? '#444' : '#ddd'}`,
                  cursor: 'pointer'
                }}
              >
                %MEM {renderSortIndicator('memPercentage')}
              </th>
              <th style={{ 
                padding: '10px', 
                textAlign: 'left', 
                borderBottom: `1px solid ${darkMode ? '#444' : '#ddd'}`,
              }}>
                TIME+
              </th>
              <th 
                onClick={() => handleSort('command')} 
                style={{ 
                  padding: '10px', 
                  textAlign: 'left', 
                  borderBottom: `1px solid ${darkMode ? '#444' : '#ddd'}`,
                  cursor: 'pointer'
                }}
              >
                COMMAND {renderSortIndicator('command')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedProcesses.length > 0 ? (
              sortedProcesses.map((process, index) => (
                <tr 
                  key={`${process.pid}-${index}`}
                  style={{
                    backgroundColor: index % 2 === 0 ? 
                      (darkMode ? '#232333' : '#f9f9f9') : 
                      (darkMode ? '#1e1e30' : '#ffffff'),
                    // Highlight high CPU or memory usage
                    ...(process.cpuPercentage > 90 || process.memPercentage > 50 ? {
                      backgroundColor: darkMode ? '#3a2828' : '#ffe8e8'
                    } : {})
                  }}
                >
                  <td style={{ 
                    padding: '8px', 
                    borderBottom: `1px solid ${darkMode ? '#333' : '#eee'}`,
                  }}>
                    {process.pid}
                  </td>
                  <td style={{ 
                    padding: '8px', 
                    borderBottom: `1px solid ${darkMode ? '#333' : '#eee'}`,
                  }}>
                    {process.user}
                  </td>
                  <td style={{ 
                    padding: '8px', 
                    borderBottom: `1px solid ${darkMode ? '#333' : '#eee'}`,
                  }}>
                    {process.priority}
                  </td>
                  <td style={{ 
                    padding: '8px', 
                    borderBottom: `1px solid ${darkMode ? '#333' : '#eee'}`,
                  }}>
                    {process.nice}
                  </td>
                  <td style={{ 
                    padding: '8px', 
                    borderBottom: `1px solid ${darkMode ? '#333' : '#eee'}`,
                  }}>
                    {process.virtualMem}
                  </td>
                  <td style={{ 
                    padding: '8px', 
                    borderBottom: `1px solid ${darkMode ? '#333' : '#eee'}`,
                  }}>
                    {process.residentMem}
                  </td>
                  <td style={{ 
                    padding: '8px', 
                    borderBottom: `1px solid ${darkMode ? '#333' : '#eee'}`,
                  }}>
                    {process.sharedMem}
                  </td>
                  <td style={{ 
                    padding: '8px', 
                    borderBottom: `1px solid ${darkMode ? '#333' : '#eee'}`,
                  }}>
                    {process.status}
                  </td>
                  <td style={{ 
                    padding: '8px', 
                    borderBottom: `1px solid ${darkMode ? '#333' : '#eee'}`,
                    textAlign: 'right',
                    fontWeight: process.cpuPercentage > 50 ? 'bold' : 'normal',
                    color: process.cpuPercentage > 90 ? 
                      (darkMode ? '#ff7373' : '#d32f2f') : 
                      (process.cpuPercentage > 50 ? 
                        (darkMode ? '#ffa726' : '#ef6c00') : 
                        (darkMode ? '#e1e1e1' : '#333333'))
                  }}>
                    {process.cpuPercentage.toFixed(1)}
                  </td>
                  <td style={{ 
                    padding: '8px', 
                    borderBottom: `1px solid ${darkMode ? '#333' : '#eee'}`,
                    textAlign: 'right',
                    fontWeight: process.memPercentage > 30 ? 'bold' : 'normal',
                    color: process.memPercentage > 50 ? 
                      (darkMode ? '#ff7373' : '#d32f2f') : 
                      (process.memPercentage > 30 ? 
                        (darkMode ? '#ffa726' : '#ef6c00') : 
                        (darkMode ? '#e1e1e1' : '#333333'))
                  }}>
                    {process.memPercentage.toFixed(1)}
                  </td>
                  <td style={{ 
                    padding: '8px', 
                    borderBottom: `1px solid ${darkMode ? '#333' : '#eee'}`,
                  }}>
                    {process.time}
                  </td>
                  <td style={{ 
                    padding: '8px', 
                    borderBottom: `1px solid ${darkMode ? '#333' : '#eee'}`,
                    maxWidth: '300px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {process.command}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td 
                  colSpan={12} 
                  style={{ 
                    padding: '20px', 
                    textAlign: 'center',
                    color: darkMode ? '#999' : '#666'
                  }}
                >
                  No processes match the current filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      <div style={{ 
        marginTop: '16px', 
        display: 'flex', 
        justifyContent: 'space-between',
        fontSize: '14px',
        color: darkMode ? '#999' : '#666'
      }}>
        <div>Showing {sortedProcesses.length} of {processes.length} processes</div>
        <div>Click column headers to sort</div>
      </div>
    </div>
  );
}; 