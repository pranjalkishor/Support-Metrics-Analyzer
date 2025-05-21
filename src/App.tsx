import React, { useState, useEffect } from 'react';
import './App.css';
import { parseIostat } from "./parsers/iostat";
import { parseMpstat } from "./parsers/mpstat";
import { parseProxyHistograms } from "./parsers/proxyhistograms";
import { ParsedTimeSeries, ClusterData } from "./types";
import { parseTpstats } from "./parsers/tpstats";
import { FileUpload } from "./components/FileUpload";
import { ChartSelector } from "./components/ChartSelector";
import { TimeSeriesChart } from "./components/TimeSeriesChart";
import { ZoomableTimeSeriesCharts } from "./components/ZoomableTimeSeriesCharts";
import { Header } from "./components/Header";
import { parseTableHistograms } from "./parsers/tableHistograms";
import { TableHistogramSelector } from "./components/TableHistogramSelector";
import { TPStatsSelector } from "./components/TPStatsSelector";
import { MPStatSelector } from "./components/MPStatSelector";
import { IostatSelector } from "./components/IostatSelector";
import { OsTopCpuVisualizer } from "./components/OsTopCpuVisualizer";
import { SwissJavaKnifeVisualizer } from "./components/SwissJavaKnifeVisualizer";
import { SystemLogVisualizer } from "./components/SystemLogVisualizer";
import { MultiNodeSystemLogVisualizer } from "./components/MultiNodeSystemLogVisualizer";
import { parseSystemLog } from "./parsers/systemLog";

const DATASTAX_COLORS = {
  primary: '#3A36DB', // DataStax blue
  secondary: '#FF5C35', // DataStax orange
  background: '#f8f9fb',
  text: '#2E3A58',
  border: '#e0e6ed',
};

// Ensures parsed timestamps are in proper format for charts
function preprocessTimestamps(data: ParsedTimeSeries): ParsedTimeSeries {
  if (!data || !data.timestamps || !data.series) {
    console.warn("Invalid data structure received");
    return data;
  }

  // Log timestamp data for debugging
  console.log("Preprocessing timestamps:", {
    timestampCount: data.timestamps.length,
    firstTimestamp: data.timestamps[0],
    lastTimestamp: data.timestamps[data.timestamps.length - 1],
    isArray: Array.isArray(data.timestamps),
    seriesKeys: Object.keys(data.series).length
  });

  // Ensure timestamps are in ISO format or convert them
  const processedTimestamps = data.timestamps.map(timestamp => {
    // If already a valid date string, return it
    if (timestamp && typeof timestamp === 'string') {
      try {
        // Test if it's a valid date
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          return timestamp;
        }
      } catch (e) {
        // Not a valid date string, will process below
      }
    }

    // For invalid or non-ISO timestamps, try to convert
    try {
      // Handle numeric timestamps (milliseconds since epoch)
      if (typeof timestamp === 'number') {
        return new Date(timestamp).toISOString();
      }

      // Handle date objects
      if (timestamp && typeof timestamp === 'object' && Object.prototype.toString.call(timestamp) === '[object Date]') {
        return (timestamp as Date).toISOString();
      }

      // Handle string formats by parsing and converting to ISO
      if (typeof timestamp === 'string') {
        // Try to parse using Date constructor
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }

      // If all else fails, create a fallback timestamp
      return new Date().toISOString();
    } catch (e) {
      console.error("Error formatting timestamp:", e, timestamp);
      // Return a fallback valid date if parsing fails
      return new Date().toISOString();
    }
  });

  // Return a new object with processed timestamps
  return {
    ...data,
    timestamps: processedTimestamps
  };
}

function App() {
  const [parsed, setParsed] = useState<ParsedTimeSeries | null>(null);
  const [metrics, setMetrics] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [type, setType] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });
  const [fileContent, setFileContent] = useState<string>("");
  const [clusterData, setClusterData] = useState<ClusterData | null>(null);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  const handleFiles = async (files: FileList) => {
    // Reset states when a new file is uploaded
    setParsed(null);
    setMetrics([]);
    setSelected([]);
    setType(null);
    setClusterData(null);
    
    const file = files[0];
    const text = await file.text();
    
    // Add debug logging
    console.log("File name:", file.name);
    console.log("File size:", file.size);
    console.log("First 200 characters:", text.substring(0, 200));
    
    const type = detectFileType(file.name, text);
    console.log("Detected file type:", type);
    
    // Store file content for all file types, not just specialized ones
    setFileContent(text);
    
    let parsedData: ParsedTimeSeries | null = null;
    
    try {
      // Add this case for system.log files
      if (type === "systemlog") {
        // For systemlog files, we just need to set the type and file content
        // The SystemLogVisualizer component will handle the parsing
        setType(type);
        return; // Early return to avoid generic handling below
      }
      
      if (type === "tpstats") {
        parsedData = parseTpstats(text);
        if (parsedData) {
          console.log("TPSTATS PARSED DATA:");
          console.log("Timestamps:", parsedData.timestamps.length);
          console.log("Series keys:", Object.keys(parsedData.series));
          console.log("First 5 metrics:", Object.keys(parsedData.series).slice(0, 5));
          
          setParsed(parsedData);
          setMetrics(Object.keys(parsedData.series));
          setType(type);
        }
      }
      else if (type === "iostat") {
        parsedData = parseIostat(text);
        if (parsedData) {
          console.log("IOSTAT PARSED DATA:");
          console.log("Timestamps:", parsedData.timestamps.length);
          console.log("Series keys:", Object.keys(parsedData.series));
          console.log("First 5 metrics:", Object.keys(parsedData.series).slice(0, 5));
          
          setParsed(parsedData);
          setMetrics(Object.keys(parsedData.series));
          setType(type);
          
          // Set default metric for iostat (CPU %util or first available)
          if (Object.keys(parsedData.series).includes("%util")) {
            setSelected(["%util"]);
            return; // Skip the default setting below
          }
        }
      }
      else if (type === "mpstat") {
        parsedData = parseMpstat(text);
        if (parsedData) {
          console.log("MPSTAT PARSED DATA:");
          console.log("Timestamps:", parsedData.timestamps.length);
          console.log("Series keys:", Object.keys(parsedData.series));
          console.log("First 5 metrics:", Object.keys(parsedData.series).slice(0, 5));
          
          setParsed(parsedData);
          setMetrics(Object.keys(parsedData.series));
          setType(type);
          
          // For mpstat, select a reasonable default metric
          if (Object.keys(parsedData.series).includes("CPU all %usr")) {
            setSelected(["CPU all %usr"]);
            return; // Skip the default setting below
          }
        }
      }
      else if (type === "proxyhistograms") {
        parsedData = parseProxyHistograms(text);
        if (parsedData) {
          setParsed(parsedData);
          setMetrics(Object.keys(parsedData.series));
          
          // For proxyhistograms, select a useful default set of metrics
          const defaultMetrics = [
            // Read latencies at different percentiles
            "p50 Read Latency",
            "p75 Read Latency", 
            "p95 Read Latency",
            "p99 Read Latency",
            
            // Or uncomment these to compare different operations
            // "p95 Write Latency",
            // "p95 Range Latency",
          ];
          
          // Filter to only include metrics that actually exist in the data
          const availableDefaults = defaultMetrics.filter(m => 
            Object.keys(parsedData!.series).includes(m)
          );
          
          if (availableDefaults.length > 0) {
            setSelected(availableDefaults);
            return; // Skip the default setting below
          }
        }
      }
      else if (type === "tablehistograms") {
        const result = parseTableHistograms(text);
        if (result) {
          console.log("TABLE HISTOGRAMS PARSED DATA:", {
            timestamps: result.timestamps.length,
            seriesKeys: Object.keys(result.series).length,
            sampleTimestamp: result.timestamps[0],
            sampleMetrics: Object.keys(result.series).slice(0, 3),
            sampleValues: Object.keys(result.series).slice(0, 3).map(key => {
              return {
                key,
                values: result.series[key].slice(0, 5),
                valuesType: typeof result.series[key][0]
              }
            })
          });
          
          // Apply timestamp preprocessing to ensure valid format
          parsedData = preprocessTimestamps(result);
          
          // Create a new copy with converted numbers
          const processedData = {
            ...parsedData,
            series: { ...parsedData.series }
          };
          
          // Ensure tablehistograms data is properly converted to numbers
          Object.keys(processedData.series).forEach(metric => {
            // Replace invalid values with previous valid value instead of 0
            let lastValidValue = 1; // Start with a small positive value
            
            processedData.series[metric] = processedData.series[metric].map(value => {
              let numericValue: number;
              
              if (typeof value === 'string') {
                numericValue = parseFloat(value);
              } else if (typeof value === 'number') {
                numericValue = value;
              } else {
                numericValue = NaN;
              }
              
              if (isNaN(numericValue) || numericValue === 0) {
                // Use the last valid value instead of 0 or null
                return lastValidValue;
              } else {
                // Store this valid value for future gaps
                lastValidValue = numericValue;
                return numericValue;
              }
            });
            
            // Print some diagnostic info
            console.log(`Processed metric ${metric}:`, {
              originalCount: result.series[metric].length,
              processedCount: processedData.series[metric].length,
              sampleBefore: result.series[metric].slice(0, 5),
              sampleAfter: processedData.series[metric].slice(0, 5)
            });
          });
          
          setParsed(processedData);
          setMetrics(Object.keys(processedData.series));
          setType(type);
          
          // Select initial metrics (if available)
          const allMetrics = Object.keys(processedData.series);
          if (allMetrics.length > 0) {
            // Try to find a common table
            const tables = new Set<string>();
            allMetrics.forEach(metric => {
              const parts = metric.split(" | ");
              if (parts.length >= 1) {
                tables.add(parts[0]);
              }
            });
            
            if (tables.size > 0) {
              const firstTable = Array.from(tables)[0];
              
              // Find Read Latency metrics for 95% and 99% if available
              const defaultMetrics = allMetrics.filter(
                metric => metric.includes(firstTable) && 
                          metric.includes("Read Latency") && 
                          (metric.includes("95%") || metric.includes("99%"))
              );
              
              if (defaultMetrics.length > 0) {
                console.log("Setting default table histogram metrics:", defaultMetrics);
                setSelected(defaultMetrics);
                return;
              }
            }
            
            // Fallback: just select the first few metrics
            setSelected(allMetrics.slice(0, Math.min(5, allMetrics.length)));
          }
        }
      }
      else if (type === "os_top_cpu") {
        // For os_top_cpu, we'll handle it differently
        // Just set the type and let the specialized component handle it
        setType(type);
        setFileContent(text);
        return; // Early return to avoid generic handling below
      }
      else if (type === "swiss_java_knife") {
        // For Swiss Java Knife, just set the type and file content
        // and let the specialized component handle it
        setType(type);
        setFileContent(text);
        return; // Early return to avoid generic handling below
      }
      
      // Generic handling for any parsed data
      if (parsedData && Object.keys(parsedData.series).length > 0) {
        // Always preprocess timestamps to ensure valid format
        parsedData = preprocessTimestamps(parsedData);
        
        setParsed(parsedData);
        const newMetrics = Object.keys(parsedData.series);
        setMetrics(newMetrics);
        
        // Select first metric by default
        if (newMetrics.length > 0) {
          setSelected([newMetrics[0]]);
        }
      } else {
        console.error("No data parsed from file:", file.name);
        alert("Could not extract any data from the file. Please check the file format.");
      }
    } catch (error) {
      console.error("Error parsing file:", error);
      alert("Error parsing file. Please check the console for details.");
    }
  };

  const handleFolderUpload = async (files: File[]) => {
    // Reset states
    setParsed(null);
    setMetrics([]);
    setSelected([]);
    setType(null);
    setFileContent("");
    
    console.log("Processing folder upload with", files.length, "files");
    
    // Debug: Log all files to see what's actually uploaded
    console.log("All uploaded files:");
    files.forEach(file => {
      console.log(`- ${file.webkitRelativePath || file.name} (${file.size} bytes)`);
    });
    
    // Initialize cluster data structure
    const newClusterData: ClusterData = { 
      nodes: {}
    };
    
    // Group files by node based on path structure
    for (const file of files) {
      // Extract node info from path: nodes/IP_of_node/logs/system.log
      // Also support deeper nesting like: nodes/IP_of_node/logs/cassandra/system.log
      const pathParts = file.webkitRelativePath.split('/');
      
      // Log the path parts for debugging
      console.log(`File ${file.name} path parts:`, pathParts);
      
      // Skip files that don't match our expected path structure
      if (pathParts.length < 3) {
        console.log(`Skipping file with unexpected path structure: ${file.webkitRelativePath}`);
        continue;
      }
      
      // Extract node identifier (assumed to be the 2nd part of the path)
      const nodeId = pathParts[1];
      
      // Process system.log files
      if (file.name.toLowerCase() === 'system.log') {
        try {
          // Read file content
          const text = await file.text();
          console.log(`System.log for node ${nodeId} content length: ${text.length} bytes`);
          console.log(`First 200 chars: ${text.substring(0, 200)}`);
          
          // Parse the system log
          const parsedLog = parseSystemLog(text);
          
          // Log parsing results
          console.log(`Parsing results for node ${nodeId}:`, {
            gcEvents: parsedLog.gcEvents ? {
              timestamps: parsedLog.gcEvents.timestamps.length,
              metrics: Object.keys(parsedLog.gcEvents.series)
            } : null,
            threadPoolMetrics: parsedLog.threadPoolMetrics ? {
              timestamps: parsedLog.threadPoolMetrics.timestamps.length,
              metrics: Object.keys(parsedLog.threadPoolMetrics.series),
              threadPools: parsedLog.threadPoolMetrics.metadata?.threadPools?.length || 0,
              seriesSample: Object.keys(parsedLog.threadPoolMetrics.series).slice(0, 5),
              threadPoolNames: parsedLog.threadPoolMetrics.metadata?.threadPools || []
            } : null,
            tombstoneWarnings: parsedLog.tombstoneWarnings ? {
              timestamps: parsedLog.tombstoneWarnings.timestamps.length,
              metrics: Object.keys(parsedLog.tombstoneWarnings.series)
            } : null,
            slowReads: parsedLog.slowReads ? {
              timestamps: parsedLog.slowReads.timestamps.length,
              metrics: Object.keys(parsedLog.slowReads.series)
            } : null
          });
          
          // Add additional debug logging for thread pool metrics
          if (parsedLog.threadPoolMetrics) {
            console.log("Thread pool metrics found for node " + nodeId + ":", {
              pools: parsedLog.threadPoolMetrics.metadata?.threadPools,
              seriesKeys: Object.keys(parsedLog.threadPoolMetrics.series).slice(0, 10)
            });
            parsedLog.threadPoolMetrics = preprocessTimestamps(parsedLog.threadPoolMetrics);
            
            // Verify thread pool data after preprocessing
            console.log("Thread pool metrics after preprocessing:", {
              pools: parsedLog.threadPoolMetrics.metadata?.threadPools,
              seriesKeys: Object.keys(parsedLog.threadPoolMetrics.series).slice(0, 10)
            });
          }
        
          // Calculate a priority score based on available data
          // This will help us order nodes with more/better data first
          const gcCount = parsedLog.gcEvents?.timestamps?.length || 0;
          const threadPoolCount = parsedLog.threadPoolMetrics?.timestamps?.length || 0;
          const threadPoolMetricCount = parsedLog.threadPoolMetrics?.series ? Object.keys(parsedLog.threadPoolMetrics.series).length : 0;
          const tombstoneCount = parsedLog.tombstoneWarnings?.timestamps?.length || 0;
          const slowReadsCount = parsedLog.slowReads?.timestamps?.length || 0;
          
          // Score is weighted to prioritize nodes with thread pool and GC data
          const priorityScore = 
            gcCount * 2 + 
            threadPoolCount * 3 + 
            threadPoolMetricCount +
            tombstoneCount + 
            slowReadsCount;
          
          // Create a data quality indicator for this node
          const dataQuality = {
            hasGC: gcCount > 0,
            hasThreadPools: threadPoolCount > 0,
            hasTombstones: tombstoneCount > 0,
            hasSlowReads: slowReadsCount > 0,
            gcCount,
            threadPoolCount,
            threadPoolMetricCount,
            tombstoneCount,
            slowReadsCount,
            totalTimestamps: gcCount + threadPoolCount + tombstoneCount + slowReadsCount,
            score: priorityScore
          };
          
          console.log(`Data quality for node ${nodeId}:`, dataQuality);
          
          // Initialize node in cluster data if it doesn't exist
          if (!newClusterData.nodes[nodeId]) {
            newClusterData.nodes[nodeId] = {
              info: {
                id: nodeId,
                ip: nodeId,  // Use nodeId as IP if it looks like an IP address
                path: file.webkitRelativePath
              },
              systemLog: {}
            };
          }
          
          // Add the parsed log data to the node
          newClusterData.nodes[nodeId].systemLog = {
            gcEvents: parsedLog.gcEvents,
            threadPoolMetrics: parsedLog.threadPoolMetrics,
            tombstoneWarnings: parsedLog.tombstoneWarnings,
            slowReads: parsedLog.slowReads,
            priority: priorityScore,  // Store the priority score for sorting later
            dataQuality: dataQuality  // Store detailed data quality metrics
          };
          
          console.log(`Processed system.log for node ${nodeId} with priority score ${priorityScore}`);
        } catch (err) {
          console.error(`Error processing system.log for node ${nodeId}:`, err);
        }
      }
      
      // Additional file types could be processed here
    }
    
    // After processing all files, reorder nodes by priority score
    if (Object.keys(newClusterData.nodes).length > 0) {
      const nodeEntries = Object.entries(newClusterData.nodes);
      
      // Sort nodes by priority score (higher scores first)
      nodeEntries.sort((a, b) => {
        const scoreA = a[1].systemLog?.priority || 0;
        const scoreB = b[1].systemLog?.priority || 0;
        return scoreB - scoreA;
      });
      
      // Create a new ordered object
      const orderedNodes: {[nodeId: string]: any} = {};
      nodeEntries.forEach(([nodeId, nodeData]) => {
        // Create a copy of the node data without the priority score
        const nodeCopy = {...nodeData};
        if (nodeCopy.systemLog && 'priority' in nodeCopy.systemLog) {
          delete nodeCopy.systemLog.priority;
        }
        orderedNodes[nodeId] = nodeCopy;
      });
      
      // Replace the nodes object with our prioritized version
      newClusterData.nodes = orderedNodes;
    }
    
    // Check if we found any valid nodes
    const nodeCount = Object.keys(newClusterData.nodes).length;
    if (nodeCount > 0) {
      console.log(`Successfully processed ${nodeCount} nodes`);
      console.log("Final cluster data:", JSON.stringify(newClusterData, null, 2));
      setClusterData(newClusterData);
      setType("cluster");
      
      // Debug: For issue diagnosis
      // Find a node with the most thread pool data and log its details
      if (Object.keys(newClusterData.nodes).length > 0) {
        // Filter nodes that have thread pool metrics data
        const nodesWithThreadPoolMetrics = Object.values(newClusterData.nodes)
          .filter(node => {
            return !!(node.systemLog?.threadPoolMetrics?.timestamps?.length);
          });
        
        // Sort by timestamp count (descending)
        nodesWithThreadPoolMetrics.sort((a, b) => {
          const aCount = a.systemLog?.threadPoolMetrics?.timestamps?.length || 0;
          const bCount = b.systemLog?.threadPoolMetrics?.timestamps?.length || 0;
          return bCount - aCount;
        });
        
        if (nodesWithThreadPoolMetrics.length > 0) {
          const nodeWithMostData = nodesWithThreadPoolMetrics[0];
          const threadPoolMetrics = nodeWithMostData.systemLog?.threadPoolMetrics;
          
          if (threadPoolMetrics) {
            console.log("Debug - Thread Pool Metrics from node with most data:", {
              nodeId: nodeWithMostData.info.id,
              timestampCount: threadPoolMetrics.timestamps?.length || 0,
              threadPools: threadPoolMetrics.metadata?.threadPools?.length || 0,
              seriesEntries: Object.keys(threadPoolMetrics.series || {}).length,
              sampleKeys: Object.keys(threadPoolMetrics.series || {}).slice(0, 10),
              threadPoolList: threadPoolMetrics.metadata?.threadPools || [],
              seriesValues: Object.keys(threadPoolMetrics.series || {})
                .slice(0, 5)
                .map(key => ({ 
                  key, 
                  values: threadPoolMetrics.series?.[key]?.slice(0, 5) || []
                }))
            });
          }
        }
      }
    } else {
      console.error("No valid node data found in uploaded folder");
      alert("No valid node data found in the uploaded folder. Please ensure it follows the structure: nodes/IP_of_node/logs/system.log");
    }
  };

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('darkMode', String(newDarkMode));
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      backgroundColor: darkMode ? "#121212" : DATASTAX_COLORS.background,
      color: darkMode ? "#E5E5E5" : DATASTAX_COLORS.text
    }}>
      <Header darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
      <div style={{ 
        padding: 24,
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        <div style={{
          background: darkMode ? "#232333" : "white",
          borderRadius: '8px',
          boxShadow: darkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.05)',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <h2 style={{ 
            margin: '0 0 16px 0', 
            fontSize: '18px',
            color: darkMode ? "#e1e1e1" : "inherit" 
          }}>
            Upload Metrics
          </h2>
          <FileUpload onFiles={handleFiles} onFolderUpload={handleFolderUpload} />
        </div>
        
        {type === "cluster" && clusterData ? (
          // Multi-node system log visualization
          <div style={{
            background: darkMode ? "#232333" : "white",
            borderRadius: '8px',
            boxShadow: darkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.05)',
            padding: '24px',
            marginTop: '24px'
          }}>
            <MultiNodeSystemLogVisualizer 
              clusterData={clusterData} 
              darkMode={darkMode}
            />
          </div>
        ) : type === "os_top_cpu" ? (
          // Special handling for os_top_cpu files
          <OsTopCpuVisualizer 
            fileContent={fileContent} 
            darkMode={darkMode} 
          />
        ) : type === "swiss_java_knife" ? (
          // Special handling for Swiss Java Knife files
          <SwissJavaKnifeVisualizer
            fileContent={fileContent}
            darkMode={darkMode}
          />
        ) : type === "systemlog" ? (
          // Special handling for system.log files
          <div style={{
            background: darkMode ? "#232333" : "white",
            borderRadius: '8px',
            boxShadow: darkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.05)',
            padding: '24px',
            marginTop: '24px'
          }}>
            <SystemLogVisualizer logContent={fileContent} />
          </div>
        ) : parsed && (
          <>
            {type === "tablehistograms" ? (
              <TableHistogramSelector
                availableMetrics={metrics}
                selectedMetrics={selected}
                onChange={setSelected}
                darkMode={darkMode}
              />
            ) : type === "tpstats" ? (
              <TPStatsSelector 
                availableMetrics={metrics}
                selectedMetrics={selected}
                onChange={setSelected}
                darkMode={darkMode}
              />
            ) : type === "mpstat" ? (
              <MPStatSelector
                availableMetrics={metrics}
                selectedMetrics={selected}
                onChange={setSelected}
                darkMode={darkMode}
              />
            ) : type === "iostat" ? (
              <IostatSelector
                availableMetrics={metrics}
                selectedMetrics={selected}
                onChange={setSelected}
                darkMode={darkMode}
              />
            ) : (
              <ChartSelector
                availableMetrics={metrics}
                selectedMetrics={selected}
                onChange={setSelected}
                darkMode={darkMode}
              />
            )}
            <div style={{
              background: darkMode ? "#232333" : "white",
              borderRadius: '8px',
              boxShadow: darkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.05)',
              padding: '24px',
              marginTop: '24px'
            }}>
              <ZoomableTimeSeriesCharts 
                data={parsed} 
                selectedMetrics={selected}
                darkMode={darkMode}
                isLogarithmic={type === "proxyhistograms" || 
                              (type === "tablehistograms" && 
                               selected.some(m => m.includes("Latency")))}
              />
            </div>
          </>
        )}
      </div>
      <footer style={{
        textAlign: 'center',
        padding: '20px',
        borderTop: '1px solid #e0e6ed',
        fontSize: '14px',
        color: '#666',
        marginTop: '40px'
      }}>
        &copy; {new Date().getFullYear()} DataStax - Cassandra Metrics Visualizer
      </footer>
    </div>
  );
}

function detectFileType(filename: string, content: string) {
  console.log("Detecting file type for:", filename);
  
  // Move system.log detection to the top for priority
  if (filename.toLowerCase().includes("system") || 
      (content.includes("GCInspector") || content.includes("StatusLogger"))) {
    console.log("Detected as system.log");
    return "systemlog";
  }
  
  if (filename.includes("tpstats")) {
    console.log("Detected as tpstats");
    return "tpstats";
  }
  if (filename.includes("iostat") || 
      (filename.endsWith(".output") && content.includes("avg-cpu:"))) {
    console.log("Detected as iostat");
    return "iostat";
  }
  if (filename.includes("mpstat")) {
    return "mpstat" as any; // Force type to avoid linter error
  }
  if (filename.includes("proxyhistograms")) return "proxyhistograms";
  if (filename.includes("tablehistograms")) {
    console.log("Detected as tablehistograms");
    return "tablehistograms";
  }
  if (filename.includes("os_top_cpu") || 
      content.includes("top - ") && content.includes("PID USER") && 
      content.includes("%CPU %MEM")) {
    console.log("Detected as os_top_cpu");
    return "os_top_cpu";
  }
  
  // Detect Swiss Java Knife output
  if (filename.includes("sjk") || 
      (content.includes("process cpu=") && 
       content.includes("heap allocation rate") && 
       content.includes("[") && content.includes("user=") && 
       content.includes("sys=") && content.includes("alloc="))) {
    console.log("Detected as swiss_java_knife");
    return "swiss_java_knife";
  }
  
  console.warn("Could not detect file type");
  return null;
}

export default App;
