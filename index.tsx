import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import pdfjsDist from 'pdfjs-dist'; // Use default import

// Set workerSrc for pdf.js
const PDF_JS_VERSION = "3.11.174"; 

// Access GlobalWorkerOptions via the default imported object
// pdfjs-dist from esm.sh might put GlobalWorkerOptions on the default export object
if (pdfjsDist && pdfjsDist.GlobalWorkerOptions) {
  pdfjsDist.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_JS_VERSION}/pdf.worker.min.js`;
} else {
  console.error("pdfjsDist.GlobalWorkerOptions from pdfjs-dist is undefined. PDF.js worker might not be set correctly. Check the structure of the imported pdfjsDist object.", pdfjsDist);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  // Fallback if the div isn't there, though index.html should provide it.
  const appRoot = document.createElement('div');
  appRoot.id = 'root';
  document.body.appendChild(appRoot);
  // throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(document.getElementById('root')!); // Use non-null assertion if confident
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);