import React, { useRef } from "react";
import "./FileUpload.css";

type Props = {
  onFiles: (files: FileList) => void;
  onFolderUpload: (files: File[]) => void;
};

// Add custom attributes to the HTMLInputElement
declare module 'react' {
  interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    // Add custom attributes
    directory?: string;
    webkitdirectory?: string;
  }
}

export const FileUpload: React.FC<Props> = ({ onFiles, onFolderUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  
  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      console.log(`Folder upload: ${filesArray.length} files selected`);
      
      // Log the first few files to help with debugging
      filesArray.slice(0, 5).forEach(file => {
        console.log(`- ${file.webkitRelativePath || file.name}`);
      });
      
      onFolderUpload(filesArray);
    }
  };
  
  const isDirectoryUploadSupported = () => {
    // Check if the directory attribute is supported
    const input = document.createElement('input');
    input.type = 'file';
    return 'webkitdirectory' in input || 'directory' in input;
  };
  
  return (
    <div className="file-upload-container">
      <div className="upload-options">
        <div className="upload-option">
          <h3>Upload Files</h3>
          <p>Select individual log files to analyze</p>
          <button 
            className="upload-button" 
            onClick={() => fileInputRef.current?.click()}
          >
            Choose Files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => e.target.files && onFiles(e.target.files)}
            accept=".out,.txt,.log,.output"
            style={{ display: 'none' }}
          />
        </div>
        
        {isDirectoryUploadSupported() && (
          <div className="upload-option">
            <h3>Upload Cluster Folder</h3>
            <p>Select a folder with node-specific log files</p>
            <p className="upload-hint">Expected structure: nodes/IP_of_node/logs/system.log</p>
            <button 
              className="upload-button folder-button" 
              onClick={() => folderInputRef.current?.click()}
            >
              Choose Folder
            </button>
            <input
              ref={folderInputRef}
              type="file"
              webkitdirectory=""
              directory=""
              multiple
              onChange={handleFolderUpload}
              style={{ display: 'none' }}
            />
          </div>
        )}
      </div>
      
      {!isDirectoryUploadSupported() && (
        <div className="compatibility-notice">
          Directory upload is not supported in your browser. Please use Chrome, Firefox, or Edge for this feature.
        </div>
      )}
    </div>
  );
};
