import { ParsedTimeSeries } from "../types";

export interface ProcessData {
  pid: number;
  user: string;
  priority: string;
  nice: string;
  virtualMem: string;
  residentMem: string;
  sharedMem: string;
  status: string;
  cpuPercentage: number;
  memPercentage: number;
  time: string;
  command: string;
}

export interface TopSnapshot {
  timestamp: string;
  systemInfo: {
    uptime: string;
    load: string;
    tasks: string;
    cpuStats: string;
    memoryStats: string;
    swapStats: string;
  };
  processes: ProcessData[];
}

export function parseOsTopCpu(content: string): { snapshots: TopSnapshot[] } {
  console.log("Parsing OS top CPU data");
  
  try {
    // Check if content exists
    if (!content || typeof content !== 'string') {
      console.error("Invalid content provided to parser");
      return { snapshots: [] };
    }
    
    // Log the first 100 chars to debug
    console.log(`File starts with: ${content.substring(0, 100)}...`);
    
    // Split content by the separator - try different common separators
    let sections = content.split("==========").filter(s => s.trim().length > 0);
    
    // If no sections found, try alternative separators
    if (sections.length === 0) {
      sections = content.split("----------").filter(s => s.trim().length > 0);
    }
    
    // If still no sections, try to split by timestamp pattern
    if (sections.length === 0) {
      const timestampMatches = content.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g) || 
                               content.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/g);
      if (timestampMatches && timestampMatches.length > 0) {
        // Use timestamps as section markers
        console.log(`Found ${timestampMatches.length} timestamps to use as markers`);
        
        let tempContent = content;
        const tempSections = [];
        
        for (let i = 0; i < timestampMatches.length; i++) {
          const timestamp = timestampMatches[i];
          const startIdx = tempContent.indexOf(timestamp);
          
          if (startIdx >= 0) {
            if (i < timestampMatches.length - 1) {
              const nextTimestamp = timestampMatches[i+1];
              const endIdx = tempContent.indexOf(nextTimestamp);
              if (endIdx > startIdx) {
                tempSections.push(tempContent.substring(startIdx, endIdx));
                tempContent = tempContent.substring(endIdx);
              }
            } else {
              // Last section
              tempSections.push(tempContent.substring(startIdx));
            }
          }
        }
        
        sections = tempSections.filter(s => s.trim().length > 0);
      }
    }
    
    console.log(`Found ${sections.length} sections`);
    
    // If still no sections, try to parse the whole file as one section
    if (sections.length === 0 && content.includes("top -") && content.includes("PID USER")) {
      console.log("Treating entire file as one section");
      sections = [content];
    }
    
    const snapshots: TopSnapshot[] = [];
    
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i].trim();
      // Skip empty sections
      if (!section) continue;
      
      // Split section into lines
      const lines = section.split('\n').filter(line => line.trim().length > 0);
      
      if (lines.length < 7) {
        console.warn(`Section ${i} has insufficient data (only ${lines.length} lines)`);
        continue;
      }
      
      try {
        // Find timestamp line - first try ISO format
        let timestamp = "";
        let foundTimestamp = false;
        
        // Try to find a timestamp in the first few lines
        for (let j = 0; j < Math.min(3, lines.length); j++) {
          // Try different timestamp formats
          const isoMatch = lines[j].match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
          const dateTimeMatch = lines[j].match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
          
          if (isoMatch) {
            timestamp = isoMatch[1];
            foundTimestamp = true;
            break;
          } else if (dateTimeMatch) {
            // Convert to ISO format
            timestamp = dateTimeMatch[1].replace(' ', 'T');
            foundTimestamp = true;
            break;
          }
        }
        
        // If no timestamp found, create one from the section index and current time
        if (!foundTimestamp) {
          console.warn(`No timestamp found in section ${i}, creating artificial one`);
          const now = new Date();
          timestamp = new Date(now.getTime() + i * 1000).toISOString().split('.')[0];
        }
        
        // Find the top header line - contains "top -" and "load average"
        let topHeaderIndex = -1;
        for (let j = 0; j < Math.min(5, lines.length); j++) {
          if (lines[j].includes('top -')) {
            topHeaderIndex = j;
            break;
          }
        }
        
        // If top header not found, skip this section
        if (topHeaderIndex === -1) {
          console.warn(`Top header not found in section ${i}`);
          continue;
        }
        
        // Determine the lines for system info based on the top header position
        const topHeader = lines[topHeaderIndex];
        let tasksInfo = "";
        let cpuStats = "";
        let memoryStats = "";
        let swapStats = "";
        
        // Extract system info lines - they should follow the top header in order
        if (topHeaderIndex + 1 < lines.length) {
          tasksInfo = lines[topHeaderIndex + 1];
        }
        
        if (topHeaderIndex + 2 < lines.length) {
          cpuStats = lines[topHeaderIndex + 2];
        }
        
        if (topHeaderIndex + 3 < lines.length) {
          memoryStats = lines[topHeaderIndex + 3];
        }
        
        if (topHeaderIndex + 4 < lines.length) {
          swapStats = lines[topHeaderIndex + 4];
        }
        
        // Parse system info
        const systemInfo = {
          uptime: topHeader,
          load: topHeader.includes('load average') ? 
            topHeader.split('load average:')[1].trim() : 'N/A',
          tasks: tasksInfo,
          cpuStats: cpuStats,
          memoryStats: memoryStats,
          swapStats: swapStats
        };
        
        // Find the header line with PID USER PR NI etc.
        let processHeaderIndex = -1;
        for (let j = topHeaderIndex; j < Math.min(topHeaderIndex + 10, lines.length); j++) {
          if (lines[j].includes('PID') && lines[j].includes('USER') && 
              lines[j].includes('%CPU') && lines[j].includes('%MEM')) {
            processHeaderIndex = j;
            break;
          }
        }
        
        // If process header not found, skip this section
        if (processHeaderIndex === -1) {
          console.warn(`Process header not found in section ${i}`);
          continue;
        }
        
        // Process lines
        const processes: ProcessData[] = [];
        
        // Start from line after the process header
        for (let j = processHeaderIndex + 1; j < lines.length; j++) {
          const line = lines[j].trim();
          
          // Skip empty lines or lines that don't look like process data
          if (!line || line.startsWith('top -') || !line.match(/^\d+/)) continue;
          
          // Split process info by whitespace but handle multi-word commands
          const parts = line.trim().split(/\s+/);
          
          if (parts.length < 12) {
            console.warn(`Invalid process data at section ${i}, line ${j}: ${line}`);
            continue;
          }
          
          try {
            const pid = parseInt(parts[0], 10);
            const user = parts[1];
            const priority = parts[2];
            const nice = parts[3];
            const virtualMem = parts[4];
            const residentMem = parts[5];
            const sharedMem = parts[6];
            const status = parts[7];
            
            // Make sure CPU and MEM percentages are numeric
            let cpuPercentage = 0;
            let memPercentage = 0;
            
            try {
              cpuPercentage = parseFloat(parts[8].replace(',', '.'));
              memPercentage = parseFloat(parts[9].replace(',', '.'));
            } catch (e) {
              console.warn(`Error parsing CPU/MEM percentages: ${parts[8]}/${parts[9]}`);
            }
            
            const time = parts[10];
            
            // Command can contain spaces and is the rest of the line
            const command = parts.slice(11).join(' ');
            
            // Add process data
            processes.push({
              pid,
              user,
              priority,
              nice,
              virtualMem,
              residentMem,
              sharedMem,
              status,
              cpuPercentage: isNaN(cpuPercentage) ? 0 : cpuPercentage,
              memPercentage: isNaN(memPercentage) ? 0 : memPercentage,
              time,
              command
            });
          } catch (error) {
            console.warn(`Error parsing process data at section ${i}, line ${j}:`, error);
            continue;
          }
        }
        
        // Only add the snapshot if we found at least some processes
        if (processes.length > 0) {
          // Create snapshot
          snapshots.push({
            timestamp,
            systemInfo,
            processes
          });
        } else {
          console.warn(`No processes found in section ${i}`);
        }
        
      } catch (error) {
        console.error(`Error parsing section ${i}:`, error);
      }
    }
    
    console.log(`Successfully parsed ${snapshots.length} snapshots`);
    
    return { snapshots };
  } catch (error) {
    console.error("Error parsing OS top CPU data:", error);
    return { snapshots: [] };
  }
}

// Helper function to convert to standard ParsedTimeSeries for backward compatibility
export function convertTopSnapshotsToTimeSeries(snapshots: TopSnapshot[]): ParsedTimeSeries {
  const timestamps: string[] = snapshots.map(s => s.timestamp);
  const series: { [metric: string]: number[] } = {};
  
  // Add system metrics from the first snapshot's processes
  if (snapshots.length > 0 && snapshots[0].processes.length > 0) {
    const uniqueProcesses = new Map<string, Set<number>>();
    
    // First, identify all unique processes by command and PID
    snapshots.forEach(snapshot => {
      snapshot.processes.forEach(process => {
        const key = process.command;
        if (!uniqueProcesses.has(key)) {
          uniqueProcesses.set(key, new Set());
        }
        uniqueProcesses.get(key)!.add(process.pid);
      });
    });
    
    // Initialize series for CPU and Memory usage for each unique process
    uniqueProcesses.forEach((pidSet, command) => {
      pidSet.forEach(pid => {
        // Create a unique identifier for each process
        const idCPU = `CPU | ${command} (${pid})`;
        const idMEM = `MEM | ${command} (${pid})`;
        
        // Initialize with NaN arrays
        series[idCPU] = Array(timestamps.length).fill(NaN);
        series[idMEM] = Array(timestamps.length).fill(NaN);
      });
    });
    
    // Fill in data for each snapshot
    snapshots.forEach((snapshot, snapshotIndex) => {
      snapshot.processes.forEach(process => {
        const idCPU = `CPU | ${process.command} (${process.pid})`;
        const idMEM = `MEM | ${process.command} (${process.pid})`;
        
        if (series[idCPU]) {
          series[idCPU][snapshotIndex] = process.cpuPercentage;
        }
        
        if (series[idMEM]) {
          series[idMEM][snapshotIndex] = process.memPercentage;
        }
      });
    });
  }
  
  // Add system-wide metrics
  if (snapshots.length > 0) {
    // Extract CPU utilization from snapshots - average user, system, and idle
    const userCpu = Array(timestamps.length).fill(NaN);
    const systemCpu = Array(timestamps.length).fill(NaN);
    const idleCpu = Array(timestamps.length).fill(NaN);
    
    snapshots.forEach((snapshot, index) => {
      const cpuLine = snapshot.systemInfo.cpuStats;
      
      if (cpuLine.includes('%Cpu(s):')) {
        try {
          // Format: %Cpu(s): 19.7 us, 17.7 sy, 0.3 ni, 59.5 id, 2.6 wa, 0.0 hi, 0.3 si, 0.0 st
          const parts = cpuLine.split(':')[1].split(',');
          
          parts.forEach(part => {
            const trimmed = part.trim();
            
            if (trimmed.includes('us')) {
              userCpu[index] = parseFloat(trimmed.split(' ')[0]);
            } else if (trimmed.includes('sy')) {
              systemCpu[index] = parseFloat(trimmed.split(' ')[0]);
            } else if (trimmed.includes('id')) {
              idleCpu[index] = parseFloat(trimmed.split(' ')[0]);
            }
          });
        } catch (e) {
          console.warn(`Could not parse CPU line: ${cpuLine}`);
        }
      }
    });
    
    // Add to series
    series['System | CPU | User %'] = userCpu;
    series['System | CPU | System %'] = systemCpu;
    series['System | CPU | Idle %'] = idleCpu;
  }
  
  return { timestamps, series };
} 