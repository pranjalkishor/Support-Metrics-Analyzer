# Support Metrics Analyzer

A powerful web-based visualization tool for analyzing Apache Cassandra & DataStax Enterprise metrics and logs. This tool helps in troubleshooting and performance analysis by providing interactive visualizations of various metrics collected from Cassandra/DSE nodes.

![Support Metrics Analyzer Screenshot](docs/screenshot.png)

## Features

- **Multiple File Format Support**:
  - **System Logs**: Parse thread pool metrics, GC events, tombstone warnings, and slow reads
  - **iostat**: Analyze disk I/O statistics including throughput, utilization, and service times
  - **tpstats**: Visualize thread pool statistics across multiple metrics
  - **mpstat**: Monitor CPU utilization and performance
  - **Proxy & Table Histograms**: Analyze operation latencies at different percentiles
  - **Top CPU Processes**: Track CPU usage patterns of system processes
  - **Swiss Java Knife (SJK) Output**: Analyze JVM performance metrics

- **Advanced Visualization**:
  - Interactive time-series charts with zoom capabilities
  - Compare multiple metrics simultaneously
  - Multiple visualization modes for thread pool data
  - Dark mode support

- **User-Friendly Interface**:
  - Simple drag-and-drop file upload
  - Automatic file type detection
  - Intuitive metric selection
  - Responsive design that works on various screen sizes

## Getting Started

### Prerequisites

- Node.js (v14.0.0 or higher)
- npm (v6.0.0 or higher)

### Installation

1. Clone this repository:
   ```
   git clone https://github.com/datastax/Support-Metrics-Analyzer.git
   cd Support-Metrics-Analyzer
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

4. Open your browser and navigate to http://localhost:3000

### Building for Production

To create a production build:

```
npm run build
```

The build artifacts will be stored in the `build/` directory, ready for deployment.

## Usage Guide

### Uploading Files

1. **Upload Log Files**: Click the upload area or drag and drop your log files
2. File types are automatically detected based on their contents and naming
3. For optimal results, use unmodified logs directly from Cassandra/DSE nodes

### Visualizing Metrics

#### Thread Pool Metrics (system.log)

- Select thread pools from the grid view
- Check metrics you want to visualize (Active, Pending, Completed, etc.)
- Each thread pool will display in its own chart
- Use the "Show Top Active Pools" button to quickly find busy thread pools

#### iostat Metrics

- Select devices and metrics to visualize
- Compare metrics across different devices or focus on a specific device

#### Thread Pool Stats (tpstats)

- Switch between ThreadPool, MessageType, and Meters sections
- Select specific thread pools and task types to analyze

### Tips for Analysis

- **GC Impact Analysis**: Look for correlations between GC events and operation latencies
- **Thread Pool Blocking**: Monitor thread pool metrics to identify potential blocking issues
- **I/O Bottlenecks**: Use iostat visualization to identify disk performance issues
- **CPU Saturation**: Use mpstat data to identify CPU bottlenecks

## Supported File Formats

| File Type | Description | Example Filename |
|-----------|-------------|------------------|
| System Log | Cassandra/DSE system.log files | `system.log` |
| iostat | Linux iostat output | `iostat.out`, `iostat.txt`, `*.output` |
| tpstats | Cassandra thread pool stats | `tpstats.out` |
| mpstat | CPU utilization statistics | `mpstat.out` |
| Proxy Histograms | Cassandra proxy histogram data | `proxyhistograms.log` |
| Table Histograms | Cassandra table histogram data | `tablehistograms.log` |
| Top CPU | Linux top command CPU output | `os_top_cpu.out` |
| SJK | Swiss Java Knife output | `sjk.out` |

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the Apache 2.0 License - see the LICENSE file for details.

## Acknowledgments

- The DataStax Support team for identifying the need for this tool
- Contributors who have helped enhance this tool's capabilities
