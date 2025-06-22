import React, { useState, useRef, useEffect } from 'react';
import { Tool, Point, Annotation, StrokeAnnotation, TextAnnotation, LatexAnnotation, PdfFile } from './types';
import { processWithAITutor, convertHandwritingToLatex } from './services/apiServices';
import { Toolbar, FileUpload, LoadingSpinner, Modal, PdfAnnotator } from './components';
import * as pdfjsLib from 'pdfjs-dist';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Configure pdf.js worker
// Option 1: Use CDN worker (may have CORS issues)
// GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
// Option 2: Use local worker (preferred)
GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';

const App: React.FC = () => {
  // State declarations
  const [file, setFile] = useState<File | null>(null);
  const [pdf, setPdf] = useState<PdfFile | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // PDF rendering state
  const renderingInProgressRef = useRef<boolean>(false);
  const renderTaskQueueRef = useRef<Array<() => Promise<void>>>([]);
  const currentRenderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  // Canvas and drawing state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  
  // Store annotations by page number
  const [annotationsByPage, setAnnotationsByPage] = useState<Record<number, Annotation[]>>({});
  
  const [selectedTool, setSelectedTool] = useState<Tool>(Tool.PEN);
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentSize, setCurrentSize] = useState(2);

  // Selection state for LaTeX conversion
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<Point | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<Point | null>(null);
  const [showSelectionBox, setShowSelectionBox] = useState(false);

  // Feedback modal state
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackContent, setFeedbackContent] = useState('');

  // Error modal state
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalContent, setErrorModalContent] = useState('');

  // Add state for Ask AI mode
  const [showAskAiPanel, setShowAskAiPanel] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Add context input for the Ask AI panel
  const [contextInput, setContextInput] = useState('');

  // Function to format the feedback for display
  const formatFeedback = (feedback: string): React.ReactNode => {
    // Remove any XML/HTML looking tags that might have been included
    let cleanFeedback = feedback.replace(/<[^>]*>/g, '');
    
    // Remove LaTeX dollar signs but preserve the expression inside
    cleanFeedback = cleanFeedback.replace(/\$([^$]+)\$/g, '$1');
    
    // Check if feedback contains specific prefixes from our structured format
    if (cleanFeedback.includes('✅ Correct:')) {
      return (
        <div className="flex flex-col">
          <span className="text-green-600 font-bold text-lg">✅ Correct:</span>
          <span>{cleanFeedback.split('✅ Correct:')[1].trim()}</span>
        </div>
      );
    } else if (cleanFeedback.includes('🛈 Hint:')) {
      return (
        <div className="flex flex-col">
          <span className="text-blue-600 font-bold text-lg">🛈 Hint:</span>
          <span>{cleanFeedback.split('🛈 Hint:')[1].trim()}</span>
        </div>
      );
    } else if (cleanFeedback.includes('❌ Mistake detected:')) {
      return (
        <div className="flex flex-col">
          <span className="text-red-600 font-bold text-lg">❌ Mistake detected:</span>
          <span>{cleanFeedback.split('❌ Mistake detected:')[1].trim()}</span>
        </div>
      );
    }
    
    // If no specific format is detected, clean up any potential formatting and return
    return (
      <div className="flex flex-col">
        <span className="text-blue-600 font-bold text-lg">🤖 Feedback:</span>
        <span>{cleanFeedback.replace(/\*\*Diagnosis and Feedback\*\*/g, '').trim()}</span>
      </div>
    );
  };
  
  // Effect for canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize;
  }, [currentColor, currentSize]);

  // PDF loading and rendering
  const handleFileSelected = async (selectedFile: File) => {
    setFile(selectedFile);
    await loadPdf(selectedFile);
  };

  const loadPdf = async (pdfFile: File) => {
    try {
      setLoading(true);
      setError(null);
      console.log('Loading PDF file:', pdfFile.name);

      const arrayBuffer = await pdfFile.arrayBuffer();
      console.log('File converted to ArrayBuffer');

      const loadingTask = getDocument({ data: arrayBuffer });
      console.log('PDF loading task created');

      loadingTask.onProgress = (data: { loaded: number; total: number }) => {
        const percent = Math.round((data.loaded / data.total) * 100);
        setLoadingProgress(`Loading PDF: ${percent}%`);
        console.log(`Loading PDF: ${percent}%`);
      };

      const pdfDoc = await loadingTask.promise;
      console.log('PDF document loaded successfully');
      
      setPdf({
        document: pdfDoc,
        file: pdfFile,
        totalPages: pdfDoc.numPages
      });
      
      console.log('Rendering first page...');
      await renderPdfPage(pdfDoc, 1);
      setCurrentPage(1);
      console.log('First page rendered successfully');
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

  const renderPdfPage = async (pdfDoc: pdfjsLib.PDFDocumentProxy, pageNumber: number) => {
    // Create a render function that we can either execute immediately or queue
    const performRender = async () => {
      try {
        // If there's already a rendering in progress, don't start another
        if (renderingInProgressRef.current) {
          console.log("Rendering already in progress, queueing this render request");
          return;
        }
        
        const canvas = canvasRef.current;
        if (!canvas) return;
  
        // Cancel any existing render task
        if (currentRenderTaskRef.current) {
          console.log("Cancelling previous render task");
          currentRenderTaskRef.current.cancel();
          currentRenderTaskRef.current = null;
        }
  
        // Set flag to indicate rendering is in progress
        renderingInProgressRef.current = true;
  
        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.5 });
  
        canvas.width = viewport.width;
        canvas.height = viewport.height;
  
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          renderingInProgressRef.current = false;
          return;
        }
        
        // Make sure we're starting with a clean canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
  
        console.log("Rendering PDF page:", pageNumber);
        
        // Create a render task and store its reference
        const renderTask = page.render({
          canvasContext: ctx,
          viewport: viewport
        });
        
        currentRenderTaskRef.current = renderTask;
        
        // Wait for rendering to complete
        await renderTask.promise;
        
        // Clear the task reference
        currentRenderTaskRef.current = null;
        
        console.log("PDF page rendered, drawing annotations");
  
        // Redraw annotations
        drawAnnotations(ctx);
        
        console.log("Annotations drawn");
      } catch (err) {
        // Don't show error for cancelled render tasks
        if (err instanceof Error && err.message === 'Rendering cancelled') {
          console.log("Rendering was cancelled");
        } else {
          console.error("Error in renderPdfPage:", err);
          const errorMessage = err instanceof Error ? err.message : 'Failed to render PDF page';
          setError(errorMessage);
          setShowErrorModal(true);
          setErrorModalContent(`Error rendering page: ${errorMessage}`);
        }
      } finally {
        // Reset rendering flag
        renderingInProgressRef.current = false;
        
        // Check if there are any queued renders to process
        if (renderTaskQueueRef.current.length > 0) {
          console.log("Processing next queued render task");
          const nextRender = renderTaskQueueRef.current.shift();
          if (nextRender) {
            // Execute the next render task
            nextRender();
          }
        }
      }
    };
    
    // If rendering is already in progress, queue this request
    if (renderingInProgressRef.current) {
      console.log("Adding render request to queue", pageNumber);
      renderTaskQueueRef.current.push(performRender);
    } else {
      // Otherwise execute it immediately
      await performRender();
    }
  };
  // Helper functions for page-based annotations
  const getCurrentPageAnnotations = (): Annotation[] => {
    return annotationsByPage[currentPage] || [];
  };

  // Drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedTool === Tool.LATEX) {
      handleLatexSelectionStart(e);
      return;
    }
    
    if (selectedTool === Tool.ERASER) {
      // For eraser, track it as drawing to continuously erase while moving
      setIsDrawing(true);
      // Start erasing at this point
      handleErase(getCanvasPoint(e));
      return;
    }

    const point = getCanvasPoint(e);
    setIsDrawing(true);
    setCurrentPoints([point]);
  };

  // Handle erasing annotations when using the eraser tool
  const handleErase = (point: Point) => {
    const eraserRadius = 20;
    
    // Get current page annotations
    const currentAnnotations = annotationsByPage[currentPage] || [];
    
    // Log the current annotations for debugging
    console.log("Current annotations:", currentAnnotations.length);
    console.log("Types:", currentAnnotations.map((a: Annotation) => a.type));
    
    // Create a new array with only annotations NOT touched by the eraser
    const newAnnotations: Annotation[] = [];
    let removedCount = 0;
    
    // Examine each annotation and decide whether to keep it
    for (const annotation of currentAnnotations) {
      if (annotation.type === 'stroke') {
        // Check if any point in this stroke is within eraser radius
        let shouldRemove = false;
        
        for (const pt of (annotation as StrokeAnnotation).points) {
          // Calculate distance between this point and eraser center
          const dx = pt.x - point.x;
          const dy = pt.y - point.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance <= eraserRadius) {
            // This point is under the eraser
            shouldRemove = true;
            removedCount++;
            break; // No need to check other points
          }
        }
        
        // Only keep annotations that shouldn't be removed
        if (!shouldRemove) {
          newAnnotations.push(annotation);
        }
      } else {
        // Keep non-stroke annotations
        newAnnotations.push(annotation);
      }
    }
    
    // Only update if we actually removed something
    if (removedCount > 0) {
      console.log(`Eraser removed ${removedCount} annotations`);
      
      // Update page annotations state with new array
      setAnnotationsByPage(prev => ({
        ...prev,
        [currentPage]: newAnnotations
      }));
      
      // No need to call renderPdfPage here - the useEffect will handle it
      // when annotations state changes
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedTool === Tool.LATEX) {
      handleLatexSelectionMove(e);
      return;
    }
    
    if (!isDrawing) return;
    
    if (selectedTool === Tool.ERASER) {
      // Continue erasing while moving
      handleErase(getCanvasPoint(e));
      return;
    }

    const point = getCanvasPoint(e);
    setCurrentPoints(prev => [...prev, point]);

    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || currentPoints.length < 1) return;

    try {
      ctx.save();
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = currentSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      const prevPoint = currentPoints[currentPoints.length - 1] || point;
      ctx.moveTo(prevPoint.x, prevPoint.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      ctx.restore();
    } catch (err) {
      console.error('Error drawing on canvas:', err);
    }
  };

  const stopDrawing = async () => {
    if (selectedTool === Tool.LATEX) {
      await handleLatexSelectionEnd();
      return;
    }
    
    if (selectedTool === Tool.ERASER) {
      // Just stop the erasing process
      setIsDrawing(false);
      return;
    }

    if (!isDrawing) return;

    if (currentPoints.length > 0) {      const newAnnotation: StrokeAnnotation = {
        type: 'stroke',
        id: Math.random().toString(36).substring(2, 9),
        points: currentPoints,
        color: currentColor,
        lineWidth: currentSize
      };
      
      // Add to the current page's annotations
      setAnnotationsByPage(prev => {
        const currentAnnotations = prev[currentPage] || [];
        return {
          ...prev,
          [currentPage]: [...currentAnnotations, newAnnotation]
        };
      });
    }

    setIsDrawing(false);
    setCurrentPoints([]);
  };

  // LaTeX selection handlers
  const handleLatexSelectionStart = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e);
    setIsSelecting(true);
    setSelectionStart(point);
    setSelectionEnd(point);
    setShowSelectionBox(true);
  };

  const handleLatexSelectionMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelecting) return;
    const point = getCanvasPoint(e);
    setSelectionEnd(point);
  };
  
  const handleLatexSelectionEnd = async () => {
    try {
      if (!isSelecting || !selectionStart || !selectionEnd || !canvasRef.current) return;

      const x1 = Math.min(selectionStart.x, selectionEnd.x);
      const y1 = Math.min(selectionStart.y, selectionEnd.y);
      const width = Math.abs(selectionEnd.x - selectionStart.x);
      const height = Math.abs(selectionEnd.y - selectionStart.y);

      // Validate selection size
      if (width < 10 || height < 10) {
        setError('Selection too small. Please select a larger area.');
        return;
      }

      setLoading(true);
      setLoadingProgress('Converting handwriting to LaTeX...');
      setError(null);

      // Create temporary canvas for selection
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) throw new Error('Could not get temporary canvas context');

      // Copy selection to temporary canvas
      tempCtx.drawImage(
        canvasRef.current,
        x1, y1, width, height,
        0, 0, width, height
      );

      // Convert to base64
      const imageBase64 = tempCanvas.toDataURL('image/png').split(',')[1];
      if (!imageBase64) throw new Error('Failed to convert selection to image');      // Convert handwriting to LaTeX only (no tutoring)
      try {
        // Verify API key is available before making the request
        if (!import.meta.env.VITE_GEMINI_API_KEY) {
          throw new Error('Gemini API key is missing. Please set the VITE_GEMINI_API_KEY in your .env.local file.');
        }
        
        const latexResult = await convertHandwritingToLatex(imageBase64);
        console.log('Got LaTeX conversion:', latexResult);        // Remove any dollar signs, trailing raw LaTeX markup, and clean up matrix notation
        let cleanLatex = latexResult
          .replace(/\$/g, '')                // Remove dollar signs
          .replace(/\[c\].*$/, '')          // Remove [c] and anything after it
          .replace(/\\end\{array\}\\right\].*$/, '')  // Remove matrix end markers
          .replace(/\\begin\{array\}.*?\\\\/, '')    // Remove matrix begin markers
          .replace(/&\s*&\s*&/g, '& &')    // Normalize multiple column separators
          .trim();
        
        // Handle different types of LaTeX expressions
        let processedLatex = cleanLatex;
        
        // Check if it's a matrix or multiline content by looking for common indicators
        const isMatrix = cleanLatex.includes('\\begin{matrix}') || 
                        cleanLatex.includes('\\begin{pmatrix}') || 
                        cleanLatex.includes('\\begin{bmatrix}') ||
                        cleanLatex.includes('\\begin{vmatrix}') ||
                        cleanLatex.includes('\\\\') || // Line breaks in matrices
                        (cleanLatex.includes('&') && cleanLatex.includes('\\')); // Column and row separators
        
        // Check if it's a single character, number, or simple math symbol (common case)
        const isSingleCharacter = /^[a-z0-9+\-=×÷<>≤≥()]$/i.test(cleanLatex) || cleanLatex.length === 1;
        
        // Calculate the optimal position based on selection and content
        let posX, posY;
          if (isMatrix) {
          // For matrices, position at the top left with slight offset
          posX = x1 - 5; // Slight left offset to ensure complete coverage
          posY = y1 - 5; // Slight top offset to ensure complete coverage
          
          // Specific handling for matrices to ensure proper formatting
          
          // Check if we have what looks like raw matrix elements (numbers with & separators)
          const hasMatrixElements = /\d+\s*&\s*\d+/.test(processedLatex);
          
          // If we have raw matrix elements but no proper environment
          if (hasMatrixElements && !processedLatex.includes('\\begin{')) {
            // Extract matrix rows and columns
            const rows = processedLatex.split('\\\\').map(row => row.trim());
            const formattedRows = rows.map(row => row.split('&').map(cell => cell.trim()).join(' & ')).join(' \\\\ ');
            
            // Create a properly formatted matrix
            processedLatex = `\\begin{pmatrix} ${formattedRows} \\end{pmatrix}`;
          }
          
          // Clean up any lingering raw LaTeX
          processedLatex = processedLatex            .replace(/\[c\]/g, '')
            .replace(/\\end\{array\}\\right\]/g, '')
            .replace(/\\left\[\\begin\{array\}\{.*?\}/g, '');
        }
        
        if (isSingleCharacter) {
          // For single digits/characters, position exactly over the original with slight adjustment
          posX = x1 + (width / 4);
          posY = y1 + (height / 10);
        } else {
          // For other expressions, position at top left
          posX = x1;
          posY = y1;
        }
        
        // For single characters, make sure we render them at the right size
        if (isSingleCharacter) {
          // Enhance certain characters for better display when isolated
          switch(cleanLatex) {
            case '3':
              processedLatex = '3'; // Simple 3
              break;
            case '+':
              processedLatex = '+'; // Simple plus sign
              break;
            case '-':
              processedLatex = '-'; // Simple minus sign
              break;
            case '=':
              processedLatex = '='; // Simple equals sign
              break;
            default:
              processedLatex = cleanLatex;
          }        }
          // Add the LaTeX as a LaTeX annotation
        const newAnnotation: LatexAnnotation = {
          type: 'latex',
          id: Math.random().toString(36).substring(2, 9),
          x: posX, // Position calculated based on content type
          y: posY, // Position calculated based on content type
          latex: processedLatex,
          color: currentColor
        };
        
        // Get current page annotations
        const currentAnnotations = annotationsByPage[currentPage] || [];        // Create a new annotations array, replacing any overlapping stroke annotations
        let newAnnotations = currentAnnotations.filter(anno => {
          if (anno.type !== 'stroke') return true;
          
          // Check if stroke annotation overlaps with the selection
          const overlaps = (anno as StrokeAnnotation).points.some(point => 
            point.x >= x1 && point.x <= x1 + width &&
            point.y >= y1 && point.y <= y1 + height
          );
          
          return !overlaps;
        });
          // Clear the selection area on the canvas to remove all handwriting
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          // Save current context state
          ctx.save();
          
          // Use a much larger area to ensure complete coverage of handwriting trails
          const clearPadding = 20; // Increased padding to ensure we cover all strokes
          ctx.clearRect(
            x1 - clearPadding, 
            y1 - clearPadding, 
            width + (clearPadding * 2), 
            height + (clearPadding * 2)
          );
          
          // Restore context
          ctx.restore();
        }        // Use a more aggressive approach to remove strokes in the expanded area
        const expandedSelection = {
          x: x1 - 20,
          y: y1 - 20,
          width: width + 40,
          height: height + 40
        };
        
        // Remove all strokes in the area before adding the LaTeX
        // Filter out any stroke that has points inside our expanded selection area
        newAnnotations = newAnnotations.filter(anno => {
          // Keep all non-stroke annotations
          if (anno.type !== 'stroke') return true;
          
          // Check if any point of the stroke is in the expanded selection area
          const hasPointInArea = anno.points.some(point => 
            point.x >= expandedSelection.x && 
            point.x <= (expandedSelection.x + expandedSelection.width) &&
            point.y >= expandedSelection.y && 
            point.y <= (expandedSelection.y + expandedSelection.height)
          );
          
          // Keep strokes that don't have points in the selection area
          return !hasPointInArea;
        });
          // Add the new LaTeX annotation and update the current page
        setAnnotationsByPage(prev => ({
          ...prev,
          [currentPage]: [...newAnnotations, newAnnotation]
        }));
        
        // Show a brief success message
        setError(`Converted to LaTeX: ${cleanLatex}`);
        setTimeout(() => setError(null), 3000); // Clear after 3 seconds
      } catch (processError) {
        console.error('LaTeX conversion error details:', processError);
        throw processError; // Re-throw to be caught by the outer catch
      }
    } catch (err) {
      console.error('LaTeX selection error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to convert handwriting to LaTeX';      setError(errorMessage);
      setShowErrorModal(true);
      setErrorModalContent(`Error converting to LaTeX: ${errorMessage}\n\nPlease check that your API keys are correctly set in the .env.local file. You need to set up the VITE_GEMINI_API_KEY environment variable.`);
    } finally {
      setIsSelecting(false);
      setShowSelectionBox(false);
      setSelectionStart(null);
      setSelectionEnd(null);
      setLoading(false);
      setLoadingProgress('');
    }
  };

  // Handle tool selection changes
  useEffect(() => {
    if (selectedTool === Tool.ASK_AI) {
      setShowAskAiPanel(true);
    } else {
      setShowAskAiPanel(false);
    }
  }, [selectedTool]);

  // Add handling for Ask AI
  const handleAskAi = async () => {
    if (!aiQuestion.trim()) return;
    
    try {
      setAiLoading(true);
      setError(null);
      
      // Capture current PDF view as context
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('Canvas not available');
      
      // Get base64 image of current view
      const imageBase64 = canvas.toDataURL('image/png').split(',')[1];
      
      // Include both the question and any context info
      const contextInfo = contextInput ? `${contextInput}\n${aiQuestion}` : aiQuestion;
      
      // Process with AI
      const response = await processWithAITutor(imageBase64, contextInfo);
      setAiResponse(response);
      
      // Also update feedback content for the modal if user wants to show it
      setFeedbackContent(response);
    } catch (err) {
      console.error('Ask AI error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to get AI response';
      setError(errorMessage);
      setShowErrorModal(true);
      setErrorModalContent(`Error getting AI response: ${errorMessage}`);
    } finally {
      setAiLoading(false);
    }
  };

  // Utility functions
  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  // Draw annotations for the current page
  const drawAnnotations = (ctx: CanvasRenderingContext2D) => {
    try {
      const currentAnnotations = getCurrentPageAnnotations();
      console.log(`Drawing ${currentAnnotations.length} annotations for page ${currentPage}`);
      
      // Log the types of annotations we're about to draw
      const annotationTypes = currentAnnotations.map(a => a.type);
      console.log("Annotation types:", annotationTypes);
      
      currentAnnotations.forEach((annotation, index) => {
        ctx.save();
        if (annotation.type === 'stroke') {
          console.log(`Drawing stroke annotation ${index} with ${(annotation as StrokeAnnotation).points.length} points`);
          drawStroke(ctx, annotation as StrokeAnnotation);
        } else if (annotation.type === 'text') {
          drawText(ctx, annotation as TextAnnotation);
        } else if (annotation.type === 'latex') {
          drawLatex(ctx, annotation as LatexAnnotation);
        }
        ctx.restore();
      });
      console.log("Finished drawing annotations");
    } catch (err) {
      console.error('Error drawing annotations:', err);
    }
  };

  const drawStroke = (ctx: CanvasRenderingContext2D, annotation: StrokeAnnotation) => {
    if (annotation.points.length < 2) {
      console.log("Skipping stroke with less than 2 points");
      return;
    }

    try {
      console.log(`Drawing stroke: ${annotation.points.length} points, color: ${annotation.color}, width: ${annotation.lineWidth}`);
      
      ctx.beginPath();
      ctx.strokeStyle = annotation.color;
      ctx.lineWidth = annotation.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Start at the first point
      const startPoint = annotation.points[0];
      console.log(`Starting at point: (${startPoint.x}, ${startPoint.y})`);
      ctx.moveTo(startPoint.x, startPoint.y);

      // Draw lines to all subsequent points
      for (let i = 1; i < annotation.points.length; i++) {
        const point = annotation.points[i];
        ctx.lineTo(point.x, point.y);
      }
      
      // Complete the stroke
      ctx.stroke();
      console.log("Stroke drawing complete");
    } catch (err) {
      console.error('Error drawing stroke:', err);
    }
  };

  const drawText = (ctx: CanvasRenderingContext2D, annotation: TextAnnotation) => {
    try {
      ctx.font = `${annotation.size}px sans-serif`;
      ctx.fillStyle = annotation.color;
      ctx.textBaseline = 'top';
      ctx.fillText(annotation.text, annotation.x, annotation.y);
    } catch (err) {
      console.error('Error drawing text:', err);
    }
  };

  const drawLatex = (ctx: CanvasRenderingContext2D, annotation: LatexAnnotation) => {
    try {
      // Create a temporary HTML element to render the LaTeX
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.visibility = 'hidden';
      tempContainer.style.color = annotation.color;
      
      // Add container to document to ensure proper rendering
      document.body.appendChild(tempContainer);
      
      // Render the LaTeX expression using KaTeX
      katex.render(annotation.latex, tempContainer, {
        throwOnError: false,
        displayMode: false,
        output: 'html'
      });
      
      // Use html2canvas for better rendering (fallback to simpler method)
      // For this implementation, we'll use a simpler approach
      const canvasX = annotation.x;
      const canvasY = annotation.y;
      
      // Save the current canvas state
      ctx.save();
      
      // Set the font and color for fallback
      ctx.font = '18px KaTeX_Main, serif';
      ctx.fillStyle = annotation.color;
      
      // Draw the LaTeX text directly (basic fallback)
      ctx.fillText(annotation.latex, canvasX, canvasY + 18); // Adding font size for baseline
      
      // Remove the temporary element
      document.body.removeChild(tempContainer);
      
      // Restore the canvas state
      ctx.restore();
    } catch (err) {
      console.error('Error drawing LaTeX:', err);
      // Fallback to regular text if LaTeX rendering fails
      ctx.font = '16px sans-serif';
      ctx.fillStyle = annotation.color;
      ctx.fillText(annotation.latex, annotation.x, annotation.y + 16);
    }
  };

  // Selection box styles
  const getSelectionBoxStyle = (): React.CSSProperties | undefined => {
    if (!showSelectionBox || !selectionStart || !selectionEnd) return undefined;

    const left = Math.min(selectionStart.x, selectionEnd.x);
    const top = Math.min(selectionStart.y, selectionEnd.y);
    const width = Math.abs(selectionEnd.x - selectionStart.x);
    const height = Math.abs(selectionEnd.y - selectionStart.y);

    return {
      position: 'absolute',
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      border: '2px dashed #000',
      backgroundColor: 'rgba(0, 0, 255, 0.1)',
      pointerEvents: 'none'
    };
  };

  // Page navigation
  const goToPreviousPage = async () => {
    if (pdf && currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      await renderPdfPage(pdf.document, newPage);
    }
  };

  const goToNextPage = async () => {
    if (pdf && currentPage < pdf.totalPages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      await renderPdfPage(pdf.document, newPage);
    }
  };
  
  // PDF rerendering on annotation changes  
  useEffect(() => {
    const currentAnnotations = annotationsByPage[currentPage] || [];
    console.log("Annotations changed, rerendering...", currentAnnotations.length, "annotations for page", currentPage);
    
    if (!pdf || !canvasRef.current) {
      console.log("Missing pdf or canvas, skipping redraw");
      return;
    }
    
    // Force a complete redraw of the PDF with overlaid annotations
    renderPdfPage(pdf.document, currentPage)
      .then(() => console.log("PDF rerendered successfully after annotations changed"))
      .catch(err => console.error("Error rerendering PDF:", err));
  }, [annotationsByPage, pdf, currentPage]);

  return (
    <div className="flex flex-col h-screen">
      <Toolbar
        selectedTool={selectedTool}
        onToolChange={setSelectedTool}
        currentColor={currentColor}
        onColorChange={setCurrentColor}
        currentSize={currentSize}
        onSizeChange={setCurrentSize}
      />      <div className="flex-1 relative overflow-auto">
        {error && !showErrorModal && (
          <div className="absolute top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {!file && (
          <FileUpload onFileSelected={handleFileSelected} />
        )}

        {file && (
          <div className="relative w-full h-full">
            <PdfAnnotator
              canvasRef={canvasRef}
              currentTool={selectedTool}
              onStartDrawing={startDrawing}
              onDraw={draw}
              onStopDrawing={stopDrawing}
            />
            
            {/* LaTeX overlay container */}
            <div id="latex-overlay" className="absolute top-0 left-0 pointer-events-none" style={{ zIndex: 10 }}>
              {(annotationsByPage[currentPage] || [])
                .filter((anno): anno is LatexAnnotation => anno.type === 'latex')
                .map((anno, index) => (
                  <div 
                    key={`latex-${index}`}
                    className="absolute"                    style={{ 
                      left: `${anno.x - 15}px`, // Add extra offset to the left to better cover the handwriting
                      top: `${anno.y - 15}px`, // Add extra offset to the top to better cover the handwriting
                      color: anno.color,
                      backgroundColor: 'rgba(255, 255, 255, 1)', // Fully opaque background
                      padding: '10px 12px', // Even more padding to ensure full coverage
                      borderRadius: '5px',                      boxShadow: '0 0 20px 10px rgba(255, 255, 255, 1), 0 0 8px 5px rgba(255, 255, 255, 1)', // Enhanced white glow
                      transform: 'scale(1.5)', // Larger scale for better coverage
                      transformOrigin: 'left top', // Scale from the top left
                      minWidth: '30px', // Increased minimum width
                      minHeight: '30px', // Increased minimum height
                      border: '2px solid rgba(255, 255, 255, 1)', // White border for better separation
                      zIndex: 20 // Ensure it stays on top
                    }}
                    ref={el => {
                      if (el) {
                        try {                          // Clean up any remaining raw LaTeX artifacts one more time                          // More aggressive cleaning for matrices and other complex structures
                          let sanitizedLatex = anno.latex
                            .replace(/\[c\]/g, '')
                            .replace(/\\end\{array\}\\right\]/g, '')
                            .replace(/\\left\[\\begin\{array\}\{.*?\}/g, '')
                            .replace(/&\s*&\s*&/g, '& &')
                            .trim();
                            
                          // Special handling for matrices
                          if (sanitizedLatex.includes('&') || sanitizedLatex.includes('\\\\')) {
                            // Try to detect if this is a matrix but not properly formatted
                            if (!sanitizedLatex.includes('\\begin{') && sanitizedLatex.includes('&')) {
                              const rows = sanitizedLatex.split('\\\\').map(row => row.trim());
                              // Format each row properly
                              const formattedRows = rows.map(row => {
                                // Handle cases where there are too many &'s
                                return row.split('&')
                                  .filter(cell => cell.trim() !== '')
                                  .map(cell => cell.trim())
                                  .join(' & ');
                              }).join(' \\\\ ');
                              
                              sanitizedLatex = `\\begin{pmatrix} ${formattedRows} \\end{pmatrix}`;
                            }
                            
                            // Add extra styling for matrices to ensure they appear larger
                            el.style.padding = '15px 18px';
                            el.style.transform = 'scale(1.7)';
                            el.style.boxShadow = '0 0 25px 15px rgba(255, 255, 255, 1), 0 0 10px 8px rgba(255, 255, 255, 1)';
                          }
                            
                          // Use KaTeX to render the LaTeX expression
                          katex.render(sanitizedLatex, el, {
                            throwOnError: false,
                            displayMode: false,
                            output: 'html',
                            trust: true // Allow some commands that KaTeX would otherwise block
                          });
                        } catch (err) {
                          console.error('Error rendering LaTeX:', err);
                          el.textContent = anno.latex;
                        }
                      }
                    }}
                  />
                ))}
            </div>
            
            {showSelectionBox && <div style={getSelectionBoxStyle()} />}
            
            {/* Ask AI Panel */}
            {showAskAiPanel && (
              <div className="absolute top-4 right-4 w-96 bg-white rounded-lg shadow-lg p-4 border border-blue-200">
                <h3 className="text-lg font-semibold mb-2">Kourosh AI Tutor</h3>
                
                {/* Problem Context Field */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Problem Context:</label>
                  <textarea 
                    className="w-full border rounded p-2 text-sm"
                    placeholder="Enter the problem statement or instructions here..."
                    rows={2}
                    value={contextInput}
                    onChange={(e) => setContextInput(e.target.value)}
                  />
                </div>
                
                {/* Question Field */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your Question:</label>
                  <textarea 
                    className="w-full border rounded p-2 text-sm"
                    placeholder="Ask about this math problem..."
                    rows={2}
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                  />
                </div>
                
                <div className="flex justify-end">
                  <button
                    onClick={handleAskAi}
                    disabled={aiLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
                  >
                    {aiLoading ? 'Thinking...' : 'Get Tutoring Help'}
                  </button>
                </div>
                
                {aiResponse && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    {formatFeedback(aiResponse)}
                    
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() => setShowFeedback(true)}
                        className="px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors text-sm"
                      >
                        Open in Full View
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {pdf && pdf.totalPages > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-white rounded-lg shadow p-2">
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
          </div>
        )}

        {loading && <LoadingSpinner message={loadingProgress || 'Loading PDF...'} />}
        
        <Modal
          isOpen={showFeedback}
          onClose={() => setShowFeedback(false)}
          title="AI Tutor Feedback"
        >
          <div className="p-4">
            {formatFeedback(feedbackContent)}
          </div>
        </Modal>

        <Modal
          isOpen={showErrorModal}
          onClose={() => setShowErrorModal(false)}
          title="Error"
        >
          <div className="p-4 text-red-600">
            <p>{errorModalContent}</p>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default App;
