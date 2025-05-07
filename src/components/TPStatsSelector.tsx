import React, { useState, useEffect, useRef } from "react";

type Props = {
  availableMetrics: string[];
  selectedMetrics: string[];
  onChange: (metrics: string[]) => void;
  darkMode: boolean;
};

export const TPStatsSelector: React.FC<Props> = ({
  availableMetrics,
  selectedMetrics,
  onChange,
  darkMode
}) => {
  // Create an enum for the section type
  enum SectionType {
    ThreadPool = "ThreadPool",
    MessageType = "MessageType",
    Meters = "Meters"
  }

  // State for section selection
  const [selectedSection, setSelectedSection] = useState<SectionType>(SectionType.ThreadPool);
  
  // Thread Pool states
  const [selectedThread, setSelectedThread] = useState<string>("");
  const [selectedTask, setSelectedTask] = useState<string>("");
  const [availableThreads, setAvailableThreads] = useState<string[]>([]);
  const [availableTasks, setAvailableTasks] = useState<string[]>([]);
  
  // Message Type states
  const [selectedMessageType, setSelectedMessageType] = useState<string>("");
  const [selectedMessageMetric, setSelectedMessageMetric] = useState<string>("Dropped");
  const [availableMessageTypes, setAvailableMessageTypes] = useState<string[]>([]);
  const [availableMessageMetrics, setAvailableMessageMetrics] = useState<string[]>(["Dropped"]);
  
  // Meters states
  const [selectedMeter, setSelectedMeter] = useState<string>("");
  const [selectedMeterMetric, setSelectedMeterMetric] = useState<string>("");
  const [availableMeters, setAvailableMeters] = useState<string[]>([]);
  const [availableMeterMetrics, setAvailableMeterMetrics] = useState<string[]>([]);
  
  // Flag to track which format is being used
  const [usingNewFormat, setUsingNewFormat] = useState(false);
  
  // Flag to prevent initial data load from resetting the section selection
  const isInitialMount = useRef(true);
  
  // Predefined task types that we're interested in
  const predefinedTasks = [
    "Active",
    "Pending",
    "Backpressure",
    "Delayed",
    "Shared",
    "Stolen",
    "Completed",
    "Blocked",
    "All time blocked"
  ];
  
  // Update selected metrics for Thread Pool
  const updateThreadPoolSelection = (thread: string, task: string) => {
    if (!thread || !task) {
      onChange([]);
      return;
    }
    
    let metricName: string;
    
    if (usingNewFormat) {
      metricName = `Pool | ${thread} | ${task}`;
    } else {
      metricName = `${thread} | ${task}`;
    }
    
    console.log("Selecting Thread Pool metric:", metricName);
    
    if (availableMetrics.includes(metricName)) {
      onChange([metricName]);
    } else {
      console.warn(`Metric "${metricName}" not found in available metrics`);
      onChange([]);
    }
  };
  
  // Update selected metrics for Message Type
  const updateMessageTypeSelection = (messageType: string, metric: string) => {
    if (!messageType || !metric) {
      onChange([]);
      return;
    }
    
    let metricName: string;
    
    if (usingNewFormat) {
      // Handle different metric formats
      if (metric.includes("Latency")) {
        const parts = metric.split(" | ");
        if (parts.length === 2) {
          // It's a latency percentile metric
          metricName = `Message | ${messageType} | Latency | ${parts[1]}`;
        } else {
          // Invalid format
          console.warn(`Invalid metric format: ${metric}`);
          onChange([]);
          return;
        }
      } else {
        // It's a simple metric like "Dropped"
        metricName = `Message | ${messageType} | ${metric}`;
      }
    } else {
      // Old format only supports Dropped
      metricName = `Message Type | ${messageType} | Dropped`;
    }
    
    console.log("Selecting Message Type metric:", metricName);
    
    if (availableMetrics.includes(metricName)) {
      onChange([metricName]);
    } else {
      console.warn(`Metric "${metricName}" not found in available metrics`);
      onChange([]);
    }
  };
  
  // Update selected metrics for Meters
  const updateMeterSelection = (meter: string, metricType: string) => {
    if (!meter || !metricType || !usingNewFormat) {
      onChange([]);
      return;
    }
    
    const metricName = `Meter | ${meter} | ${metricType}`;
    console.log("Selecting Meter metric:", metricName);
    
    if (availableMetrics.includes(metricName)) {
      onChange([metricName]);
    } else {
      console.warn(`Metric "${metricName}" not found in available metrics`);
      onChange([]);
    }
  };
  
  // Extract metrics based on type on component mount
  useEffect(() => {
    console.log("TPStats available metrics:", availableMetrics);
    
    // Check which format the data is using
    const hasPoolPrefix = availableMetrics.some(m => m.startsWith("Pool |"));
    const hasMessagePrefix = availableMetrics.some(m => m.startsWith("Message |"));
    const hasMeterPrefix = availableMetrics.some(m => m.startsWith("Meter |"));
    
    // Determine if we're using the new format
    const isNewFormat = (hasPoolPrefix || hasMessagePrefix || hasMeterPrefix);
    setUsingNewFormat(isNewFormat);
    
    console.log(`Using ${isNewFormat ? "new" : "old"} metric format`);
    
    // Separate different types of metrics
    let threadPoolMetrics: string[] = [];
    let messageTypeMetrics: string[] = [];
    let metersMetrics: string[] = [];
    
    if (isNewFormat) {
      threadPoolMetrics = availableMetrics.filter(m => m.startsWith("Pool |"));
      messageTypeMetrics = availableMetrics.filter(m => m.startsWith("Message |"));
      metersMetrics = availableMetrics.filter(m => m.startsWith("Meter |"));
    } else {
      threadPoolMetrics = availableMetrics.filter(m => !m.startsWith("Message Type"));
      messageTypeMetrics = availableMetrics.filter(m => m.startsWith("Message Type"));
      // Old format doesn't have meters
    }
    
    console.log(`Found ${threadPoolMetrics.length} Thread Pool metrics, ${messageTypeMetrics.length} Message Type metrics, and ${metersMetrics.length} Meters metrics`);
    
    // Only set initial section preference on first mount
    if (isInitialMount.current) {
      if (threadPoolMetrics.length > 0) {
        setSelectedSection(SectionType.ThreadPool);
      } else if (messageTypeMetrics.length > 0) {
        setSelectedSection(SectionType.MessageType);
      } else if (metersMetrics.length > 0) {
        setSelectedSection(SectionType.Meters);
      }
      isInitialMount.current = false;
    }
    
    // Process Thread Pool metrics
    const threadMap = new Map<string, Set<string>>();
    
    threadPoolMetrics.forEach(metric => {
      // Handle both metric formats
      const parts = metric.split(" | ");
      
      let thread: string, task: string;
      
      if (isNewFormat && parts.length === 3) {
        // New format: "Pool | ThreadPool | Task"
        thread = parts[1];
        task = parts[2];
      } else if (parts.length === 2) {
        // Old format: "ThreadPool | Task"
        thread = parts[0];
        task = parts[1];
      } else {
        // Invalid format
        return;
      }
      
      if (!threadMap.has(thread)) {
        threadMap.set(thread, new Set());
      }
      threadMap.get(thread)?.add(task);
    });
    
    // Get all available threads and sort alphabetically
    const threads = Array.from(threadMap.keys()).sort();
    setAvailableThreads(threads);
    
    // Set default selections for Thread Pool if available
    if (threads.length > 0) {
      const defaultThread = threads[0];
      setSelectedThread(defaultThread);
      
      // Get available tasks for the default thread
      const taskSet = threadMap.get(defaultThread) || new Set<string>();
      
      // Filter tasks to include only predefined ones that exist in the data
      const filteredTasks = predefinedTasks.filter(task => 
        taskSet.has(task)
      );
      
      setAvailableTasks(filteredTasks);
      
      if (filteredTasks.length > 0) {
        setSelectedTask(filteredTasks[0]);
        
        if (selectedSection === SectionType.ThreadPool) {
          // Initial selection: first thread and task
          updateThreadPoolSelection(defaultThread, filteredTasks[0]);
        }
      }
    }
    
    // Process Message Type metrics
    const messageTypes = new Set<string>();
    const messageMetrics = new Set<string>();
    
    messageTypeMetrics.forEach(metric => {
      const parts = metric.split(" | ");
      
      if ((isNewFormat && parts.length >= 3 && parts[0] === "Message") || 
          (!isNewFormat && parts.length === 3 && parts[0] === "Message Type")) {
        
        messageTypes.add(parts[1]); // Message type is the second part
        
        if (isNewFormat) {
          if (parts.length === 3) {
            // Handle simple metrics like Dropped
            messageMetrics.add(parts[2]);
          } else if (parts.length === 4 && parts[2] === "Latency") {
            // Handle latency percentile metrics
            messageMetrics.add(`Latency | ${parts[3]}`);
          }
        } else {
          // Old format only has Dropped
          messageMetrics.add("Dropped");
        }
      }
    });
    
    const messageTypesList = Array.from(messageTypes).sort();
    setAvailableMessageTypes(messageTypesList);
    
    const messageMetricsList = Array.from(messageMetrics).sort();
    setAvailableMessageMetrics(messageMetricsList);
    
    // Set default selection for Message Type if available
    if (messageTypesList.length > 0) {
      const defaultMessageType = messageTypesList[0];
      setSelectedMessageType(defaultMessageType);
      
      if (messageMetricsList.length > 0) {
        const defaultMetric = messageMetricsList[0];
        setSelectedMessageMetric(defaultMetric);
        
        if (selectedSection === SectionType.MessageType) {
          updateMessageTypeSelection(defaultMessageType, defaultMetric);
        }
      }
    }
    
    // Process Meters metrics (only for new format)
    if (isNewFormat) {
      const metersMap = new Map<string, Set<string>>();
      
      metersMetrics.forEach(metric => {
        // Metrics are formatted as "Meter | NAME | METRIC_TYPE"
        const parts = metric.split(" | ");
        if (parts.length === 3) {
          const meterName = parts[1];
          const metricType = parts[2];
          
          if (!metersMap.has(meterName)) {
            metersMap.set(meterName, new Set());
          }
          metersMap.get(meterName)?.add(metricType);
        }
      });
      
      const metersList = Array.from(metersMap.keys()).sort();
      setAvailableMeters(metersList);
      
      // Set default selections for Meters if available
      if (metersList.length > 0) {
        const defaultMeter = metersList[0];
        setSelectedMeter(defaultMeter);
        
        // Get available metric types for the default meter
        const metricSet = metersMap.get(defaultMeter) || new Set<string>();
        const metricsList = Array.from(metricSet).sort();
        setAvailableMeterMetrics(metricsList);
        
        if (metricsList.length > 0) {
          const defaultMetric = metricsList[0];
          setSelectedMeterMetric(defaultMetric);
          
          if (selectedSection === SectionType.Meters) {
            // Initial selection: first meter and metric type
            updateMeterSelection(defaultMeter, defaultMetric);
          }
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableMetrics]);
  
  // Update selected metrics after section change
  useEffect(() => {
    console.log("Section changed to:", selectedSection);
    
    // Update selected metrics based on section
    if (selectedSection === SectionType.ThreadPool) {
      if (selectedThread && selectedTask) {
        updateThreadPoolSelection(selectedThread, selectedTask);
      }
    } else if (selectedSection === SectionType.MessageType) {
      if (selectedMessageType && selectedMessageMetric) {
        updateMessageTypeSelection(selectedMessageType, selectedMessageMetric);
      }
    } else if (selectedSection === SectionType.Meters) {
      if (selectedMeter && selectedMeterMetric) {
        updateMeterSelection(selectedMeter, selectedMeterMetric);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSection]);
  
  // Update available tasks when thread selection changes
  useEffect(() => {
    if (!selectedThread) return;
    
    // Find all tasks associated with this thread
    const tasksForThread = new Set<string>();
    
    availableMetrics.forEach(metric => {
      const parts = metric.split(" | ");
      
      if (usingNewFormat) {
        if (parts.length === 3 && parts[0] === "Pool" && parts[1] === selectedThread) {
          tasksForThread.add(parts[2]);
        }
      } else {
        if (parts.length === 2 && parts[0] === selectedThread) {
          tasksForThread.add(parts[1]);
        }
      }
    });
    
    // Filter tasks to include only predefined ones that exist in the data
    const filteredTasks = predefinedTasks.filter(task => 
      tasksForThread.has(task)
    );
    
    console.log(`Available tasks for ${selectedThread}:`, Array.from(tasksForThread));
    console.log(`Filtered tasks for ${selectedThread}:`, filteredTasks);
    
    setAvailableTasks(filteredTasks);
    
    // If current task is no longer valid, select the first available one
    if (!tasksForThread.has(selectedTask) && filteredTasks.length > 0) {
      setSelectedTask(filteredTasks[0]);
      
      if (selectedSection === SectionType.ThreadPool) {
        updateThreadPoolSelection(selectedThread, filteredTasks[0]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThread, availableMetrics, selectedSection, usingNewFormat]);
  
  // Update available meter metrics when meter selection changes
  useEffect(() => {
    if (!selectedMeter || !usingNewFormat) return;
    
    // Find all metric types associated with this meter
    const metricsForMeter = new Set<string>();
    
    availableMetrics.forEach(metric => {
      const parts = metric.split(" | ");
      if (parts.length === 3 && parts[0] === "Meter" && parts[1] === selectedMeter) {
        metricsForMeter.add(parts[2]);
      }
    });
    
    const metricsList = Array.from(metricsForMeter).sort();
    console.log(`Available metrics for ${selectedMeter}:`, metricsList);
    
    setAvailableMeterMetrics(metricsList);
    
    // If current metric is no longer valid, select the first available one
    if (!metricsForMeter.has(selectedMeterMetric) && metricsList.length > 0) {
      setSelectedMeterMetric(metricsList[0]);
      
      if (selectedSection === SectionType.Meters) {
        updateMeterSelection(selectedMeter, metricsList[0]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMeter, availableMetrics, selectedSection, usingNewFormat]);
  
  // Handle section change
  const handleSectionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newSection = event.target.value as SectionType;
    console.log("User changed section to:", newSection);
    setSelectedSection(newSection);
  };
  
  // Handle thread selection
  const handleThreadChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const thread = event.target.value;
    setSelectedThread(thread);
    
    // Find tasks available for this thread and select the first one
    const tasksForThread = new Set<string>();
    availableMetrics.forEach(metric => {
      const parts = metric.split(" | ");
      
      if (usingNewFormat) {
        if (parts.length === 3 && parts[0] === "Pool" && parts[1] === thread) {
          tasksForThread.add(parts[2]);
        }
      } else {
        if (parts.length === 2 && parts[0] === thread) {
          tasksForThread.add(parts[1]);
        }
      }
    });
    
    // Filter to only include predefined tasks
    const filteredTasks = predefinedTasks.filter(task => 
      tasksForThread.has(task)
    );
    
    if (filteredTasks.length > 0) {
      const firstTask = filteredTasks[0];
      setSelectedTask(firstTask);
      
      // Update the selected metric immediately
      updateThreadPoolSelection(thread, firstTask);
    } else {
      // No tasks available for this thread
      setSelectedTask("");
      onChange([]);
    }
  };
  
  // Handle task selection
  const handleTaskChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const task = event.target.value;
    setSelectedTask(task);
    
    // Always update the selected metric when task changes
    if (selectedThread && task) {
      updateThreadPoolSelection(selectedThread, task);
    } else {
      onChange([]);
    }
  };
  
  // Handle message type selection
  const handleMessageTypeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const messageType = event.target.value;
    setSelectedMessageType(messageType);
    
    // Update the selected metric immediately
    updateMessageTypeSelection(messageType, selectedMessageMetric);
  };
  
  // Handle message metric selection
  const handleMessageMetricChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const metric = event.target.value;
    setSelectedMessageMetric(metric);
    
    // Update the selected metric immediately
    updateMessageTypeSelection(selectedMessageType, metric);
  };
  
  // Handle meter selection
  const handleMeterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const meter = event.target.value;
    setSelectedMeter(meter);
    
    // Find metrics available for this meter and select the first one
    const metricsForMeter = new Set<string>();
    availableMetrics.forEach(metric => {
      const parts = metric.split(" | ");
      if (parts.length === 3 && parts[0] === "Meter" && parts[1] === meter) {
        metricsForMeter.add(parts[2]);
      }
    });
    
    const metricsList = Array.from(metricsForMeter).sort();
    
    if (metricsList.length > 0) {
      const firstMetric = metricsList[0];
      setSelectedMeterMetric(firstMetric);
      
      // Update the selected metric immediately
      updateMeterSelection(meter, firstMetric);
    } else {
      // No metrics available for this meter
      setSelectedMeterMetric("");
      onChange([]);
    }
  };
  
  // Handle meter metric selection
  const handleMeterMetricChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const metric = event.target.value;
    setSelectedMeterMetric(metric);
    
    // Always update the selected metric when metric changes
    if (selectedMeter && metric) {
      updateMeterSelection(selectedMeter, metric);
    } else {
      onChange([]);
    }
  };
  
  return (
    <div style={{
      backgroundColor: darkMode ? "#232333" : "#f5f5f5",
      borderRadius: "8px",
      padding: "20px",
      marginBottom: "20px"
    }}>
      <h3 style={{
        margin: "0 0 15px 0",
        color: darkMode ? "#e1e1e1" : "#333"
      }}>
        Thread Performance Metrics
      </h3>
      
      {/* Section selector */}
      <div style={{ marginBottom: "20px" }}>
        <label 
          htmlFor="section-dropdown" 
          style={{ 
            display: "block", 
            marginBottom: "8px",
            color: darkMode ? "#e1e1e1" : "#333",
            fontWeight: "bold"
          }}
        >
          Metric Type
        </label>
        <select
          id="section-dropdown"
          value={selectedSection}
          onChange={handleSectionChange}
          style={{
            width: "100%",
            padding: "8px",
            backgroundColor: darkMode ? "#1e1e30" : "#fff",
            color: darkMode ? "#e1e1e1" : "#333",
            border: `1px solid ${darkMode ? "#444" : "#ddd"}`,
            borderRadius: "4px",
            height: "40px"
          }}
        >
          <option value={SectionType.ThreadPool}>Thread Pools</option>
          <option value={SectionType.MessageType}>Message Types</option>
          {usingNewFormat && <option value={SectionType.Meters}>Meters</option>}
        </select>
      </div>
      
      {/* Thread Pool selectors */}
      {selectedSection === SectionType.ThreadPool && (
        <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
          <div style={{ flex: 1 }}>
            <label 
              htmlFor="thread-dropdown" 
              style={{ 
                display: "block", 
                marginBottom: "8px",
                color: darkMode ? "#e1e1e1" : "#333"
              }}
            >
              Thread
            </label>
            <select
              id="thread-dropdown"
              value={selectedThread}
              onChange={handleThreadChange}
              style={{
                width: "100%",
                padding: "8px",
                backgroundColor: darkMode ? "#1e1e30" : "#fff",
                color: darkMode ? "#e1e1e1" : "#333",
                border: `1px solid ${darkMode ? "#444" : "#ddd"}`,
                borderRadius: "4px",
                height: "40px"
              }}
            >
              <option value="">Select Thread</option>
              {availableThreads.map(thread => (
                <option key={thread} value={thread}>
                  {thread}
                </option>
              ))}
            </select>
            {availableThreads.length === 0 && (
              <div style={{ marginTop: "8px", color: darkMode ? "#ff9999" : "#d32f2f" }}>
                No thread pools found in data
              </div>
            )}
          </div>
          
          <div style={{ flex: 1 }}>
            <label 
              htmlFor="task-dropdown" 
              style={{ 
                display: "block", 
                marginBottom: "8px",
                color: darkMode ? "#e1e1e1" : "#333"
              }}
            >
              Tasks
            </label>
            <select
              id="task-dropdown"
              value={selectedTask}
              onChange={handleTaskChange}
              style={{
                width: "100%",
                padding: "8px",
                backgroundColor: darkMode ? "#1e1e30" : "#fff",
                color: darkMode ? "#e1e1e1" : "#333",
                border: `1px solid ${darkMode ? "#444" : "#ddd"}`,
                borderRadius: "4px",
                height: "40px"
              }}
              disabled={!selectedThread}
            >
              <option value="">Select Task</option>
              {availableTasks.map(task => (
                <option key={task} value={task}>
                  {task}
                </option>
              ))}
            </select>
            {selectedThread && availableTasks.length === 0 && (
              <div style={{ marginTop: "8px", color: darkMode ? "#ff9999" : "#d32f2f" }}>
                No tasks found for selected thread
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Message Type selector */}
      {selectedSection === SectionType.MessageType && (
        <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
          <div style={{ flex: 1 }}>
            <label 
              htmlFor="message-type-dropdown" 
              style={{ 
                display: "block", 
                marginBottom: "8px",
                color: darkMode ? "#e1e1e1" : "#333"
              }}
            >
              Message Type
            </label>
            <select
              id="message-type-dropdown"
              value={selectedMessageType}
              onChange={handleMessageTypeChange}
              style={{
                width: "100%",
                padding: "8px",
                backgroundColor: darkMode ? "#1e1e30" : "#fff",
                color: darkMode ? "#e1e1e1" : "#333",
                border: `1px solid ${darkMode ? "#444" : "#ddd"}`,
                borderRadius: "4px",
                height: "40px"
              }}
            >
              <option value="">Select Message Type</option>
              {availableMessageTypes.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            {availableMessageTypes.length === 0 && (
              <div style={{ marginTop: "8px", color: darkMode ? "#ff9999" : "#d32f2f" }}>
                No message types found in data
              </div>
            )}
          </div>
          
          {usingNewFormat && (
            <div style={{ flex: 1 }}>
              <label 
                htmlFor="message-metric-dropdown" 
                style={{ 
                  display: "block", 
                  marginBottom: "8px",
                  color: darkMode ? "#e1e1e1" : "#333"
                }}
              >
                Metric
              </label>
              <select
                id="message-metric-dropdown"
                value={selectedMessageMetric}
                onChange={handleMessageMetricChange}
                style={{
                  width: "100%",
                  padding: "8px",
                  backgroundColor: darkMode ? "#1e1e30" : "#fff",
                  color: darkMode ? "#e1e1e1" : "#333",
                  border: `1px solid ${darkMode ? "#444" : "#ddd"}`,
                  borderRadius: "4px",
                  height: "40px"
                }}
                disabled={!selectedMessageType}
              >
                <option value="">Select Metric</option>
                {availableMessageMetrics.map(metric => (
                  <option key={metric} value={metric}>
                    {metric}
                  </option>
                ))}
              </select>
              {selectedMessageType && availableMessageMetrics.length === 0 && (
                <div style={{ marginTop: "8px", color: darkMode ? "#ff9999" : "#d32f2f" }}>
                  No metrics found for selected message type
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Meters selector - only shown if using new format */}
      {selectedSection === SectionType.Meters && usingNewFormat && (
        <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
          <div style={{ flex: 1 }}>
            <label 
              htmlFor="meter-dropdown" 
              style={{ 
                display: "block", 
                marginBottom: "8px",
                color: darkMode ? "#e1e1e1" : "#333"
              }}
            >
              Meter
            </label>
            <select
              id="meter-dropdown"
              value={selectedMeter}
              onChange={handleMeterChange}
              style={{
                width: "100%",
                padding: "8px",
                backgroundColor: darkMode ? "#1e1e30" : "#fff",
                color: darkMode ? "#e1e1e1" : "#333",
                border: `1px solid ${darkMode ? "#444" : "#ddd"}`,
                borderRadius: "4px",
                height: "40px"
              }}
            >
              <option value="">Select Meter</option>
              {availableMeters.map(meter => (
                <option key={meter} value={meter}>
                  {meter}
                </option>
              ))}
            </select>
            {availableMeters.length === 0 && (
              <div style={{ marginTop: "8px", color: darkMode ? "#ff9999" : "#d32f2f" }}>
                No meters found in data
              </div>
            )}
          </div>
          
          <div style={{ flex: 1 }}>
            <label 
              htmlFor="meter-metric-dropdown" 
              style={{ 
                display: "block", 
                marginBottom: "8px",
                color: darkMode ? "#e1e1e1" : "#333"
              }}
            >
              Metric
            </label>
            <select
              id="meter-metric-dropdown"
              value={selectedMeterMetric}
              onChange={handleMeterMetricChange}
              style={{
                width: "100%",
                padding: "8px",
                backgroundColor: darkMode ? "#1e1e30" : "#fff",
                color: darkMode ? "#e1e1e1" : "#333",
                border: `1px solid ${darkMode ? "#444" : "#ddd"}`,
                borderRadius: "4px",
                height: "40px"
              }}
              disabled={!selectedMeter}
            >
              <option value="">Select Metric</option>
              {availableMeterMetrics.map(metric => (
                <option key={metric} value={metric}>
                  {metric}
                </option>
              ))}
            </select>
            {selectedMeter && availableMeterMetrics.length === 0 && (
              <div style={{ marginTop: "8px", color: darkMode ? "#ff9999" : "#d32f2f" }}>
                No metrics found for selected meter
              </div>
            )}
          </div>
        </div>
      )}
      
      {selectedMetrics.length > 0 && (
        <div style={{
          marginTop: "20px",
          padding: "15px",
          backgroundColor: darkMode ? "#1e1e30" : "#f0f0f0",
          borderRadius: "4px",
          color: darkMode ? "#e1e1e1" : "#333"
        }}>
          <p style={{ margin: "0 0 10px 0", fontWeight: "bold" }}>Selected Metric:</p>
          <div style={{ 
            display: "flex", 
            flexWrap: "wrap", 
            gap: "8px"
          }}>
            {selectedMetrics.map(metric => (
              <div key={metric} style={{
                padding: "4px 8px",
                backgroundColor: darkMode ? "#3A36DB" : "#e1f5fe",
                color: darkMode ? "#fff" : "#0277bd",
                borderRadius: "4px",
                fontSize: "14px"
              }}>
                {metric}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}; 