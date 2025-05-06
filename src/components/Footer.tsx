import React from 'react';

type FooterProps = {
  darkMode: boolean;
};

export const Footer: React.FC<FooterProps> = ({ darkMode }) => {
  return (
    <footer style={{
      textAlign: 'center',
      padding: '20px',
      borderTop: darkMode ? '1px solid #333' : '1px solid #e0e6ed',
      fontSize: '14px',
      color: darkMode ? '#999' : '#666',
      marginTop: '40px'
    }}>
      &copy; {new Date().getFullYear()} DataStax - Cassandra Metrics Visualizer
    </footer>
  );
}; 