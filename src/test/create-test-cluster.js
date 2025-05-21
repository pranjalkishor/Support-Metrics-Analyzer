/**
 * This script creates a test cluster directory structure with sample system.log files
 * for testing the folder upload feature.
 * 
 * Usage: node create-test-cluster.js
 */

const fs = require('fs');
const path = require('path');

// Create a sample directory structure: nodes/IP_of_node/logs/system.log
const CLUSTER_DIR = path.join(__dirname, 'cluster');
const NODE_IPS = ['10.0.0.1', '10.0.0.2', '10.0.0.3'];

// Sample system.log content for testing
function generateSampleSystemLog(nodeIp) {
  const lines = [];
  const timestamp = new Date();
  
  // Add some StatusLogger entries
  for (let i = 0; i < 50; i++) {
    timestamp.setSeconds(timestamp.getSeconds() + 10);
    const timeStr = timestamp.toISOString().replace('T', ' ').replace('Z', ',000');
    
    // Add thread pool metrics
    lines.push(`INFO  [OptionalTasks:1] ${timeStr} StatusLogger.java:174 - Node ${nodeIp}: Pool Name                    Active  Pending  Completed   Blocked  All Time Blocked`);
    lines.push(`CompactionExecutor              ${Math.floor(Math.random() * 5)}       ${Math.floor(Math.random() * 10)}          0         0                 0`);
    lines.push(`AntiEntropyStage               ${Math.floor(Math.random() * 3)}       ${Math.floor(Math.random() * 5)}          0         0                 0`);
    lines.push(`GossipStage                    ${Math.floor(Math.random() * 2)}       ${Math.floor(Math.random() * 3)}          0         0                 0`);
    lines.push('\n');
  }
  
  // Add some GC log entries
  for (let i = 0; i < 20; i++) {
    timestamp.setSeconds(timestamp.getSeconds() + 30);
    const timeStr = timestamp.toISOString().replace('T', ' ').replace('Z', ',000');
    
    lines.push(`INFO  [GCInspector:1] ${timeStr} GCInspector.java:285 - Node ${nodeIp}: ParNew: ${Math.floor(Math.random() * 100) + 200}K->${Math.floor(Math.random() * 50) + 50}K(${Math.floor(Math.random() * 200) + 1000}K), ${Math.floor(Math.random() * 100) + 50} ms`);
  }
  
  return lines.join('\n');
}

// Create the directory structure
console.log('Creating test cluster directory structure...');

// Create the main cluster directory
if (!fs.existsSync(CLUSTER_DIR)) {
  fs.mkdirSync(CLUSTER_DIR, { recursive: true });
}

// Create a directory for each node
NODE_IPS.forEach(ip => {
  const nodeDir = path.join(CLUSTER_DIR, 'nodes', ip);
  const logsDir = path.join(nodeDir, 'logs');
  
  // Create directories
  fs.mkdirSync(logsDir, { recursive: true });
  
  // Create sample system.log
  const systemLogPath = path.join(logsDir, 'system.log');
  fs.writeFileSync(systemLogPath, generateSampleSystemLog(ip));
  
  console.log(`Created sample system.log for node ${ip}`);
});

console.log('\nTest cluster created successfully at:', CLUSTER_DIR);
console.log('\nTo test, upload the following folder in the application:');
console.log(path.join(CLUSTER_DIR, 'nodes')); 