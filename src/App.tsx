import React, { useState, useEffect } from 'react';
import './App.css';
import { parseIostat } from "./parsers/iostat";
import { parseMpstat } from "./parsers/mpstat";
import { parseProxyHistograms } from "./parsers/proxyhistograms";
import { ParsedTimeSeries } from "./types";
import { parseTpstats } from "./parsers/tpstats";
import { FileUpload } from "./components/FileUpload";
import { ChartSelector } from "./components/ChartSelector";
import { TimeSeriesChart } from "./components/TimeSeriesChart";
import { Header } from "./components/Header";
import { parseTableHistograms } from "./parsers/tableHistograms";
import { TableHistogramSelector } from "./components/TableHistogramSelector";
import { TPStatsSelector } from "./components/TPStatsSelector";
import { MPStatSelector } from "./components/MPStatSelector";
import { IostatSelector } from "./components/IostatSelector";

const DATASTAX_COLORS = {
  primary: '#3A36DB', // DataStax blue
  secondary: '#FF5C35', // DataStax orange
  background: '#f8f9fb',
  text: '#2E3A58',
  border: '#e0e6ed',
};

function App() {
  const [parsed, setParsed] = useState<ParsedTimeSeries | null>(null);
  const [metrics, setMetrics] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [type, setType] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });

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
    
    const file = files[0];
    const text = await file.text();
    const type = detectFileType(file.name, text);
    
    let parsedData: ParsedTimeSeries | null = null;
    
    try {
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
        parsedData = parseTableHistograms(text);
        if (parsedData) {
          console.log("TABLE HISTOGRAMS PARSED DATA:");
          console.log("Timestamps:", parsedData.timestamps.length);
          console.log("Series keys:", Object.keys(parsedData.series).length);
          
          setParsed(parsedData);
          setMetrics(Object.keys(parsedData.series));
          setType(type);
          
          // Select initial metrics (if available)
          const allMetrics = Object.keys(parsedData.series);
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
      
      // Generic handling for any parsed data
      if (parsedData && Object.keys(parsedData.series).length > 0) {
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
            Upload Metric File
          </h2>
          <FileUpload onFiles={handleFiles} />
        </div>
        
        {parsed && (
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
              <TimeSeriesChart 
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
  
  if (filename.includes("tpstats")) {
    console.log("Detected as tpstats");
    return "tpstats";
  }
  if (filename.includes("iostat")) return "iostat";
  if (filename.includes("mpstat")) {
    return "mpstat" as any; // Force type to avoid linter error
  }
  if (filename.includes("proxyhistograms")) return "proxyhistograms";
  if (filename.includes("tablehistograms")) {
    console.log("Detected as tablehistograms");
    return "tablehistograms";
  }
  
  console.warn("Could not detect file type");
  return null;
}

export default App;
