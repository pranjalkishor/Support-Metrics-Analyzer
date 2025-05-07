import React, { useState, useEffect } from "react";

type Props = {
  availableMetrics: string[];
  selectedMetrics: string[];
  onChange: (metrics: string[]) => void;
  darkMode: boolean;
};

export const IostatSelector: React.FC<Props> = ({
  availableMetrics,
  selectedMetrics,
  onChange,
  darkMode
}) => {
  // Current selections
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [selectedMetric, setSelectedMetric] = useState<string>("");
  
  // Available options
  const [availableDevices, setAvailableDevices] = useState<string[]>([]);
  const [availableMetricTypes, setAvailableMetricTypes] = useState<string[]>([]);
  
  // CPU metric types (from the parser)
  const CPU_METRICS = ["%user", "%nice", "%system", "%iowait", "%steal", "%idle"];
  
  // Device metric types (from the parser)
  const DEVICE_METRICS = ["r/s", "w/s", "rkB/s", "wkB/s", "r_await", "w_await", "%util"];
  
  // Extract devices and metric types from available metrics
  useEffect(() => {
    console.log("Iostat available metrics:", availableMetrics);
    
    const devices = new Set<string>();
    const metricsByDevice = new Map<string, Set<string>>();
    
    // Initialize with CPU
    devices.add("CPU");
    metricsByDevice.set("CPU", new Set<string>());
    
    availableMetrics.forEach(metric => {
      // Check if it's a CPU metric
      if (CPU_METRICS.includes(metric)) {
        metricsByDevice.get("CPU")?.add(metric);
      } else {
        // It's a device metric, format: "deviceName metricType"
        const parts = metric.split(" ");
        if (parts.length >= 2) {
          const device = parts[0];
          const metricType = parts.slice(1).join(" ");
          
          // Add device
          devices.add(device);
          
          // Initialize metric set for this device if needed
          if (!metricsByDevice.has(device)) {
            metricsByDevice.set(device, new Set<string>());
          }
          
          // Add metric
          metricsByDevice.get(device)?.add(metricType);
        }
      }
    });
    
    // Sort devices - put CPU first, then alphabetically
    const deviceList = Array.from(devices).sort((a, b) => {
      if (a === "CPU") return -1;
      if (b === "CPU") return 1;
      return a.localeCompare(b);
    });
    
    console.log("Available devices:", deviceList);
    setAvailableDevices(deviceList);
    
    // Set default selections if available
    if (deviceList.length > 0) {
      const defaultDevice = deviceList[0];
      setSelectedDevice(defaultDevice);
      
      // Get metrics for the selected device
      const metrics = Array.from(metricsByDevice.get(defaultDevice) || []).sort();
      setAvailableMetricTypes(metrics);
      
      if (metrics.length > 0) {
        const defaultMetric = metrics[0];
        setSelectedMetric(defaultMetric);
        
        // Update selected metric
        updateSelectedMetric(defaultDevice, defaultMetric);
      }
    }
  }, [availableMetrics]);
  
  // Update available metrics when device selection changes
  useEffect(() => {
    if (!selectedDevice) return;
    
    const metricTypes = new Set<string>();
    
    if (selectedDevice === "CPU") {
      // For CPU, use the CPU metrics that are in availableMetrics
      CPU_METRICS.forEach(metric => {
        if (availableMetrics.includes(metric)) {
          metricTypes.add(metric);
        }
      });
    } else {
      // For devices, find metrics that start with the device name
      availableMetrics.forEach(metric => {
        if (metric.startsWith(selectedDevice + " ")) {
          const metricType = metric.substring(selectedDevice.length + 1);
          metricTypes.add(metricType);
        }
      });
    }
    
    const metricList = Array.from(metricTypes).sort();
    console.log(`Available metrics for ${selectedDevice}:`, metricList);
    setAvailableMetricTypes(metricList);
    
    // If current metric is no longer valid, select the first available one
    if (metricList.length > 0 && !metricList.includes(selectedMetric)) {
      setSelectedMetric(metricList[0]);
      updateSelectedMetric(selectedDevice, metricList[0]);
    }
  }, [selectedDevice, availableMetrics]);
  
  // Update selected metric based on device and metric type
  const updateSelectedMetric = (device: string, metricType: string) => {
    if (!device || !metricType) {
      onChange([]);
      return;
    }
    
    let metricName: string;
    if (device === "CPU") {
      metricName = metricType;
    } else {
      metricName = `${device} ${metricType}`;
    }
    
    console.log("Selecting metric:", metricName);
    
    if (availableMetrics.includes(metricName)) {
      onChange([metricName]);
    } else {
      console.warn(`Metric "${metricName}" not found in available metrics`);
      onChange([]);
    }
  };
  
  // Handle device selection
  const handleDeviceChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const device = event.target.value;
    setSelectedDevice(device);
    
    // Don't update the metric yet - let the useEffect handle it since 
    // available metrics will change
  };
  
  // Handle metric type selection
  const handleMetricChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const metric = event.target.value;
    setSelectedMetric(metric);
    
    if (selectedDevice && metric) {
      updateSelectedMetric(selectedDevice, metric);
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
        I/O Statistics
      </h3>
      
      <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
        <div style={{ flex: 1 }}>
          <label 
            htmlFor="device-dropdown" 
            style={{ 
              display: "block", 
              marginBottom: "8px",
              color: darkMode ? "#e1e1e1" : "#333"
            }}
          >
            Device
          </label>
          <select
            id="device-dropdown"
            value={selectedDevice}
            onChange={handleDeviceChange}
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
            <option value="">Select Device</option>
            {availableDevices.map(device => (
              <option key={device} value={device}>
                {device}
              </option>
            ))}
          </select>
          {availableDevices.length === 0 && (
            <div style={{ marginTop: "8px", color: darkMode ? "#ff9999" : "#d32f2f" }}>
              No devices found in data
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
            disabled={!selectedDevice}
          >
            <option value="">Select Metric</option>
            {availableMetricTypes.map(metric => (
              <option key={metric} value={metric}>
                {metric}
              </option>
            ))}
          </select>
          {selectedDevice && availableMetricTypes.length === 0 && (
            <div style={{ marginTop: "8px", color: darkMode ? "#ff9999" : "#d32f2f" }}>
              No metrics found for selected device
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