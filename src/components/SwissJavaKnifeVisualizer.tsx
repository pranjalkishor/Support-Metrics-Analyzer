import React, { useState, useEffect } from "react";
import { ZoomableTimeSeriesCharts } from "./ZoomableTimeSeriesCharts";
import { SwissJavaKnifeSelector } from "./SwissJavaKnifeSelector";
import { ThreadDetailsTable } from "./ThreadDetailsTable";
import { parseSwissJavaKnife, ProcessSummary } from "../parsers/swissJavaKnife";
import { ParsedTimeSeries } from "../types";

interface SwissJavaKnifeVisualizerProps {
  fileContent: string;
  darkMode: boolean;
}

export const SwissJavaKnifeVisualizer: React.FC<SwissJavaKnifeVisualizerProps> = ({
  fileContent,
  darkMode
}) => {
  const [parsedTimeSeriesData, setParsedTimeSeriesData] = useState<ParsedTimeSeries | null>(null);
  const [processData, setProcessData] = useState<ProcessSummary[]>([]);
  const [metrics, setMetrics] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState<[Date, Date] | undefined>();

  // Parse the file content on component mount or when content changes
  useEffect(() => {
    if (!fileContent) return;

    try {
      // Parse the data for time series charts
      const timeSeriesData = parseSwissJavaKnife(fileContent);
      setParsedTimeSeriesData(timeSeriesData);
      
      // Get all available metrics
      const availableMetrics = Object.keys(timeSeriesData.series);
      setMetrics(availableMetrics);
      
      // Select default metrics - process level metrics
      const defaultMetrics = availableMetrics.filter(metric => 
        metric.includes("Process")
      );
      
      if (defaultMetrics.length > 0) {
        setSelected(defaultMetrics);
      } else if (availableMetrics.length > 0) {
        // Fallback to first few metrics
        setSelected(availableMetrics.slice(0, 2));
      }

      // Parse raw thread data for the table
      const processDataForTable = parseJvmThreadDump(fileContent);
      setProcessData(processDataForTable);
    } catch (error) {
      console.error("Error parsing Swiss Java Knife data:", error);
    }
  }, [fileContent]);

  // Handle time range changes from chart zooming/brushing
  const handleTimeRangeChange = (startIndex: number, endIndex: number) => {
    if (!parsedTimeSeriesData || !parsedTimeSeriesData.timestamps.length) return;
    
    // Get start and end dates
    const start = new Date(parsedTimeSeriesData.timestamps[startIndex]);
    const end = new Date(parsedTimeSeriesData.timestamps[endIndex]);
    
    setSelectedTimeRange([start, end]);
  };

  // Helper function to parse JVM thread dump (from parser.ts)
  function parseJvmThreadDump(content: string): ProcessSummary[] {
    const blocks = content.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
    const results: ProcessSummary[] = [];
  
    for (const block of blocks) {
      const lines = block.split(/\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length < 6) continue;
  
      // Parse header
      const timestampMatch = lines[0].match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+\d{4})/);
      const cpuMatch = lines[1].match(/process cpu=([\d.]+)%/);
      const heapAllocMatch = lines[5].match(/heap allocation rate ([^\s]+)/i);
      if (!timestampMatch || !cpuMatch || !heapAllocMatch) continue;
  
      const timestamp = Date.parse(timestampMatch[1]);
      const cpuUsage = parseFloat(cpuMatch[1]);
      
      // Parse allocation rate
      const allocStr = heapAllocMatch[1];
      const allocMatch = allocStr.trim().match(/([\d.]+)\s*(mb|kb|b)\/s/i);
      let heapAllocRate = 0;
      
      if (allocMatch) {
        const value = parseFloat(allocMatch[1]);
        const unit = allocMatch[2].toLowerCase();
        
        if (unit === 'mb') heapAllocRate = value * 1024 * 1024;
        else if (unit === 'kb') heapAllocRate = value * 1024;
        else if (unit === 'b') heapAllocRate = value;
      }
  
      // Parse threads
      const threads = [];
      for (let i = 6; i < lines.length; i++) {
        const threadLine = lines[i];
        const threadMatch = threadLine.match(/^\[(\d+)\] user=\s*([\-\d.]+)% sys=\s*([\-\d.]+)% alloc=\s*([^\s]+) - (.+)$/);
        if (threadMatch) {
          const id = threadMatch[1];
          const userCpu = parseFloat(threadMatch[2]);
          const sysCpu = parseFloat(threadMatch[3]);
          
          // Parse thread allocation rate
          const threadAllocStr = threadMatch[4];
          const threadAllocMatch = threadAllocStr.trim().match(/([\d.]+)\s*(mb|kb|b)\/s/i);
          let allocRate = 0;
          
          if (threadAllocMatch) {
            const value = parseFloat(threadAllocMatch[1]);
            const unit = threadAllocMatch[2].toLowerCase();
            
            if (unit === 'mb') allocRate = value * 1024 * 1024;
            else if (unit === 'kb') allocRate = value * 1024;
            else if (unit === 'b') allocRate = value;
          }
          
          const name = threadMatch[5].trim();
          
          threads.push({
            id,
            name,
            state: 'UNKNOWN',
            cpuUsage: userCpu + sysCpu,
            allocRate,
          });
        }
      }
  
      results.push({
        timestamp,
        cpuUsage,
        heapAllocRate,
        threads,
      });
    }
  
    return results;
  }

  // If there's no parsed data, show a loading indicator
  if (!parsedTimeSeriesData || !parsedTimeSeriesData.timestamps.length) {
    return (
      <div style={{ 
        textAlign: "center", 
        padding: "24px",
        color: darkMode ? "#e1e1e1" : "inherit"
      }}>
        Loading or parsing Swiss Java Knife data...
      </div>
    );
  }

  return (
    <>
      <SwissJavaKnifeSelector
        availableMetrics={metrics}
        selectedMetrics={selected}
        onChange={setSelected}
        darkMode={darkMode}
      />
      
      <div style={{
        background: darkMode ? "#232333" : "white",
        borderRadius: "8px",
        boxShadow: darkMode ? "0 2px 8px rgba(0,0,0,0.3)" : "0 2px 8px rgba(0,0,0,0.05)",
        padding: "24px",
        marginBottom: "24px"
      }}>
        <ZoomableTimeSeriesCharts 
          data={parsedTimeSeriesData} 
          selectedMetrics={selected}
          darkMode={darkMode}
          isLogarithmic={false}
          onTimeRangeChange={handleTimeRangeChange}
        />
      </div>
      
      {processData.length > 0 && (
        <ThreadDetailsTable 
          data={processData} 
          darkMode={darkMode} 
          timeRange={selectedTimeRange}
        />
      )}
    </>
  );
};

export default SwissJavaKnifeVisualizer; 