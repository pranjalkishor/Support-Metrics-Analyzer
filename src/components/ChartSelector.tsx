import React, { useState } from "react";

type Props = {
  availableMetrics: string[];
  selectedMetrics: string[];
  onChange: (metrics: string[]) => void;
  darkMode: boolean;
};

export const ChartSelector: React.FC<Props> = ({
  availableMetrics,
  selectedMetrics,
  onChange,
  darkMode
}) => {
  const [expanded, setExpanded] = useState(true);
  const [selectedPercentiles, setSelectedPercentiles] = useState<string[]>(["p50", "p99"]);
  
  // Extract operation types from metrics (Read Latency, Write Latency, etc.)
  const operationTypes = Array.from(new Set(
    availableMetrics.map(metric => {
      const parts = metric.split(" ");
      return parts.slice(1).join(" "); // Everything after the percentile prefix
    })
  ));
  
  // Extract percentile types (p50, p95, p99, etc.)
  const percentileTypes = Array.from(new Set(
    availableMetrics.map(metric => metric.split(" ")[0])
  )).sort((a, b) => {
    // Sort percentiles in logical order
    const order = ["pMin", "p50", "p75", "p95", "p98", "p99", "pMax"];
    return order.indexOf(a) - order.indexOf(b);
  });
  
  // Handle operation selection
  const toggleOperation = (operation: string) => {
    // Find if any metrics for this operation are currently selected
    const isSelected = selectedMetrics.some(m => m.includes(operation));
    
    if (isSelected) {
      // Remove all metrics for this operation
      onChange(selectedMetrics.filter(m => !m.includes(operation)));
    } else {
      // Add all metrics for this operation + selected percentiles
      const newMetrics = [...selectedMetrics];
      
      for (const percentile of selectedPercentiles) {
        const metric = `${percentile} ${operation}`;
        if (availableMetrics.includes(metric) && !newMetrics.includes(metric)) {
          newMetrics.push(metric);
        }
      }
      
      onChange(newMetrics);
    }
  };
  
  // Handle percentile selection
  const togglePercentile = (percentile: string) => {
    let newPercentiles: string[];
    
    if (selectedPercentiles.includes(percentile)) {
      newPercentiles = selectedPercentiles.filter(p => p !== percentile);
    } else {
      newPercentiles = [...selectedPercentiles, percentile];
    }
    
    setSelectedPercentiles(newPercentiles);
    
    // Update selected metrics based on new percentiles
    const currentOperations = Array.from(new Set(
      selectedMetrics.map(metric => {
        const parts = metric.split(" ");
        return parts.slice(1).join(" ");
      })
    ));
    
    const newMetrics: string[] = [];
    
    for (const operation of currentOperations) {
      for (const percentile of newPercentiles) {
        const metric = `${percentile} ${operation}`;
        if (availableMetrics.includes(metric)) {
          newMetrics.push(metric);
        }
      }
    }
    
    onChange(newMetrics);
  };
  
  // Check if operation is selected
  const isOperationSelected = (operation: string) => {
    return selectedMetrics.some(m => m.includes(operation));
  };
  
  return (
    <div style={{
      border: `1px solid ${darkMode ? '#444' : '#ccc'}`,
      borderRadius: '8px',
      padding: '20px',
      backgroundColor: darkMode ? '#232333' : '#f5f5f5',
      marginBottom: '20px'
    }}>
      <h3 style={{
        margin: '0 0 20px 0',
        color: darkMode ? '#e1e1e1' : 'inherit'
      }}>
        Select Metrics to Display
      </h3>
      
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        {availableMetrics.map(metric => (
          <label key={metric} style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 12px',
            border: `1px solid ${darkMode ? '#444' : '#ddd'}`,
            borderRadius: '4px',
            backgroundColor: selectedMetrics.includes(metric) 
              ? (darkMode ? '#3b5199' : '#e1f5fe')
              : (darkMode ? '#2a2a40' : 'white'),
            color: darkMode ? '#e1e1e1' : 'inherit',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={selectedMetrics.includes(metric)}
              onChange={e => {
                if (e.target.checked) {
                  onChange([...selectedMetrics, metric]);
                } else {
                  onChange(selectedMetrics.filter(m => m !== metric));
                }
              }}
              style={{ marginRight: '8px' }}
            />
            {metric}
          </label>
        ))}
      </div>
    </div>
  );
};
