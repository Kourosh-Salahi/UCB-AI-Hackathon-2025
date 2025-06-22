import React, { useState, useRef, useEffect } from 'react';
import { Tool, Annotation, StrokeAnnotation, LatexAnnotation, PdfFile, SelectionRectangle, RenderedLatexAnnotation } from './types';
import { processWithAITutor, convertHandwritingToLatex } from './services/apiServices';
import { FloatingToolbox, FileUpload, LoadingSpinner, Modal, PdfAnnotator } from '../components';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import 'katex/dist/katex.min.css';

// Configure pdf.js worker
GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';

const App: React.FC = () => {
  // State declarations
  const [file, setFile] = useState<File | null>(null);
  const [pdf, setPdf] = useState<PdfFile | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Store annotations by page number
  const [annotationsByPage, setAnnotationsByPage] = useState<Record<number, Annotation[]>>({});
  
  const [selectedTool, setSelectedTool] = useState<Tool>(Tool.PEN);
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentSize, setCurrentSize] = useState(2);

  // Feedback modal state
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackContent, setFeedbackContent] = useState('');
  // Error modal state
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalContent, setErrorModalContent] = useState('');
  
  // Zoom level state
  const [zoomLevel, setZoomLevel] = useState(1.5);

  // PDF annotator ref to access its methods
  const pdfAnnotatorRef = useRef<{
    capturePageAsImage: () => Promise<string | null>;
    captureSelectionAsImage: (rectPageCoords: SelectionRectangle) => Promise<string | null>;
    getViewport: () => any | null;
  }>(null);

  // Function to format the feedback for display
  const formatFeedback = (feedback: string): React.ReactNode => {
    // Remove any XML/HTML looking tags that might have been included
    let cleanFeedback = feedback.replace(/<[^>]*>/g, '');
    
    // Remove LaTeX dollar signs but preserve the expression inside
    cleanFeedback = cleanFeedback.replace(/\$([^$]+)\$/g, '$1');
    
    // Check if feedback contains specific prefixes from our structured format
    if (cleanFeedback.includes('✅ Correct:')) {
      return (
        <div className="flex flex-col text-white">
          <span className="text-green-300 font-bold text-lg">✅ Correct:</span>
          <span className="text-gray-100">{cleanFeedback.split('✅ Correct:')[1].trim()}</span>
        </div>
      );
    } else if (cleanFeedback.includes('🛈 Hint:')) {
      return (
        <div className="flex flex-col text-white">
          <span className="text-blue-300 font-bold text-lg">🛈 Hint:</span>
          <span className="text-gray-100">{cleanFeedback.split('🛈 Hint:')[1].trim()}</span>
        </div>
      );
    } else if (cleanFeedback.includes('❌ Mistake detected:')) {
      return (
        <div className="flex flex-col text-white">
          <span className="text-red-300 font-bold text-lg">❌ Mistake detected:</span>
          <span className="text-gray-100">{cleanFeedback.split('❌ Mistake detected:')[1].trim()}</span>
        </div>
      );
    }
    
    // If no specific format is detected, clean up any potential formatting and return
    return (
      <div className="flex flex-col text-white">
        <span className="text-blue-300 font-bold text-lg">🤖 Feedback:</span>
        <span className="text-gray-100">{cleanFeedback.replace(/\*\*Diagnosis and Feedback\*\*/g, '').trim()}</span>
      </div>
    );
  };
  
  // PDF loading
  const handleFileSelected = async (selectedFile: File) => {
    setFile(selectedFile);
    await loadPdf(selectedFile);
  };

  const loadPdf = async (pdfFile: File) => {
    try {
      setLoading(true);
      setError(null);
      setAnnotationsByPage({}); // Clear annotations for new PDF
      setCurrentPage(1);

      const arrayBuffer = await pdfFile.arrayBuffer();
      const loadingTask = getDocument({ data: arrayBuffer });

      loadingTask.onProgress = (data: { loaded: number; total: number }) => {
        const percent = Math.round((data.loaded / data.total) * 100);
        setLoadingProgress(`Loading PDF: ${percent}%`);
      };

      const pdfDoc = await loadingTask.promise;
      
      setPdf({
        document: pdfDoc,
        file: pdfFile,
        totalPages: pdfDoc.numPages
      });
      // No need to render page here, PdfAnnotator will do it
    } catch (err) {
      console.error('Error loading PDF:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load PDF';
      setError(`Error loading PDF: ${errorMessage}`);
      setShowErrorModal(true);
      setErrorModalContent(`Error loading PDF: ${errorMessage}\n\nPlease try:\n1. Using a different PDF file\n2. Ensuring the file isn't corrupted\n3. Checking if the file is password protected`);
    } finally {
      setLoading(false);
      setLoadingProgress('');
    }
  };

  // Handle tool selection changes
  useEffect(() => {
    // Any tool-specific initialization can go here
  }, [selectedTool]);

  // Annotation handling
  const handleAddAnnotation = (annotation: Annotation) => {
    setAnnotationsByPage(prev => {
      const pageAnnotations = [...(prev[currentPage] || []), annotation];
      return {
        ...prev,
        [currentPage]: pageAnnotations
      };
    });
  };

  const handleUpdateAnnotation = (updatedAnnotation: Annotation) => {
    setAnnotationsByPage(prev => {
      const pageAnnotations = (prev[currentPage] || []).map(anno => 
        anno.id === updatedAnnotation.id ? updatedAnnotation : anno
      );
      return {
        ...prev,
        [currentPage]: pageAnnotations
      };
    });
  };

  const handleRemoveAnnotation = (annotationId: string) => {
    setAnnotationsByPage(prev => {
      const pageAnnotations = (prev[currentPage] || []).filter(
        anno => anno.id !== annotationId
      );
      return {
        ...prev,
        [currentPage]: pageAnnotations
      };
    });
  };

  const handleSelectionForLatex = async (selectionBoxPageCoords: SelectionRectangle) => {
    if (!pdfAnnotatorRef.current) return;
    
    try {
      setLoading(true);
      setLoadingProgress("Capturing selection...");
      const imageBase64WithPrefix = await pdfAnnotatorRef.current.captureSelectionAsImage(selectionBoxPageCoords);
      
      if (!imageBase64WithPrefix) throw new Error('Failed to capture selection image');
      const imageBase64 = imageBase64WithPrefix.split(',')[1];

      setLoadingProgress("Converting to LaTeX...");
      
      const latexResult = await convertHandwritingToLatex(imageBase64);
      
      if (latexResult) {
        setLoadingProgress("Creating annotation...");
        
        // First, filter out all stroke and existing LaTeX annotations within the selection area
        setAnnotationsByPage(prev => {
          const currentPageAnnotations = prev[currentPage] || [];
          
          // Keep only annotations that are not strokes within the selection box and not latex in the selection box
          const filteredAnnotations = currentPageAnnotations.filter(anno => {
            // Remove strokes (handwriting) within the selection box
            if (anno.type === 'stroke') {
              const strokeAnno = anno as StrokeAnnotation;
              // Check if any point of the stroke is within the selection
              const isInSelection = strokeAnno.points.some(point => 
                point.x >= selectionBoxPageCoords.x && 
                point.x <= selectionBoxPageCoords.x + selectionBoxPageCoords.width &&
                point.y >= selectionBoxPageCoords.y && 
                point.y <= selectionBoxPageCoords.y + selectionBoxPageCoords.height
              );
              return !isInSelection; // Keep if NOT in selection
            }
            
            // Also remove any existing LaTeX annotations in the same area to prevent duplicates
            if (anno.type === 'latex') {
              const latexAnno = anno as LatexAnnotation;
              const isInSelection = 
                latexAnno.x >= selectionBoxPageCoords.x && 
                latexAnno.x <= selectionBoxPageCoords.x + selectionBoxPageCoords.width &&
                latexAnno.y >= selectionBoxPageCoords.y && 
                latexAnno.y <= selectionBoxPageCoords.y + selectionBoxPageCoords.height;
              return !isInSelection; // Keep if NOT in selection
            }
            
            return true; // Keep all other annotation types
          });
          
          return {
            ...prev,
            [currentPage]: filteredAnnotations
          };
        });

        // After removing existing annotations, create and add the new LaTeX annotation
        setTimeout(() => {
          let cleanLatex = latexResult.replace(/\$/g, '').trim();
  
          // Create the new LaTeX annotation
          const newAnnotation: RenderedLatexAnnotation = {
            id: Date.now().toString(),
            type: 'latex',
            x: selectionBoxPageCoords.x,
            y: selectionBoxPageCoords.y,
            latex: cleanLatex,
            latexString: cleanLatex,
            color: currentColor
          };
          
          // Add the new LaTeX annotation
          setAnnotationsByPage(prev => ({
            ...prev,
            [currentPage]: [...(prev[currentPage] || []), newAnnotation]
          }));
        }, 10); // Small delay to ensure removal happens first
      } else {
        throw new Error('Failed to convert handwriting to LaTeX');
      }
    } catch (err) {
      console.error('Error converting to LaTeX:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      let friendlyError = "Failed to convert handwriting to LaTeX";
      
      if (errorMessage.includes("API key")) {
        friendlyError = "Missing API key. Please ensure your Gemini API key is set correctly.";
      } else if (errorMessage.includes("400") || errorMessage.includes("Base64")) {
        friendlyError = "Image capture failed or was invalid. Try selecting a clearer area of handwriting.";
      } else if (errorMessage.includes("429")) {
        friendlyError = "API rate limit exceeded. Please wait a few moments and try again.";
      }
      
      setError(`LaTeX conversion error: ${friendlyError}`);
      setShowErrorModal(true);
      setErrorModalContent(`Error converting handwriting to LaTeX: ${friendlyError}\n\nDetails: ${errorMessage}`);
    } finally {
      setLoading(false);
      setLoadingProgress("");
    }
  };

  // Page navigation
  const goToPreviousPage = () => {
    if (pdf && currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };
  const goToNextPage = () => {
    if (pdf && currentPage < pdf.totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };
  
  const handlePageChange = (pageNumber: number) => {
    if (pdf && pageNumber >= 1 && pageNumber <= pdf.totalPages) {
      setCurrentPage(pageNumber);
    }
  };
  
  // Function to handle AI tutor hint requests
  const handleGetTutoringHint = async (userQuestion?: string) => {
    if (!pdf || !pdfAnnotatorRef.current) return;
    
    try {
      setLoading(true);
      setLoadingProgress("Analyzing your work...");
      
      // Use active selection if available, otherwise capture the whole page
      let imageBase64;
      const activeSelections = document.querySelectorAll('.selection-active');
      
      if (activeSelections.length > 0) {
        // User has an active selection, capture just that area
        const selection = activeSelections[0].getBoundingClientRect();
        const viewport = pdfAnnotatorRef.current.getViewport();
        
        if (viewport) {
          // Convert screen coordinates to PDF coordinates
          const selectionRectangle = {
            x: selection.left,
            y: selection.top,
            width: selection.width,
            height: selection.height
          };
          
          setLoadingProgress("Capturing selected area...");
          const selectionImage = await pdfAnnotatorRef.current.captureSelectionAsImage(selectionRectangle);
          
          if (selectionImage) {
            imageBase64 = selectionImage.split(',')[1];
            setLoadingProgress("Processing selection...");
          } else {
            // Fallback to full page if selection capture fails
            const fullPageImage = await pdfAnnotatorRef.current.capturePageAsImage();
            imageBase64 = fullPageImage ? fullPageImage.split(',')[1] : '';
            setLoadingProgress("Processing full page...");
          }
        } else {
          // Fallback to full page if viewport not available
          const fullPageImage = await pdfAnnotatorRef.current.capturePageAsImage();
          imageBase64 = fullPageImage ? fullPageImage.split(',')[1] : '';
        }
      } else {
        // No selection, capture the whole page
        const fullPageImage = await pdfAnnotatorRef.current.capturePageAsImage();
        if (!fullPageImage) throw new Error('Failed to capture page image');
        imageBase64 = fullPageImage.split(',')[1];
      }

      // Enhance the context with metadata about the current document and state
      const enhancedContext = userQuestion || '';
      const contextMetadata = [
        `Document: ${pdf.file.name}`,
        `Page: ${currentPage} of ${pdf.totalPages}`,
        `Student question: ${userQuestion || 'Please analyze this work and provide feedback'}`
      ].join('\n');
      
      const combinedContext = enhancedContext 
        ? `${contextMetadata}\n\n${enhancedContext}` 
        : contextMetadata;
      
      setLoadingProgress("Getting AI feedback...");
      const response = await processWithAITutor(imageBase64, combinedContext);
      
      if (response) {
        setFeedbackContent(response);
        setShowFeedback(true);
      }
    } catch (err) {
      console.error('Error getting tutoring hint:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Error getting tutoring hint: ${errorMessage}`);
      setShowErrorModal(true);
      setErrorModalContent(`Error getting tutoring hint: ${errorMessage}`);
    } finally {
      setLoading(false);
      setLoadingProgress("");
    }
  };
  
  return (
    <div className="flex flex-col h-screen">      {/* Header with black bar */}
      <header className="bg-gray-900 text-white p-3 flex justify-between items-center">
        <h1 className="text-2xl font-bold mx-3">Tex Tutor</h1>
        <div className="flex items-center">
          <button className="p-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        </div>
      </header>
      
      <div className="flex-1 relative overflow-auto">
        {error && !showErrorModal && (
          <div className="absolute top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {!file && (
          <FileUpload onFileSelected={handleFileSelected} />
        )}
        
        {file && pdf && (
          <div className="relative w-full h-full flex justify-center">
            <div className="relative">
              <PdfAnnotator
                ref={pdfAnnotatorRef}
                pdfDoc={pdf.document}
                currentPageNum={currentPage}
                annotations={annotationsByPage[currentPage] || []}
                selectedTool={selectedTool}
                penColor={currentColor}
                penLineWidth={currentSize}
                textColor={currentColor}
                zoomLevel={zoomLevel}
                onAddAnnotation={handleAddAnnotation}
                onUpdateAnnotation={handleUpdateAnnotation}
                onRemoveAnnotation={handleRemoveAnnotation}
                onSelectionForLatex={handleSelectionForLatex}
                pdfFileName={pdf.file.name}
              />
            </div>
          </div>
        )}

        {loading && <LoadingSpinner message={loadingProgress || 'Loading...'} />}
        
        <Modal
          isOpen={showFeedback}
          onClose={() => setShowFeedback(false)}
          title="AI Tutor Feedback"
        >
          <div className="p-4">
            {formatFeedback(feedbackContent)}
          </div>
        </Modal>
        
        {/* Fixed page controls at the bottom of the screen */}
        {file && pdf && pdf.totalPages > 1 && (
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-white rounded-lg shadow-lg p-2 z-30">
            <button
              onClick={goToPreviousPage}
              disabled={currentPage <= 1}
              className="px-3 py-1 bg-blue-500 text-white rounded disabled:bg-gray-300"
            >
              Previous
            </button>
            <span>Page {currentPage} of {pdf.totalPages}</span>
            <button
              onClick={goToNextPage}
              disabled={currentPage >= pdf.totalPages}
              className="px-3 py-1 bg-blue-500 text-white rounded disabled:bg-gray-300"
            >
              Next
            </button>
          </div>
        )}
        
        <Modal
          isOpen={showErrorModal}
          onClose={() => setShowErrorModal(false)}
          title="Error"
        >
          <div className="p-4">
            <div className="text-red-300 space-y-3">
              <p className="font-semibold text-lg">{errorModalContent.split('\n\n')[0]}</p>
              {errorModalContent.includes('Details:') && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-gray-200">Troubleshooting tips:</p>
                  <ul className="list-disc pl-5 mt-1 text-sm text-gray-200">
                    <li>Make sure you have added your Gemini API key in the .env.local file</li>
                    <li>Try selecting a smaller, clearer area of handwriting</li>
                    <li>Check your internet connection</li>
                    <li>If you keep getting errors, try the pen tool to write instead</li>
                  </ul>
                  <details className="mt-3">
                    <summary className="text-sm text-gray-300 cursor-pointer">Technical Details</summary>
                    <p className="mt-1 text-xs text-gray-300 break-all">{errorModalContent.split('\n\n')[1]}</p>
                  </details>
                </div>
              )}
            </div>
          </div>
        </Modal>
        
        {/* Floating Toolbox */}
        <FloatingToolbox 
          selectedTool={selectedTool}
          onToolChange={setSelectedTool}
          penColor={currentColor}
          onPenColorChange={setCurrentColor}
          penLineWidth={currentSize}
          onPenLineWidthChange={setCurrentSize}
          onGetTutoringHint={handleGetTutoringHint}
          isDisabled={!pdf || loading}
          currentPage={currentPage}
          totalPages={pdf?.totalPages || 0}
          onPageChange={handlePageChange}
          zoomLevel={zoomLevel}
          onZoomChange={setZoomLevel}
        />
      </div>
    </div>
  );
};

export default App;
