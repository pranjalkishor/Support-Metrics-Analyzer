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
  // Extract unique tables
  const allTables = Array.from(new Set(
    availableMetrics.map(m => m.split(" | ")[0])
  )).sort();
  
  // State for selections
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [selectedOperations, setSelectedOperations] = useState<string[]>([]);
  const [selectedPercentiles, setSelectedPercentiles] = useState<string[]>(["95%", "99%"]);
  
  // Available operations and percentiles
  const availableOperations = ["SSTables", "Write Latency", "Read Latency", 
                             "Partition Size", "Cell Count"];
  const availablePercentiles = ["Min", "50%", "75%", "95%", "98%", "99%", "Max"];
  
  // Initialize selections on first render
  useEffect(() => {
    if (allTables.length > 0 && !selectedTable) {
      setSelectedTable(allTables[0]);
      setSelectedOperations(["Read Latency"]);
    }
  }, [allTables]);
  
  // Update metrics when selections change
  useEffect(() => {
    if (!selectedTable || selectedOperations.length === 0) return;
    
    const newSelectedMetrics: string[] = [];
    
    selectedOperations.forEach(operation => {
      selectedPercentiles.forEach(percentile => {
        const metricKey = `${selectedTable} | ${operation} | ${percentile}`;
        if (availableMetrics.includes(metricKey)) {
          newSelectedMetrics.push(metricKey);
        }
      });
    });
    
    onChange(newSelectedMetrics);
  }, [selectedTable, selectedOperations, selectedPercentiles, availableMetrics, onChange]);
  
  const handleTableChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTable(e.target.value);
  };
  
  return (
    <div style={{ 
      border: `1px solid ${darkMode ? '#444' : '#ccc'}`, 
      borderRadius: "8px", 
      padding: "20px", 
      backgroundColor: darkMode ? "#232333" : "#f9f9f9",
      marginBottom: "20px" 
    }}>
      <h3 style={{ 
        marginTop: 0,
        color: darkMode ? "#e1e1e1" : "inherit"
      }}>
        Table Metrics Selector
      </h3>
      
      {/* Step 1: Table Selection */}
      <div style={{ marginBottom: "20px" }}>
        <label htmlFor="table-select" style={{ 
          display: "block", 
          fontWeight: "bold", 
          marginBottom: "8px",
          color: darkMode ? "#e1e1e1" : "inherit" 
        }}>
          1. Select Table:
        </label>
        <select
          id="table-select"
          value={selectedTable}
          onChange={handleTableChange}
          style={{ 
            width: "100%",
            padding: "10px",
            borderRadius: "4px",
            border: `1px solid ${darkMode ? '#444' : '#ccc'}`,
            backgroundColor: darkMode ? "#2a2a40" : "white",
            color: darkMode ? "#e1e1e1" : "inherit"
          }}
        >
          {allTables.map(table => (
            <option key={table} value={table}>{table}</option>
          ))}
        </select>
      </div>
      
      {/* Operations and Percentiles sections with similar dark mode styling */}
      <div style={{ marginBottom: "20px" }}>
        <label style={{ 
          display: "block", 
          fontWeight: "bold", 
          marginBottom: "8px",
          color: darkMode ? "#e1e1e1" : "inherit"
        }}>
          2. Select Operations:
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
          {availableOperations.map(operation => (
            <label key={operation} style={{ 
              display: "flex", 
              alignItems: "center",
              padding: "8px 12px",
              border: `1px solid ${darkMode ? '#444' : '#ddd'}`,
              borderRadius: "4px",
              backgroundColor: selectedOperations.includes(operation) 
                ? (darkMode ? "#3b5199" : "#e1f5fe") 
                : (darkMode ? "#2a2a40" : "white"),
              color: darkMode ? "#e1e1e1" : "inherit",
              cursor: "pointer"
            }}>
              <input
                type="checkbox"
                checked={selectedOperations.includes(operation)}
                onChange={() => {
                  if (selectedOperations.includes(operation)) {
                    setSelectedOperations(selectedOperations.filter(op => op !== operation));
                  } else {
                    setSelectedOperations([...selectedOperations, operation]);
                  }
                }}
                style={{ marginRight: "8px" }}
              />
              {operation}
            </label>
          ))}
        </div>
      </div>
      
      {/* Apply similar styles to the percentiles section */}
      <div>
        <label style={{ 
          display: "block", 
          fontWeight: "bold", 
          marginBottom: "8px",
          color: darkMode ? "#e1e1e1" : "inherit"
        }}>
          3. Select Percentiles:
        </label>
        <div style={{ 
          display: "flex", 
          flexWrap: "wrap", 
          gap: "10px" 
        }}>
          {availablePercentiles.map(percentile => (
            <label key={percentile} style={{ 
              display: "flex", 
              alignItems: "center",
              padding: "6px 10px",
              border: `1px solid ${darkMode ? '#444' : '#ddd'}`,
              borderRadius: "16px",
              backgroundColor: selectedPercentiles.includes(percentile) 
                ? (darkMode ? "#3b5199" : "#e1f5fe") 
                : (darkMode ? "#2a2a40" : "white"),
              color: darkMode ? "#e1e1e1" : "inherit",
              cursor: "pointer"
            }}>
              <input
                type="checkbox"
                checked={selectedPercentiles.includes(percentile)}
                onChange={() => {
                  if (selectedPercentiles.includes(percentile)) {
                    setSelectedPercentiles(selectedPercentiles.filter(p => p !== percentile));
                  } else {
                    setSelectedPercentiles([...selectedPercentiles, percentile]);
                  }
                }}
                style={{ marginRight: "8px" }}
              />
              {percentile}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}; 