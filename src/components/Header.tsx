import React from "react";

type HeaderProps = {
  darkMode: boolean;
  toggleDarkMode: () => void;
};

export const Header: React.FC<HeaderProps> = ({ darkMode, toggleDarkMode }) => {
  return (
    <header style={{
      backgroundColor: darkMode ? "#1A1A2E" : "white",
      color: darkMode ? "#E5E5E5" : "#333",
      padding: "16px 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between", 
      boxShadow: darkMode ? "0 2px 10px rgba(0,0,0,0.5)" : "0 2px 4px rgba(0,0,0,0.1)",
      borderBottom: darkMode ? "1px solid #333" : "1px solid #e0e6ed"
    }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={{
          background: "#FF5C35", // DataStax orange
          color: "white",
          fontWeight: "bold",
          padding: "8px 12px",
          borderRadius: "4px",
          marginRight: "16px"
        }}>
          DataStax
        </div>
        <h1 style={{ 
          margin: 0, 
          fontSize: "24px", 
          fontWeight: 500,
          color: darkMode ? "#E5E5E5" : "#2E3A58" 
        }}>
          Cassandra Metrics Visualizer
        </h1>
      </div>
      
      <button 
        onClick={toggleDarkMode}
        style={{
          background: "none",
          border: darkMode ? "1px solid #666" : "1px solid #ccc",
          borderRadius: "4px",
          padding: "8px 12px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          color: darkMode ? "#E5E5E5" : "#666",
          backgroundColor: darkMode ? "#2A2A40" : "#f5f5f5"
        }}
      >
        {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
      </button>
    </header>
  );
}; 