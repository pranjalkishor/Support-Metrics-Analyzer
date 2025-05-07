import React, { useState, useEffect } from "react";

type Props = {
  availableMetrics: string[];
  selectedMetrics: string[];
  onChange: (metrics: string[]) => void;
  darkMode: boolean;
};

export const MPStatSelector: React.FC<Props> = ({
  availableMetrics,
  selectedMetrics,
  onChange,
  darkMode
}) => {
  // Current selections
  const [selectedCPU, setSelectedCPU] = useState<string>("");
  const [selectedMetric, setSelectedMetric] = useState<string>("");
  
  // Available options
  const [availableCPUs, setAvailableCPUs] = useState<string[]>([]);
  const [availableMetricTypes, setAvailableMetricTypes] = useState<string[]>([]);
  
  // Extract CPUs and metric types from available metrics
  useEffect(() => {
    console.log("MPStat available metrics:", availableMetrics);
    
    const cpus = new Set<string>();
    const metricTypes = new Set<string>();
    
    availableMetrics.forEach(metric => {
      // Expected format: "CPU all %usr" or "CPU 0 %usr"
      const parts = metric.split(" ");
      if (parts.length >= 3 && parts[0] === "CPU") {
        cpus.add(parts[1]); // "all", "0", "1", etc.
        metricTypes.add(parts[2]); // "%usr", "%sys", etc.
      }
    });
    
    const cpuList = Array.from(cpus).sort((a, b) => {
      // Put "all" first, then sort numerically
      if (a === "all") return -1;
      if (b === "all") return 1;
      return parseInt(a) - parseInt(b);
    });
    
    const metricList = Array.from(metricTypes).sort();
    
    console.log("Available CPUs:", cpuList);
    console.log("Available metric types:", metricList);
    
    setAvailableCPUs(cpuList);
    setAvailableMetricTypes(metricList);
    
    // Set default selections if available
    if (cpuList.length > 0) {
      setSelectedCPU(cpuList[0]);
    }
    
    if (metricList.length > 0) {
      setSelectedMetric(metricList[0]);
    }
    
    // Apply default selections
    if (cpuList.length > 0 && metricList.length > 0) {
      updateSelectedMetric(cpuList[0], metricList[0]);
    }
  }, [availableMetrics]);
  
  // Update selected metric based on CPU and metric type
  const updateSelectedMetric = (cpu: string, metricType: string) => {
    if (!cpu || !metricType) {
      onChange([]);
      return;
    }
    
    const metricName = `CPU ${cpu} ${metricType}`;
    console.log("Selecting metric:", metricName);
    
    if (availableMetrics.includes(metricName)) {
      onChange([metricName]);
    } else {
      console.warn(`Metric "${metricName}" not found in available metrics`);
      onChange([]);
    }
  };
  
  // Handle CPU selection
  const handleCPUChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const cpu = event.target.value;
    setSelectedCPU(cpu);
    
    if (cpu && selectedMetric) {
      updateSelectedMetric(cpu, selectedMetric);
    }
  };
  
  // Handle metric type selection
  const handleMetricChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const metric = event.target.value;
    setSelectedMetric(metric);
    
    if (selectedCPU && metric) {
      updateSelectedMetric(selectedCPU, metric);
    }
  };
  
  return (
    <div style={{
      backgroundColor: darkMode ? "#232333" : "#f5f5f5",
      borderRadius: "8px",
      padding: "20px",
      marginBottom: "20px"
    }}>
      <h3 style={{
        margin: "0 0 15px 0",
        color: darkMode ? "#e1e1e1" : "#333"
      }}>
        CPU Performance Metrics
      </h3>
      
      <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
        <div style={{ flex: 1 }}>
          <label 
            htmlFor="cpu-dropdown" 
            style={{ 
              display: "block", 
              marginBottom: "8px",
              color: darkMode ? "#e1e1e1" : "#333"
            }}
          >
            CPU
          </label>
          <select
            id="cpu-dropdown"
            value={selectedCPU}
            onChange={handleCPUChange}
            style={{
              width: "100%",
              padding: "8px",
              backgroundColor: darkMode ? "#1e1e30" : "#fff",
              color: darkMode ? "#e1e1e1" : "#333",
              border: `1px solid ${darkMode ? "#444" : "#ddd"}`,
              borderRadius: "4px",
              height: "40px"
            }}
          >
            <option value="">Select CPU</option>
            {availableCPUs.map(cpu => (
              <option key={cpu} value={cpu}>
                {cpu === "all" ? "All CPUs" : `CPU ${cpu}`}
              </option>
            ))}
          </select>
          {availableCPUs.length === 0 && (
            <div style={{ marginTop: "8px", color: darkMode ? "#ff9999" : "#d32f2f" }}>
              No CPU data found
            </div>
          )}
        </div>
        
        <div style={{ flex: 1 }}>
          <label 
            htmlFor="metric-dropdown" 
            style={{ 
              display: "block", 
              marginBottom: "8px",
              color: darkMode ? "#e1e1e1" : "#333"
            }}
          >
            Metric
          </label>
          <select
            id="metric-dropdown"
            value={selectedMetric}
            onChange={handleMetricChange}
            style={{
              width: "100%",
              padding: "8px",
              backgroundColor: darkMode ? "#1e1e30" : "#fff",
              color: darkMode ? "#e1e1e1" : "#333",
              border: `1px solid ${darkMode ? "#444" : "#ddd"}`,
              borderRadius: "4px",
              height: "40px"
            }}
            disabled={!selectedCPU}
          >
            <option value="">Select Metric</option>
            {availableMetricTypes.map(metric => (
              <option key={metric} value={metric}>
                {metric}
              </option>
            ))}
          </select>
          {selectedCPU && availableMetricTypes.length === 0 && (
            <div style={{ marginTop: "8px", color: darkMode ? "#ff9999" : "#d32f2f" }}>
              No metrics found for selected CPU
            </div>
          )}
        </div>
      </div>
      
      {selectedMetrics.length > 0 && (
        <div style={{
          marginTop: "20px",
          padding: "15px",
          backgroundColor: darkMode ? "#1e1e30" : "#f0f0f0",
          borderRadius: "4px",
          color: darkMode ? "#e1e1e1" : "#333"
        }}>
          <p style={{ margin: "0 0 10px 0", fontWeight: "bold" }}>Selected Metric:</p>
          <div style={{ 
            display: "flex", 
            flexWrap: "wrap", 
            gap: "8px"
          }}>
            {selectedMetrics.map(metric => (
              <div key={metric} style={{
                padding: "4px 8px",
                backgroundColor: darkMode ? "#3A36DB" : "#e1f5fe",
                color: darkMode ? "#fff" : "#0277bd",
                borderRadius: "4px",
                fontSize: "14px"
              }}>
                {metric}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}; 