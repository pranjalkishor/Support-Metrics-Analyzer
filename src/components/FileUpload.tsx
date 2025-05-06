import React from "react";

type Props = {
  onFiles: (files: FileList) => void;
};

export const FileUpload: React.FC<Props> = ({ onFiles }) => (
  <div>
    <input
      type="file"
      multiple
      onChange={e => e.target.files && onFiles(e.target.files)}
      accept=".out,.txt"
    />
  </div>
);
