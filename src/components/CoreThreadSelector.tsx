import React, { useState, useEffect } from "react";

type Props = {
  availableMetrics: string[];
  selectedMetrics: string[];
  onChange: (metrics: string[]) => void;
  darkMode: boolean;
};

export const CoreThreadSelector: React.FC<Props> = ({
  availableMetrics,
  selectedMetrics,
  onChange,
  darkMode
}) => {
  const [selectedThreads, setSelectedThreads] = useState<string[]>([]);
  const [availableThreads, setAvailableThreads] = useState<string[]>([]);

  useEffect(() => {
    const threads = new Set<string>();
    availableMetrics.forEach(metric => {
      // Expected format: "CoreThread-0 %user"
      const parts = metric.split(" ");
      if (parts.length >= 2 && parts[0].startsWith("CoreThread-")) {
        threads.add(parts[0]);
      }
    });

    const threadList = Array.from(threads).sort();
    setAvailableThreads(threadList);
  }, [availableMetrics]);

  useEffect(() => {
    const metricNames = selectedThreads.map(thread => `${thread} %user`);
    onChange(metricNames);
  }, [selectedThreads]);

  const handleThreadChange = (thread: string) => {
    const newSelectedThreads = selectedThreads.includes(thread)
      ? selectedThreads.filter(t => t !== thread)
      : [...selectedThreads, thread];
    setSelectedThreads(newSelectedThreads);
  };

  return (
    <div style={{
      backgroundColor: darkMode ? "#232333" : "#f5f5f5",
      borderRadius: "8px",
      padding: "20px",
      marginBottom: "20px"
    }}>
      <h3 style={{ margin: "0 0 15px 0", color: darkMode ? "#e1e1e1" : "#333" }}>
        Core Thread CPU Usage
      </h3>
      
      <div>
        <label style={{ display: "block", marginBottom: "8px", color: darkMode ? "#e1e1e1" : "#333" }}>
          Core Threads
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
          {availableThreads.map(thread => (
            <div key={thread} style={{ display: "flex", alignItems: "center" }}>
              <input
                type="checkbox"
                id={`thread-${thread}`}
                value={thread}
                checked={selectedThreads.includes(thread)}
                onChange={() => handleThreadChange(thread)}
              />
              <label htmlFor={`thread-${thread}`} style={{ marginLeft: "5px", color: darkMode ? "#e1e1e1" : "#333" }}>
                {thread}
              </label>
            </div>
          ))}
        </div>
        {availableThreads.length === 0 && (
          <div style={{ marginTop: "8px", color: darkMode ? "#ff9999" : "#d32f2f" }}>
            No CoreThread data found
          </div>
        )}
      </div>
    </div>
  );
}; 