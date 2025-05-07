import React, { useState, useEffect } from "react";

type Props = {
  availableMetrics: string[];
  selectedMetrics: string[];
  onChange: (metrics: string[]) => void;
  darkMode: boolean;
};

export const TableHistogramSelector: React.FC<Props> = ({
  availableMetrics,
  selectedMetrics,
  onChange,
  darkMode,
}) => {
  console.log("TableHistogramSelector rendering with", { 
    availableMetrics: availableMetrics.length,
    selectedMetrics: selectedMetrics.length
  });
  
  // Extract tables from metrics
  const tables = React.useMemo(() => {
    const tableSet = new Set<string>();
    availableMetrics.forEach(metric => {
      const parts = metric.split(" | ");
      if (parts.length >= 3) {
        tableSet.add(parts[0]);
      }
    });
    return Array.from(tableSet).sort();
  }, [availableMetrics]);
  
  // Static lists
  const operations = ["SSTables", "Write Latency", "Read Latency", "Partition Size", "Cell Count"];
  const percentiles = ["50%", "75%", "95%", "98%", "99%", "Min", "Max"];
  
  // State
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [selectedOps, setSelectedOps] = useState<string[]>(["Read Latency"]);
  const [selectedPcts, setSelectedPcts] = useState<string[]>(["95%", "99%"]);
  
  // Initialize on mount
  useEffect(() => {
    if (tables.length > 0 && !selectedTable) {
      const firstTable = tables[0];
      console.log("Setting initial table:", firstTable);
      setSelectedTable(firstTable);
      
      // Explicitly update metrics
      const initialMetrics = getMetrics(firstTable, selectedOps, selectedPcts);
      console.log("Setting initial metrics:", initialMetrics);
      onChange(initialMetrics);
    }
  }, [tables]);
  
  // Helper function to get metrics based on selections
  const getMetrics = (table: string, ops: string[], pcts: string[]): string[] => {
    if (!table || ops.length === 0 || pcts.length === 0) return [];
    
    return availableMetrics.filter(metric => {
      const parts = metric.split(" | ");
      if (parts.length !== 3) return false;
      
      const [metricTable, metricOp, metricPct] = parts;
      return (
        metricTable === table && 
        ops.includes(metricOp) && 
        pcts.includes(metricPct)
      );
    });
  };
  
  // Update metrics when table changes
  const handleTableChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const table = e.target.value;
    setSelectedTable(table);
    
    // Get metrics for the new table
    const metrics = getMetrics(table, selectedOps, selectedPcts);
    console.log(`Table changed to ${table}, new metrics:`, metrics);
    onChange(metrics);
  };
  
  // Toggle an operation
  const toggleOperation = (op: string) => {
    const newOps = selectedOps.includes(op)
      ? selectedOps.filter(o => o !== op)
      : [...selectedOps, op];
    
    setSelectedOps(newOps);
    
    // Update metrics with new operations
    const metrics = getMetrics(selectedTable, newOps, selectedPcts);
    console.log(`Operations updated to [${newOps.join(', ')}], new metrics:`, metrics);
    onChange(metrics);
  };
  
  // Toggle a percentile
  const togglePercentile = (pct: string) => {
    const newPcts = selectedPcts.includes(pct)
      ? selectedPcts.filter(p => p !== pct)
      : [...selectedPcts, pct];
    
    setSelectedPcts(newPcts);
    
    // Update metrics with new percentiles
    const metrics = getMetrics(selectedTable, selectedOps, newPcts);
    console.log(`Percentiles updated to [${newPcts.join(', ')}], new metrics:`, metrics);
    onChange(metrics);
  };
  
  // Styling helpers
  const getButtonStyle = (selected: boolean) => ({
    display: "flex",
    alignItems: "center",
    padding: "8px 12px",
    border: `1px solid ${darkMode ? '#444' : '#ddd'}`,
    borderRadius: "4px",
    backgroundColor: selected 
      ? (darkMode ? "#3b5199" : "#e1f5fe") 
      : (darkMode ? "#2a2a40" : "white"),
    color: darkMode ? "#e1e1e1" : "inherit",
    cursor: "pointer"
  });
  
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
        Table Metrics
      </h3>
      
      {/* Table selection */}
      <div style={{ marginBottom: "20px" }}>
        <label 
          htmlFor="table-select" 
          style={{ 
            display: "block", 
            marginBottom: "8px",
            color: darkMode ? "#e1e1e1" : "#333",
            fontWeight: "bold"
          }}
        >
          1. Select Table:
        </label>
        <select
          id="table-select"
          value={selectedTable}
          onChange={handleTableChange}
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
          {tables.length === 0 && (
            <option value="">No tables found</option>
          )}
          {tables.map(table => (
            <option key={table} value={table}>{table}</option>
          ))}
        </select>
        {tables.length === 0 && (
          <div style={{ marginTop: "8px", color: darkMode ? "#ff9999" : "#d32f2f" }}>
            No tables found in data
          </div>
        )}
      </div>
      
      {/* Operations */}
      <div style={{ marginBottom: "20px" }}>
        <label
          style={{ 
            display: "block", 
            marginBottom: "8px",
            color: darkMode ? "#e1e1e1" : "#333",
            fontWeight: "bold"
          }}
        >
          2. Select Operations:
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
          {operations.map(op => (
            <label key={op} style={getButtonStyle(selectedOps.includes(op))}>
              <input
                type="checkbox"
                checked={selectedOps.includes(op)}
                onChange={() => toggleOperation(op)}
                style={{ marginRight: "8px" }}
              />
              {op}
            </label>
          ))}
        </div>
      </div>
      
      {/* Percentiles */}
      <div style={{ marginBottom: "20px" }}>
        <label
          style={{ 
            display: "block", 
            marginBottom: "8px",
            color: darkMode ? "#e1e1e1" : "#333",
            fontWeight: "bold"
          }}
        >
          3. Select Percentiles:
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
          {percentiles.map(pct => (
            <label key={pct} style={{
              ...getButtonStyle(selectedPcts.includes(pct)),
              borderRadius: "16px"
            }}>
              <input
                type="checkbox"
                checked={selectedPcts.includes(pct)}
                onChange={() => togglePercentile(pct)}
                style={{ marginRight: "8px" }}
              />
              {pct}
            </label>
          ))}
        </div>
      </div>
      
      {/* Selected metrics */}
      {selectedMetrics.length > 0 ? (
        <div style={{
          marginTop: "20px",
          padding: "15px",
          backgroundColor: darkMode ? "#1e1e30" : "#f0f0f0",
          borderRadius: "4px",
          color: darkMode ? "#e1e1e1" : "#333"
        }}>
          <p style={{ margin: "0 0 10px 0", fontWeight: "bold" }}>
            Selected {selectedMetrics.length} Metrics
          </p>
        </div>
      ) : selectedTable ? (
        <div style={{ 
          marginTop: "20px", 
          padding: "15px",
          backgroundColor: darkMode ? "#51273c" : "#ffebee",
          color: darkMode ? "#ff9999" : "#c62828",
          borderRadius: "4px" 
        }}>
          No metrics found for the selected combination. Try different selections.
        </div>
      ) : null}
    </div>
  );
}; 