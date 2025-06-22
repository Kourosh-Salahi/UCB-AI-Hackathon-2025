import React, { useRef } from 'react';

interface FileUploadProps {
  onFileChange: (file: File) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileChange(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      <input
        type="file"
        accept="application/pdf"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
      />
      <button
        onClick={handleClick}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
      >
        Upload PDF
      </button>
    </div>
  );
};

export default FileUpload;
