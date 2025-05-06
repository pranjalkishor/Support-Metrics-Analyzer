# Cassandra Metrics Visualizer

A React-based visualization tool for Apache Cassandra metrics.

## Overview

Cassandra Metrics Visualizer is a web application for analyzing and visualizing different types of Cassandra metrics including:

- **tpstats**: Thread pool statistics
- **iostat**: I/O statistics
- **mpstat**: CPU statistics
- **proxyhistograms**: Latency metrics for different operations
- **tablehistograms**: Table-specific latency and size metrics

## Features

- Interactive time series visualization
- Support for multiple Cassandra metric file formats
- Customizable metric selection
- Logarithmic scaling for latency metrics
- Dark mode support

## Getting Started

### Prerequisites

- Node.js (v14+)
- npm

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/cassandra-metrics-visualizer.git
   cd cassandra-metrics-visualizer
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm start
   ```

4. Build for production:
   ```
   npm run build
   ```

## Usage

1. Upload a Cassandra metrics file (tpstats, iostat, mpstat, proxyhistograms, or tablehistograms)
2. Select metrics to visualize
3. For tablehistograms:
   - First select a table
   - Then select operations (Read Latency, Write Latency, etc.)
   - Finally select percentiles (p50, p95, etc.)
4. Analyze the time series data in the chart

## File Format Support

### tpstats
Thread pool statistics showing active, pending, and completed tasks for different thread pools.

### iostat
I/O statistics showing read/write operations, throughput, and utilization for different devices.

### mpstat
CPU statistics showing utilization across different CPU cores.

### proxyhistograms
Latency metrics for different operation types (Read, Write, Range, CAS) at various percentiles.

### tablehistograms
Table-specific metrics for different tables including:
- Read Latency
- Write Latency
- SSTables count
- Partition Size
- Cell Count

## Technologies

- React
- TypeScript
- Plotly.js for visualization

## License

MIT
