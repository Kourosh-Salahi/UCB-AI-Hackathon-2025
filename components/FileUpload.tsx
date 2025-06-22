import React, { useRef } from 'react';

interface FileUploadProps {
  onFileSelected: (file: File) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelected }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelected(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <input
        type="file"
        accept="application/pdf"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
      />
      <p className="mb-4 text-gray-600 text-lg">Upload a PDF to get started</p>
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
