import React, { useState, useEffect } from "react";

interface SwissJavaKnifeSelectorProps {
  availableMetrics: string[];
  selectedMetrics: string[];
  onChange: (selected: string[]) => void;
  darkMode: boolean;
}

export const SwissJavaKnifeSelector: React.FC<SwissJavaKnifeSelectorProps> = ({
  availableMetrics,
  selectedMetrics,
  onChange,
  darkMode
}) => {
  const [searchText, setSearchText] = useState("");
  const [showCpuOnly, setShowCpuOnly] = useState(false);
  const [showAllocOnly, setShowAllocOnly] = useState(false);
  const [showThreadsOnly, setShowThreadsOnly] = useState(false);
  const [showProcessOnly, setShowProcessOnly] = useState(false);
  const [sortedMetrics, setSortedMetrics] = useState<string[]>([]);

  // Sort and filter metrics based on search and filter options
  useEffect(() => {
    let filtered = [...availableMetrics];

    // Apply search filter
    if (searchText) {
      const lowerSearch = searchText.toLowerCase();
      filtered = filtered.filter(metric => 
        metric.toLowerCase().includes(lowerSearch)
      );
    }

    // Apply type filters
    if (showCpuOnly) {
      filtered = filtered.filter(metric => metric.includes("CPU"));
    }

    if (showAllocOnly) {
      filtered = filtered.filter(metric => metric.includes("Alloc"));
    }

    if (showThreadsOnly) {
      filtered = filtered.filter(metric => metric.includes("Thread"));
    }

    if (showProcessOnly) {
      filtered = filtered.filter(metric => metric.includes("Process"));
    }

    // Sort metrics - Process metrics first, then CPU metrics before allocation metrics
    filtered.sort((a, b) => {
      // Process metrics first
      if (a.includes("Process") && !b.includes("Process")) return -1;
      if (!a.includes("Process") && b.includes("Process")) return 1;
      
      // Then sort by CPU vs Allocation
      if (a.includes("CPU") && b.includes("Alloc")) return -1;
      if (a.includes("Alloc") && b.includes("CPU")) return 1;
      
      // Then alphabetically
      return a.localeCompare(b);
    });

    setSortedMetrics(filtered);
  }, [availableMetrics, searchText, showCpuOnly, showAllocOnly, showThreadsOnly, showProcessOnly]);

  // Helper for toggling selection
  const toggleMetric = (metric: string) => {
    if (selectedMetrics.includes(metric)) {
      onChange(selectedMetrics.filter(m => m !== metric));
    } else {
      onChange([...selectedMetrics, metric]);
    }
  };

  // Helper for selecting groups of metrics
  const selectGroup = (type: 'process' | 'top-cpu' | 'top-alloc') => {
    if (type === 'process') {
      // Select all process metrics
      const processMetrics = availableMetrics.filter(m => m.includes("Process"));
      onChange(processMetrics);
    } else if (type === 'top-cpu') {
      // Select process CPU and top 5 thread CPU consumers
      const cpuMetrics = availableMetrics
        .filter(m => m.includes("CPU"))
        .sort((a, b) => {
          // Process CPU first
          if (a.includes("Process")) return -1;
          if (b.includes("Process")) return 1;
          
          // Find the indices of the metrics in the available list to approximate ranking
          const aIndex = availableMetrics.indexOf(a);
          const bIndex = availableMetrics.indexOf(b);
          return aIndex - bIndex;
        })
        .slice(0, 6); // Process CPU + top 5 threads
      
      onChange(cpuMetrics);
    } else if (type === 'top-alloc') {
      // Select process allocation and top 5 thread allocation rates
      const allocMetrics = availableMetrics
        .filter(m => m.includes("Alloc"))
        .sort((a, b) => {
          // Process allocation first
          if (a.includes("Process")) return -1;
          if (b.includes("Process")) return 1;
          
          // Find the indices of the metrics in the available list to approximate ranking
          const aIndex = availableMetrics.indexOf(a);
          const bIndex = availableMetrics.indexOf(b);
          return aIndex - bIndex;
        })
        .slice(0, 6); // Process allocation + top 5 threads
      
      onChange(allocMetrics);
    }
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
        JVM Thread Metrics
      </h2>

      <div style={{ display: "flex", marginBottom: "12px", gap: "8px" }}>
        <button
          onClick={() => selectGroup('process')}
          style={{
            padding: "6px 12px",
            background: darkMode ? "#3A36DB" : "#3A36DB",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Process Metrics
        </button>
        <button
          onClick={() => selectGroup('top-cpu')}
          style={{
            padding: "6px 12px",
            background: darkMode ? "#3A36DB" : "#3A36DB",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Top CPU Threads
        </button>
        <button
          onClick={() => selectGroup('top-alloc')}
          style={{
            padding: "6px 12px",
            background: darkMode ? "#3A36DB" : "#3A36DB",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Top Allocation Threads
        </button>
      </div>

      <div style={{ display: "flex", marginBottom: "16px", gap: "8px", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "200px" }}>
          <input
            type="text"
            placeholder="Search metrics..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
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

        <label style={{ display: "flex", alignItems: "center", color: darkMode ? "#e1e1e1" : "inherit" }}>
          <input
            type="checkbox"
            checked={showCpuOnly}
            onChange={() => setShowCpuOnly(!showCpuOnly)}
            style={{ marginRight: "6px" }}
          />
          CPU Only
        </label>

        <label style={{ display: "flex", alignItems: "center", color: darkMode ? "#e1e1e1" : "inherit" }}>
          <input
            type="checkbox"
            checked={showAllocOnly}
            onChange={() => setShowAllocOnly(!showAllocOnly)}
            style={{ marginRight: "6px" }}
          />
          Allocation Only
        </label>

        <label style={{ display: "flex", alignItems: "center", color: darkMode ? "#e1e1e1" : "inherit" }}>
          <input
            type="checkbox"
            checked={showThreadsOnly}
            onChange={() => setShowThreadsOnly(!showThreadsOnly)}
            style={{ marginRight: "6px" }}
          />
          Threads Only
        </label>

        <label style={{ display: "flex", alignItems: "center", color: darkMode ? "#e1e1e1" : "inherit" }}>
          <input
            type="checkbox"
            checked={showProcessOnly}
            onChange={() => setShowProcessOnly(!showProcessOnly)}
            style={{ marginRight: "6px" }}
          />
          Process Only
        </label>
      </div>

      <div
        style={{
          maxHeight: "300px",
          overflowY: "auto",
          border: darkMode ? "1px solid #444" : "1px solid #ddd",
          borderRadius: "4px",
          padding: "8px",
        }}
      >
        {sortedMetrics.length === 0 ? (
          <div style={{ color: darkMode ? "#e1e1e1" : "inherit", padding: "8px" }}>
            No metrics match your filters
          </div>
        ) : (
          sortedMetrics.map((metric) => (
            <div
              key={metric}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "6px 8px",
                borderRadius: "4px",
                background: selectedMetrics.includes(metric)
                  ? darkMode
                    ? "#3A36DB33"
                    : "#3A36DB22"
                  : "transparent",
                marginBottom: "4px",
                cursor: "pointer",
              }}
              onClick={() => toggleMetric(metric)}
            >
              <input
                type="checkbox"
                checked={selectedMetrics.includes(metric)}
                onChange={() => {}}
                style={{ marginRight: "8px" }}
              />
              <span style={{ color: darkMode ? "#e1e1e1" : "inherit" }}>
                {metric}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SwissJavaKnifeSelector; 