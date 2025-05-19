import React, { useState, useEffect, useRef } from 'react';

// Move constant to top of file
const DATASTAX_COLORS = {
  primary: '#3A36DB', // DataStax blue
  secondary: '#FF5C35', // DataStax orange
};

interface TimeRangeSliderProps {
  timestamps: string[];
  onChange: (startIndex: number, endIndex: number) => void;
  selectedTimeRange: [number, number] | null;
  darkMode?: boolean;
}

type PresetRange = {
  label: string;
  getRange: (timestamps: string[]) => [number, number];
};

const validateTimestamps = (timestamps: string[]): boolean => {
  if (!timestamps || !Array.isArray(timestamps) || timestamps.length === 0) {
    return false;
  }
  
  // Sample a few timestamps to check validity
  const samplesToCheck = [
    0, // First timestamp
    Math.floor(timestamps.length / 2), // Middle timestamp
    timestamps.length - 1 // Last timestamp
  ].filter(idx => idx >= 0 && idx < timestamps.length);
  
  // Check if each sample timestamp is a valid date
  return samplesToCheck.every(idx => {
    try {
      const date = new Date(timestamps[idx]);
      return !isNaN(date.getTime());
    } catch (e) {
      console.error("Invalid timestamp:", timestamps[idx], e);
      return false;
    }
  });
};

export const TimeRangeSlider: React.FC<TimeRangeSliderProps> = ({
  timestamps,
  onChange,
  selectedTimeRange,
  darkMode = false,
}) => {
  const [startIndex, setStartIndex] = useState<number>(0);
  const [endIndex, setEndIndex] = useState<number>(timestamps.length - 1);
  const [displayFullDate, setDisplayFullDate] = useState(false);
  
  // Use refs for tracking dragging state
  const isDraggingRef = useRef<boolean>(false);
  const activeHandleRef = useRef<'start' | 'end' | null>(null);
  const sliderTrackRef = useRef<HTMLDivElement>(null);

  // Debug logging
  useEffect(() => {
    console.log("TimeRangeSlider mounted:", {
      timestampsLength: timestamps.length,
      selectedTimeRange,
      firstTimestamp: timestamps.length > 0 ? timestamps[0] : 'none',
      lastTimestamp: timestamps.length > 0 ? timestamps[timestamps.length - 1] : 'none',
      areTimestampsValid: validateTimestamps(timestamps)
    });
  }, [timestamps, selectedTimeRange]);

  // Update local state when selectedTimeRange from parent changes
  useEffect(() => {
    if (selectedTimeRange) {
      setStartIndex(selectedTimeRange[0]);
      setEndIndex(selectedTimeRange[1]);
    } else {
      setStartIndex(0);
      setEndIndex(timestamps.length - 1);
    }
  }, [selectedTimeRange, timestamps.length]);

  // Additional safety check for empty timestamps
  if (!timestamps || timestamps.length === 0 || !validateTimestamps(timestamps)) {
    console.warn("TimeRangeSlider received invalid timestamps", {
      count: timestamps?.length || 0,
      valid: validateTimestamps(timestamps)
    });
    return (
      <div style={{
        padding: '10px',
        backgroundColor: darkMode ? '#2a2a40' : '#f0f4f8',
        borderRadius: '8px',
        color: darkMode ? '#e1e1e1' : '#333',
      }}>
        <p>No valid timeline data available for the slider.</p>
        {timestamps && timestamps.length > 0 && (
          <div>
            <p>Sample timestamps appear to be invalid or not in date format:</p>
            <pre style={{ 
              backgroundColor: darkMode ? '#1e1e30' : '#f5f5f5', 
              padding: '8px', 
              fontSize: '12px',
              maxHeight: '100px',
              overflow: 'auto',
              borderRadius: '4px'
            }}>
              {JSON.stringify({
                first: timestamps[0],
                middle: timestamps[Math.floor(timestamps.length / 2)],
                last: timestamps[timestamps.length - 1]
              }, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  }

  // Ensure indices are valid
  const validStartIndex = Math.max(0, Math.min(startIndex, timestamps.length - 1));
  const validEndIndex = Math.max(validStartIndex, Math.min(endIndex, timestamps.length - 1));

  const presets: PresetRange[] = [
    {
      label: 'All',
      getRange: (timestamps) => [0, timestamps.length - 1]
    },
    {
      label: 'Last 25%',
      getRange: (timestamps) => [
        Math.floor(timestamps.length * 0.75),
        timestamps.length - 1
      ]
    },
    {
      label: 'Last 50%',
      getRange: (timestamps) => [
        Math.floor(timestamps.length * 0.5),
        timestamps.length - 1
      ]
    },
    {
      label: 'First 25%',
      getRange: (timestamps) => [
        0,
        Math.floor(timestamps.length * 0.25)
      ]
    },
    {
      label: 'First 50%',
      getRange: (timestamps) => [
        0,
        Math.floor(timestamps.length * 0.5)
      ]
    }
  ];

  const formatTimestamp = (timestamp: string, fullDate: boolean = false): string => {
    try {
      const date = new Date(timestamp);
      
      if (fullDate) {
        return date.toLocaleString([], {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
      } else {
        return date.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
      }
    } catch (e) {
      return timestamp;
    }
  };

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = parseInt(e.target.value, 10);
    // Ensure newStart is less than endIndex and within bounds
    if (newStart < validEndIndex && newStart >= 0 && newStart < timestamps.length) {
      setStartIndex(newStart);
      onChange(newStart, validEndIndex);
      console.log("Start time changed:", { newStart, end: validEndIndex });
    }
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEnd = parseInt(e.target.value, 10);
    // Ensure newEnd is greater than startIndex and within bounds
    if (newEnd > validStartIndex && newEnd >= 0 && newEnd < timestamps.length) {
      setEndIndex(newEnd);
      onChange(validStartIndex, newEnd);
      console.log("End time changed:", { start: validStartIndex, newEnd });
    }
  };

  // Simplified drag handling with refs
  const handleDragStart = (e: React.MouseEvent, handle: 'start' | 'end') => {
    e.preventDefault();
    activeHandleRef.current = handle;
    isDraggingRef.current = true;
    
    // Set up event listeners for move and up events
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    
    console.log(`Starting drag for ${handle} handle`);
  };
  
  const handleDragMove = (e: MouseEvent) => {
    if (!isDraggingRef.current || !activeHandleRef.current || !sliderTrackRef.current) return;
    
    // Get track dimensions
    const trackRect = sliderTrackRef.current.getBoundingClientRect();
    const trackWidth = trackRect.width;
    const trackLeft = trackRect.left;
    
    // Calculate position relative to track
    let position = Math.max(0, Math.min(e.clientX - trackLeft, trackWidth));
    let indexPosition = Math.round((position / trackWidth) * (timestamps.length - 1));
    
    // Update the appropriate handle
    if (activeHandleRef.current === 'start') {
      // Ensure start handle doesn't go past end handle
      indexPosition = Math.min(indexPosition, endIndex - 1);
      if (indexPosition !== startIndex && indexPosition >= 0) {
        setStartIndex(indexPosition);
        onChange(indexPosition, endIndex);
      }
    } else {
      // Ensure end handle doesn't go before start handle
      indexPosition = Math.max(indexPosition, startIndex + 1);
      if (indexPosition !== endIndex && indexPosition < timestamps.length) {
        setEndIndex(indexPosition);
        onChange(startIndex, indexPosition);
      }
    }
  };
  
  const handleDragEnd = () => {
    isDraggingRef.current = false;
    activeHandleRef.current = null;
    
    // Remove event listeners
    window.removeEventListener('mousemove', handleDragMove);
    window.removeEventListener('mouseup', handleDragEnd);
    
    console.log("Drag ended");
  };

  const applyPreset = (preset: PresetRange) => {
    const [presetStart, presetEnd] = preset.getRange(timestamps);
    setStartIndex(presetStart);
    setEndIndex(presetEnd);
    onChange(presetStart, presetEnd);
  };

  const toggleDateFormat = () => {
    setDisplayFullDate(!displayFullDate);
  };

  const startTime = formatTimestamp(timestamps[validStartIndex], displayFullDate);
  const endTime = formatTimestamp(timestamps[validEndIndex], displayFullDate);

  // Calculate the selected range duration
  let rangeDuration = '';
  try {
    const startDate = new Date(timestamps[validStartIndex]);
    const endDate = new Date(timestamps[validEndIndex]);
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    if (diffHrs > 0) {
      rangeDuration = `Duration: ${diffHrs}h ${diffMins}m ${diffSecs}s`;
    } else if (diffMins > 0) {
      rangeDuration = `Duration: ${diffMins}m ${diffSecs}s`;
    } else {
      rangeDuration = `Duration: ${diffSecs}s`;
    }
  } catch (e) {
    rangeDuration = '';
  }

  // Handle click on the track to set the closest handle
  const handleTrackClick = (e: React.MouseEvent) => {
    if (isDraggingRef.current) return; // Don't handle clicks during drag
    
    const trackRect = sliderTrackRef.current?.getBoundingClientRect();
    if (!trackRect) return;
    
    // Calculate position relative to track
    const position = Math.max(0, Math.min(e.clientX - trackRect.left, trackRect.width));
    const clickedIndex = Math.round((position / trackRect.width) * (timestamps.length - 1));
    
    // Determine which handle is closer to the click position
    const startDistance = Math.abs(clickedIndex - startIndex);
    const endDistance = Math.abs(clickedIndex - endIndex);
    
    if (startDistance <= endDistance) {
      // Move start handle if it's closer
      if (clickedIndex < endIndex) {
        setStartIndex(clickedIndex);
        onChange(clickedIndex, endIndex);
      }
    } else {
      // Move end handle if it's closer
      if (clickedIndex > startIndex) {
        setEndIndex(clickedIndex);
        onChange(startIndex, clickedIndex);
      }
    }
  };

  return (
    <div style={{
      padding: '10px 0',
      borderTop: `1px solid ${darkMode ? '#444' : '#eee'}`,
      marginBottom: '20px',
      position: 'relative',
      zIndex: 10,
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: '12px',
      }}>
        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '8px'
        }}>
          {presets.map((preset, index) => (
            <button
              key={index}
              onClick={() => applyPreset(preset)}
              style={{
                padding: '6px 12px',
                backgroundColor: darkMode ? '#444' : '#f0f0f0',
                color: darkMode ? '#e1e1e1' : '#333',
                border: `1px solid ${darkMode ? '#555' : '#ddd'}`,
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px',
          marginBottom: '8px'
        }}>
          <button
            onClick={toggleDateFormat}
            style={{
              padding: '6px 12px',
              backgroundColor: darkMode ? '#444' : '#f0f0f0',
              color: darkMode ? '#e1e1e1' : '#333',
              border: `1px solid ${darkMode ? '#555' : '#ddd'}`,
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            {displayFullDate ? 'Show Time Only' : 'Show Full Date'}
          </button>
        </div>
      </div>
      
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px',
        color: darkMode ? '#e1e1e1' : '#333',
        fontSize: '14px'
      }}>
        <div>Start: {startTime}</div>
        <div style={{ 
          backgroundColor: darkMode ? 'rgba(58, 54, 219, 0.1)' : 'rgba(58, 54, 219, 0.05)',
          padding: '4px 10px',
          borderRadius: '12px',
          border: `1px solid ${darkMode ? 'rgba(58, 54, 219, 0.2)' : 'rgba(58, 54, 219, 0.1)'}`,
          color: darkMode ? '#a9a7ff' : '#3A36DB',
          fontSize: '13px',
        }}>
          {rangeDuration}
        </div>
        <div>End: {endTime}</div>
      </div>
      
      <div style={{ 
        position: 'relative', 
        height: '50px', 
        marginBottom: '20px',
        touchAction: 'none',
      }}>
        {/* Track background with click handling */}
        <div 
          ref={sliderTrackRef}
          className="slider-track"
          onClick={handleTrackClick}
          style={{
            position: 'absolute',
            top: '18px',
            left: 0,
            right: 0,
            height: '10px',
            backgroundColor: darkMode ? '#444' : '#e0e0e0',
            borderRadius: '5px',
            zIndex: 1,
            cursor: 'pointer',
          }} 
        />
        
        {/* Colored fill to show selected range */}
        <div 
          style={{
            position: 'absolute',
            top: '18px',
            left: `${(startIndex / (timestamps.length - 1)) * 100}%`,
            right: `${100 - (endIndex / (timestamps.length - 1)) * 100}%`,
            height: '10px',
            backgroundColor: DATASTAX_COLORS.primary,
            borderRadius: '5px',
            zIndex: 2,
          }} 
        />
        
        {/* Start handle */}
        <div 
          className="start-handle"
          onMouseDown={(e) => handleDragStart(e, 'start')}
          style={{
            position: 'absolute',
            top: '8px',
            left: `calc(${(startIndex / (timestamps.length - 1)) * 100}% - 15px)`,
            width: '30px',
            height: '30px',
            zIndex: 20,
            cursor: isDraggingRef.current && activeHandleRef.current === 'start' ? 'grabbing' : 'grab',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            touchAction: 'none',
            userSelect: 'none',
          }}
        >
          <div 
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              backgroundColor: DATASTAX_COLORS.primary,
              border: `3px solid ${darkMode ? '#232333' : 'white'}`,
              boxShadow: '0 0 5px rgba(0, 0, 0, 0.5)',
              pointerEvents: 'none',
            }}
          />
        </div>
        
        {/* End handle */}
        <div 
          className="end-handle"
          onMouseDown={(e) => handleDragStart(e, 'end')}
          style={{
            position: 'absolute',
            top: '8px',
            left: `calc(${(endIndex / (timestamps.length - 1)) * 100}% - 15px)`,
            width: '30px',
            height: '30px',
            zIndex: 21,
            cursor: isDraggingRef.current && activeHandleRef.current === 'end' ? 'grabbing' : 'grab',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            touchAction: 'none',
            userSelect: 'none',
          }}
        >
          <div 
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              backgroundColor: DATASTAX_COLORS.primary,
              border: `3px solid ${darkMode ? '#232333' : 'white'}`,
              boxShadow: '0 0 5px rgba(0, 0, 0, 0.5)',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
      
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        color: darkMode ? '#999' : '#666',
        fontSize: '12px',
      }}>
        <div>{formatTimestamp(timestamps[0])}</div>
        <div>{formatTimestamp(timestamps[Math.floor(timestamps.length / 2)])}</div>
        <div>{formatTimestamp(timestamps[timestamps.length - 1])}</div>
      </div>
    </div>
  );
}; 