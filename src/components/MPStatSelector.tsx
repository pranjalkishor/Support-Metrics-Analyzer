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
  const [selectedCPUs, setSelectedCPUs] = useState<string[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<string>("");
  const [availableCPUs, setAvailableCPUs] = useState<string[]>([]);
  const [availableMetricTypes, setAvailableMetricTypes] = useState<string[]>([]);

  useEffect(() => {
    const cpus = new Set<string>();
    const metricTypes = new Set<string>();
    availableMetrics.forEach(metric => {
      const parts = metric.split(" ");
      if (parts.length >= 3 && parts[0] === "CPU") {
        cpus.add(parts[1]);
        metricTypes.add(parts[2]);
      }
    });

    const cpuList = Array.from(cpus).sort((a, b) => {
      if (a === "all") return -1;
      if (b === "all") return 1;
      return parseInt(a) - parseInt(b);
    });
    const metricList = Array.from(metricTypes).sort();

    setAvailableCPUs(cpuList);
    setAvailableMetricTypes(metricList);

    // Set default selections if available
    if (cpuList.length > 0 && selectedCPUs.length === 0) {
      // setSelectedCPUs([cpuList[0]]); // No default CPU selection
    }
    
    if (metricList.length > 0 && !selectedMetric) {
      // setSelectedMetric(metricList[0]); // No default metric selection
    }
  }, [availableMetrics]);

  useEffect(() => {
    updateSelectedMetrics(selectedCPUs, selectedMetric);
  }, [selectedCPUs, selectedMetric]);

  const updateSelectedMetrics = (cpus: string[], metricType: string) => {
    if (!cpus || cpus.length === 0 || !metricType) {
      onChange([]);
      return;
    }
    const metricNames = cpus.map(cpu => `CPU ${cpu} ${metricType}`).filter(name => availableMetrics.includes(name));
    onChange(metricNames);
  };

  const handleCPUChange = (cpu: string) => {
    const newSelectedCPUs = selectedCPUs.includes(cpu)
      ? selectedCPUs.filter(c => c !== cpu)
      : [...selectedCPUs, cpu];
    setSelectedCPUs(newSelectedCPUs);
  };
  
  const handleMetricChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const metric = event.target.value;
    setSelectedMetric(metric);
  };

  return (
    <div style={{
      backgroundColor: darkMode ? "#232333" : "#f5f5f5",
      borderRadius: "8px",
      padding: "20px",
      marginBottom: "20px"
    }}>
      <h3 style={{ margin: "0 0 15px 0", color: darkMode ? "#e1e1e1" : "#333" }}>
        CPU Performance Metrics
      </h3>
      
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "20px" }}>
        <div>
          <label style={{ display: "block", marginBottom: "8px", color: darkMode ? "#e1e1e1" : "#333" }}>
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
          >
            <option value="">Select Metric</option>
            {availableMetricTypes.map(metric => (
              <option key={metric} value={metric}>{metric}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "8px", color: darkMode ? "#e1e1e1" : "#333" }}>
            CPUs
          </label>
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            padding: "10px",
            borderRadius: "4px",
            border: `1px solid ${darkMode ? "#444" : "#ddd"}`,
            maxHeight: "120px",
            overflowY: "auto"
          }}>
            {availableCPUs.map(cpu => (
              <div key={cpu} style={{ display: "flex", alignItems: "center" }}>
                <input
                  type="checkbox"
                  id={`cpu-${cpu}`}
                  value={cpu}
                  checked={selectedCPUs.includes(cpu)}
                  onChange={() => handleCPUChange(cpu)}
                />
                <label htmlFor={`cpu-${cpu}`} style={{ marginLeft: "5px", color: darkMode ? "#e1e1e1" : "#333" }}>
                  {cpu === "all" ? "All CPUs (average)" : `CPU ${cpu}`}
                </label>
              </div>
            ))}
          </div>
          {availableCPUs.length === 0 && (
            <div style={{ marginTop: "8px", color: darkMode ? "#ff9999" : "#d32f2f" }}>
              No CPU data found
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