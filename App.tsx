import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Tool, AnnotationsMap, PdfFile, Annotation, TextAnnotation, Point, SelectionRectangle } from './types';
import { DEFAULT_PEN_COLOR, DEFAULT_PEN_LINE_WIDTH, DEFAULT_TEXT_COLOR, DEFAULT_LATEX_COLOR, ZOOM_LEVELS, DEFAULT_ZOOM_INDEX, GEMINI_MODEL_TEXT_IMAGE_INPUT, DEFAULT_TEXT_FONT_SIZE_PDF_POINTS } from './constants';
import PdfAnnotator from './components/PdfAnnotator';
import Toolbar from './components/Toolbar';
import FileUpload from './components/FileUpload';
import LoadingSpinner from './components/LoadingSpinner';
import Modal from './components/Modal';
import { generateLatexFromImage, getTutoringHint } from './services/geminiService';
import pdfjsDist from 'pdfjs-dist'; // Use default import
import type { PDFDocumentProxy, PageViewport } from 'pdfjs-dist'; // Type imports can remain named


// Helper to generate unique IDs
const generateId = (): string => Math.random().toString(36).substr(2, 9);

const App: React.FC = () => {
  const [pdfFile, setPdfFile] = useState<PdfFile | null>(null);
  const [currentPageNum, setCurrentPageNum] = useState<number>(1);
  const [annotationsMap, setAnnotationsMap] = useState<AnnotationsMap>({});
  const [selectedTool, setSelectedTool] = useState<Tool>(Tool.PEN);
  const [penColor, setPenColor] = useState<string>(DEFAULT_PEN_COLOR);
  const [penLineWidth, setPenLineWidth] = useState<number>(DEFAULT_PEN_LINE_WIDTH);
  const [textColor, setTextColor] = useState<string>(DEFAULT_TEXT_COLOR); // For new text annotations
  const [zoomLevel, setZoomLevel] = useState<number>(ZOOM_LEVELS[DEFAULT_ZOOM_INDEX]);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [llmResponse, setLlmResponse] = useState<string | null>(null);

  const pdfAnnotatorRef = useRef<{ 
    capturePageAsImage: () => Promise<string | null>; 
    captureSelectionAsImage: (rect: SelectionRectangle) => Promise<string | null>;
    getViewport: () => PageViewport | null;
  }>(null);

  const handleFileChange = async (file: File) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const url = URL.createObjectURL(file);
      // Use getDocument via the default imported object
      if (!pdfjsDist || !pdfjsDist.getDocument) {
        console.error("pdfjsDist.getDocument is not available. Check PDF.js import.", pdfjsDist);
        throw new Error("PDF library not loaded correctly.");
      }
      const loadingTask = pdfjsDist.getDocument(url);
      const pdfDoc: PDFDocumentProxy = await loadingTask.promise;
      setPdfFile({ name: file.name, url, numPages: pdfDoc.numPages, pdfDoc });
      setCurrentPageNum(1);
      setAnnotationsMap({});
      setZoomLevel(ZOOM_LEVELS[DEFAULT_ZOOM_INDEX]);
    } catch (error) {
      console.error("Error loading PDF:", error);
      setErrorMessage("Failed to load PDF. Please ensure it's a valid PDF file.");
      setPdfFile(null);
    } finally {
      setIsLoading(false);
    }
  };

  const addAnnotation = useCallback((annotation: Annotation) => {
    setAnnotationsMap(prev => {
      const pageAnnotations = prev[currentPageNum] ? [...prev[currentPageNum]] : [];
      // If it's a text annotation being finished, remove the temporary editing one
      if (annotation.type === 'text' && !annotation.editing) {
        const existingEditing = pageAnnotations.findIndex(a => a.id === annotation.id && a.type === 'text' && (a as TextAnnotation).editing);
        if (existingEditing !== -1) {
          pageAnnotations.splice(existingEditing, 1);
        }
      }
      pageAnnotations.push(annotation);
      return { ...prev, [currentPageNum]: pageAnnotations };
    });
  }, [currentPageNum]);

  const updateAnnotation = useCallback((updatedAnnotation: Annotation) => {
    setAnnotationsMap(prev => {
      const pageAnnotations = prev[currentPageNum] ? [...prev[currentPageNum]] : [];
      const index = pageAnnotations.findIndex(a => a.id === updatedAnnotation.id);
      if (index !== -1) {
        const newPageAnnotations = [...pageAnnotations];
        newPageAnnotations[index] = updatedAnnotation;
        return { ...prev, [currentPageNum]: newPageAnnotations };
      }
      return prev;
    });
  }, [currentPageNum]);
  
  const removeAnnotation = useCallback((annotationId: string) => {
    setAnnotationsMap(prev => {
        const pageAnnotations = prev[currentPageNum] ? [...prev[currentPageNum]] : [];
        const newPageAnnotations = pageAnnotations.filter(a => a.id !== annotationId);
        return { ...prev, [currentPageNum]: newPageAnnotations };
    });
  }, [currentPageNum]);


  const handleSelectionForLatex = async (selectionBoxPageCoords: SelectionRectangle) => {
    if (!pdfAnnotatorRef.current) {
      setErrorMessage("PDF Annotator component not ready.");
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const imageDataUrl = await pdfAnnotatorRef.current.captureSelectionAsImage(selectionBoxPageCoords);
      if (!imageDataUrl) {
        setErrorMessage("Could not capture selection as image.");
        setIsLoading(false);
        return;
      }
      
      const base64Image = imageDataUrl.split(',')[1];
      const latexString = await generateLatexFromImage(base64Image);

      if (latexString) {
        const newLatexAnnotation: Annotation = {
          id: generateId(),
          type: 'latex',
          x: selectionBoxPageCoords.x,
          y: selectionBoxPageCoords.y,
          latexString: latexString,
          color: DEFAULT_LATEX_COLOR,
        };
        addAnnotation(newLatexAnnotation);
        // Optional: Remove original strokes within selectionBox (more complex)
      } else {
        setErrorMessage("Failed to convert handwriting to LaTeX. Gemini might not have recognized it, or there was an API error.");
      }
    } catch (error: any) {
      console.error("Error converting to LaTeX:", error);
      setErrorMessage(error.message || "An unknown error occurred during LaTeX conversion.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetTutoringHint = async (userQuestion?: string) => {
    if (!pdfFile || !pdfAnnotatorRef.current) {
      setErrorMessage("Please load a PDF and ensure the annotator is ready.");
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    setLlmResponse(null);

    try {
      // Capture the current page (PDF content + annotations) as an image
      const pageImageDataUrl = await pdfAnnotatorRef.current.capturePageAsImage();
      if (!pageImageDataUrl) {
        setErrorMessage("Could not capture page content for context.");
        setIsLoading(false);
        return;
      }
      const pageImageBase64 = pageImageDataUrl.split(',')[1];
      
      // Get text annotations for the current page
      const currentTextAnnotations = (annotationsMap[currentPageNum] || [])
        .filter(ann => ann.type === 'text')
        .map(ann => (ann as TextAnnotation).text)
        .join('\n');

      const hint = await getTutoringHint(pageImageBase64, currentTextAnnotations, userQuestion);
      setLlmResponse(hint);

    } catch (error: any) {
      console.error("Error getting tutoring hint:", error);
      setErrorMessage(error.message || "An unknown error occurred while fetching hint.");
    } finally {
      setIsLoading(false);
    }
  };

  const clearLlmResponse = () => setLlmResponse(null);

  const currentAnnotations = annotationsMap[currentPageNum] || [];

  return (
    <div className="flex flex-col h-screen bg-gray-800 text-white">
      <header className="bg-gray-900 p-3 shadow-md flex items-center justify-between print:hidden">
        <h1 className="text-xl font-semibold">PDF Markup & AI Tutor</h1>
        <div className="flex items-center space-x-2">
          <FileUpload onFileChange={handleFileChange} />
          {pdfFile && <span className="text-sm">{pdfFile.name}</span>}
        </div>
      </header>

      {isLoading && <LoadingSpinner message="Processing..." />}
      {errorMessage && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-500 text-white p-4 rounded-md shadow-lg z-50">
          <p>{errorMessage}</p>
          <button onClick={() => setErrorMessage(null)} className="mt-2 text-sm underline">Dismiss</button>
        </div>
      )}
      {llmResponse && (
        <Modal title="AI Tutor Hint" onClose={clearLlmResponse}>
          <div className="whitespace-pre-wrap p-4 bg-gray-700 rounded max-h-[60vh] overflow-y-auto text-sm">{llmResponse}</div>
        </Modal>
      )}

      <div className="flex flex-1 overflow-hidden">
        <Toolbar
          selectedTool={selectedTool}
          onToolChange={setSelectedTool}
          penColor={penColor}
          onPenColorChange={setPenColor}
          penLineWidth={penLineWidth}
          onPenLineWidthChange={setPenLineWidth}
          onGetTutoringHint={handleGetTutoringHint}
          isDisabled={!pdfFile || isLoading}
          currentPage={currentPageNum}
          totalPages={pdfFile?.numPages || 0}
          onPageChange={setCurrentPageNum}
          zoomLevel={zoomLevel}
          onZoomChange={setZoomLevel}
        />
        <main className="flex-1 bg-gray-700 overflow-auto p-4 flex justify-center items-start">
          {pdfFile && pdfFile.pdfDoc ? (
            <PdfAnnotator
              ref={pdfAnnotatorRef}
              pdfDoc={pdfFile.pdfDoc}
              currentPageNum={currentPageNum}
              annotations={currentAnnotations}
              selectedTool={selectedTool}
              penColor={penColor}
              penLineWidth={penLineWidth}
              textColor={textColor} // Pass current text color for new text annotations
              zoomLevel={zoomLevel}
              onAddAnnotation={addAnnotation}
              onUpdateAnnotation={updateAnnotation}
              onRemoveAnnotation={removeAnnotation} // Pass removeAnnotation
              onSelectionForLatex={handleSelectionForLatex}
              pdfFileName={pdfFile.name}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-24 h-24 mb-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              <p className="text-lg">Upload a PDF to get started</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;