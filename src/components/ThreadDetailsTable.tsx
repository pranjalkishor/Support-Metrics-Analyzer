import React, { useState, useEffect, useMemo } from "react";
import { ThreadStats, ProcessSummary } from "../parsers/swissJavaKnife";

interface ThreadDetailsTableProps {
  data: ProcessSummary[];
  darkMode: boolean;
  // Optional selected timerange for filtering data
  timeRange?: [Date, Date];
}

export const ThreadDetailsTable: React.FC<ThreadDetailsTableProps> = ({
  data,
  darkMode,
  timeRange
}) => {
  const [sortField, setSortField] = useState<'cpuUsage' | 'allocRate'>('cpuUsage');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 15;

  // Filter data by time range if provided
  const filteredData = useMemo(() => {
    if (!timeRange) return data;
    
    return data.filter(sample => {
      const sampleTime = new Date(sample.timestamp);
      return sampleTime >= timeRange[0] && sampleTime <= timeRange[1];
    });
  }, [data, timeRange]);

  // Compute aggregated thread stats from filtered data
  const aggregatedThreads = useMemo(() => {
    if (!filteredData.length) return [];

    // Map to collect thread data by ID
    const threadMap = new Map<string, {
      id: string;
      name: string;
      samples: number;
      cpuUsageTotal: number;
      allocRateTotal: number;
      maxCpuUsage: number;
      maxAllocRate: number;
    }>();

    // Process all samples
    filteredData.forEach(sample => {
      sample.threads.forEach(thread => {
        const existing = threadMap.get(thread.id);
        
        if (existing) {
          existing.samples++;
          existing.cpuUsageTotal += thread.cpuUsage;
          existing.allocRateTotal += thread.allocRate;
          existing.maxCpuUsage = Math.max(existing.maxCpuUsage, thread.cpuUsage);
          existing.maxAllocRate = Math.max(existing.maxAllocRate, thread.allocRate);
        } else {
          threadMap.set(thread.id, {
            id: thread.id,
            name: thread.name,
            samples: 1,
            cpuUsageTotal: thread.cpuUsage,
            allocRateTotal: thread.allocRate,
            maxCpuUsage: thread.cpuUsage,
            maxAllocRate: thread.allocRate
          });
        }
      });
    });

    // Convert map to array and calculate averages
    return Array.from(threadMap.values()).map(thread => ({
      id: thread.id,
      name: thread.name,
      avgCpuUsage: thread.cpuUsageTotal / thread.samples,
      avgAllocRate: thread.allocRateTotal / thread.samples,
      maxCpuUsage: thread.maxCpuUsage,
      maxAllocRate: thread.maxAllocRate
    }));
  }, [filteredData]);

  // Apply search filter and sorting
  const displayThreads = useMemo(() => {
    // Apply search filtering
    let threads = [...aggregatedThreads];
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      threads = threads.filter(thread => 
        thread.name.toLowerCase().includes(query) || 
        thread.id.includes(query)
      );
    }
    
    // Apply sorting
    threads.sort((a, b) => {
      let comparison = 0;
      
      if (sortField === 'cpuUsage') {
        comparison = a.avgCpuUsage - b.avgCpuUsage;
      } else {
        comparison = a.avgAllocRate - b.avgAllocRate;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return threads;
  }, [aggregatedThreads, searchQuery, sortField, sortDirection]);

  // Calculate pagination
  const totalPages = Math.ceil(displayThreads.length / rowsPerPage);
  const paginatedThreads = displayThreads.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  // Format bytes to human-readable format
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B/s';
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Helper for column header click (sorting)
  const handleSortClick = (field: 'cpuUsage' | 'allocRate') => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set field and default to descending
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, timeRange]);

  // Background color based on CPU/memory usage
  const getCellBackground = (value: number, isMemory = false): string => {
    // Different thresholds for CPU and memory
    const thresholds = isMemory 
      ? [100_000, 1_000_000, 10_000_000, 50_000_000] // memory in bytes/s
      : [1, 5, 20, 50]; // CPU in percentage
    
    const colors = darkMode 
      ? ['#2d3436', '#636e72', '#e17055', '#d63031'] 
      : ['#dfe6e9', '#b2bec3', '#fdcb6e', '#e17055'];
    
    let colorIndex = 0;
    for (let i = 0; i < thresholds.length; i++) {
      if (value >= thresholds[i]) {
        colorIndex = i;
      }
    }
    
    return colors[colorIndex];
  };

  return (
    <div
      style={{
        background: darkMode ? "#232333" : "white",
        borderRadius: "8px",
        boxShadow: darkMode ? "0 2px 8px rgba(0,0,0,0.3)" : "0 2px 8px rgba(0,0,0,0.05)",
        padding: "24px",
        marginBottom: "24px",
      }}
    >
      <h2
        style={{
          margin: "0 0 16px 0",
          fontSize: "18px",
          color: darkMode ? "#e1e1e1" : "inherit",
        }}
      >
        Thread Details
        {timeRange && (
          <span style={{ fontWeight: 'normal', marginLeft: '8px', fontSize: '14px' }}>
            {new Date(timeRange[0]).toLocaleTimeString()} - {new Date(timeRange[1]).toLocaleTimeString()}
          </span>
        )}
      </h2>

      <div style={{ marginBottom: "16px" }}>
        <input
          type="text"
          placeholder="Search threads by name or ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            border: darkMode ? "1px solid #444" : "1px solid #ddd",
            borderRadius: "4px",
            background: darkMode ? "#333" : "white",
            color: darkMode ? "#e1e1e1" : "inherit",
          }}
        />
      </div>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            color: darkMode ? "#e1e1e1" : "inherit",
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: darkMode ? "1px solid #444" : "1px solid #ddd",
              }}
            >
              <th style={{ padding: "12px 8px", textAlign: "left" }}>Thread ID</th>
              <th style={{ padding: "12px 8px", textAlign: "left" }}>Thread Name</th>
              <th 
                style={{ 
                  padding: "12px 8px", 
                  textAlign: "right",
                  cursor: "pointer" 
                }}
                onClick={() => handleSortClick('cpuUsage')}
              >
                Avg CPU Usage {sortField === 'cpuUsage' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: "12px 8px", textAlign: "right" }}>Max CPU Usage</th>
              <th 
                style={{ 
                  padding: "12px 8px", 
                  textAlign: "right",
                  cursor: "pointer" 
                }}
                onClick={() => handleSortClick('allocRate')}
              >
                Avg Alloc Rate {sortField === 'allocRate' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: "12px 8px", textAlign: "right" }}>Max Alloc Rate</th>
            </tr>
          </thead>
          <tbody>
            {paginatedThreads.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "16px 8px", textAlign: "center" }}>
                  No threads found matching your criteria
                </td>
              </tr>
            ) : (
              paginatedThreads.map((thread) => (
                <tr
                  key={thread.id}
                  style={{
                    borderBottom: darkMode ? "1px solid #444" : "1px solid #ddd",
                  }}
                >
                  <td style={{ padding: "12px 8px" }}>{thread.id}</td>
                  <td style={{ padding: "12px 8px" }}>{thread.name}</td>
                  <td 
                    style={{ 
                      padding: "12px 8px", 
                      textAlign: "right",
                      background: getCellBackground(thread.avgCpuUsage)
                    }}
                  >
                    {thread.avgCpuUsage.toFixed(2)}%
                  </td>
                  <td 
                    style={{ 
                      padding: "12px 8px", 
                      textAlign: "right",
                      background: getCellBackground(thread.maxCpuUsage)
                    }}
                  >
                    {thread.maxCpuUsage.toFixed(2)}%
                  </td>
                  <td 
                    style={{ 
                      padding: "12px 8px", 
                      textAlign: "right",
                      background: getCellBackground(thread.avgAllocRate, true)
                    }}
                  >
                    {formatBytes(thread.avgAllocRate)}
                  </td>
                  <td 
                    style={{ 
                      padding: "12px 8px", 
                      textAlign: "right",
                      background: getCellBackground(thread.maxAllocRate, true)
                    }}
                  >
                    {formatBytes(thread.maxAllocRate)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            marginTop: "16px",
            gap: "8px",
          }}
        >
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            style={{
              padding: "6px 12px",
              background: darkMode ? "#333" : "#f5f5f5",
              border: darkMode ? "1px solid #444" : "1px solid #ddd",
              borderRadius: "4px",
              cursor: currentPage === 1 ? "not-allowed" : "pointer",
              color: darkMode ? "#e1e1e1" : "inherit",
              opacity: currentPage === 1 ? 0.5 : 1,
            }}
          >
            Previous
          </button>
          <span style={{ color: darkMode ? "#e1e1e1" : "inherit" }}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: "6px 12px",
              background: darkMode ? "#333" : "#f5f5f5",
              border: darkMode ? "1px solid #444" : "1px solid #ddd",
              borderRadius: "4px",
              cursor: currentPage === totalPages ? "not-allowed" : "pointer",
              color: darkMode ? "#e1e1e1" : "inherit",
              opacity: currentPage === totalPages ? 0.5 : 1,
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default ThreadDetailsTable; 