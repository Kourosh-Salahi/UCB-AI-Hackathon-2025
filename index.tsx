import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import pdfjsLib from 'pdfjs-dist'; // Import the default export which is the pdfjsLib object
// KaTeX CSS is now linked in index.html

// Set workerSrc for pdf.js
// Use a CDN version of the worker.
// pdfjsLib.version will be used to ensure the worker version matches the library version.
if (pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
} else {
  console.error("pdfjsLib.GlobalWorkerOptions is undefined. PDF.js worker might not be set correctly.");
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);