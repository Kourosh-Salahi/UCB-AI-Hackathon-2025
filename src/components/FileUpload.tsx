import React from 'react';

interface FileUploadProps {
  onFileSelected: (file: File) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelected }) => {
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const files = event.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
      onFileSelected(files[0]);
    }
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0 && files[0].type === 'application/pdf') {
      onFileSelected(files[0]);
    }
  };

  return (
    <div
      className="flex flex-col items-center justify-center w-full h-full p-8 border-2 border-dashed border-gray-300 bg-gray-50"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-4">Upload PDF</h2>
        <p className="text-gray-600 mb-4">Drag and drop a PDF file here, or click to select</p>
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileInput}
          className="hidden"
          id="fileInput"
        />
        <label
          htmlFor="fileInput"
          className="inline-block px-4 py-2 bg-blue-500 text-white rounded cursor-pointer hover:bg-blue-600"
        >
          Select PDF
        </label>
      </div>
    </div>
  );
};

export default FileUpload;
