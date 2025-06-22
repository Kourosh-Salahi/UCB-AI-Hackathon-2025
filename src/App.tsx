import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Pen, Type, Eraser, MousePointer } from 'lucide-react';
import { Tool, Point, Annotation, StrokeAnnotation, TextAnnotation, PdfFile } from './types';
import { processWithAITutor } from './services/apiServices';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

const generateId = (): string => Math.random().toString(36).substr(2, 9);

const App: React.FC = () => {
  const [selectedTool, setSelectedTool] = useState<Tool>(Tool.PEN);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [penColor, setPenColor] = useState('#000000');
  const [penWidth, setPenWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [pdfFile, setPdfFile] = useState<PdfFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [tutorResponse, setTutorResponse] = useState('');
  const [showTutorModal, setShowTutorModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfPageImage, setPdfPageImage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfDocRef = useRef<any>(null);

  // Load PDF and render first page
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        pdfDocRef.current = pdfDoc;
        
        const newPdfFile: PdfFile = {
          name: file.name,
          url: URL.createObjectURL(file),
          numPages: pdfDoc.numPages,
          pdfDoc: pdfDoc
        };
        
        setPdfFile(newPdfFile);
        setCurrentPage(1);
        setAnnotations([]);
        await renderPdfPage(pdfDoc, 1);
      } catch (error) {
        console.error('Error loading PDF:', error);
        alert('Failed to load PDF. Please ensure it\'s a valid PDF file.');
      }
    }
  };

  // Render PDF page to image
  const renderPdfPage = async (pdfDoc: any, pageNum: number) => {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      setPdfPageImage(canvas.toDataURL());
    } catch (error) {
      console.error('Error rendering PDF page:', error);
    }
  };

  // Handle page changes
  const handlePageChange = async (newPage: number) => {
    if (pdfDocRef.current && newPage >= 1 && newPage <= (pdfFile?.numPages || 1)) {
      setCurrentPage(newPage);
      await renderPdfPage(pdfDocRef.current, newPage);
      setAnnotations([]); // Clear annotations when changing pages
    }
  };

  // Canvas drawing handlers
  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left),
      y: (e.clientY - rect.top)
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedTool === Tool.PEN) {
      setIsDrawing(true);
      const point = getCanvasPoint(e);
      setCurrentStroke([point]);
    } else if (selectedTool === Tool.TEXT) {
      const point = getCanvasPoint(e);
      const text = prompt('Enter text:');
      if (text) {
        const newTextAnnotation: TextAnnotation = {
          id: generateId(),
          type: 'text',
          x: point.x,
          y: point.y,
          text: text,
          fontSize: 16,
          color: penColor,
        };
        setAnnotations(prev => [...prev, newTextAnnotation]);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || selectedTool !== Tool.PEN) return;
    
    const point = getCanvasPoint(e);
    setCurrentStroke(prev => [...prev, point]);
  };

  const handleMouseUp = () => {
    if (isDrawing && selectedTool === Tool.PEN && currentStroke.length > 0) {
      const newStroke: StrokeAnnotation = {
        id: generateId(),
        type: 'stroke',
        points: currentStroke,
        color: penColor,
        lineWidth: penWidth
      };
      setAnnotations(prev => [...prev, newStroke]);
      setCurrentStroke([]);
    }
    setIsDrawing(false);
  };

  // Render annotations on canvas
  const renderAnnotations = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw PDF page background if available
    if (pdfPageImage) {
      const img = new window.Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        drawAnnotationsOnCanvas(ctx);
      };
      img.src = pdfPageImage;
    } else {
      // Draw placeholder background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#e0e0e0';
      ctx.strokeRect(0, 0, canvas.width, canvas.height);
      
      if (pdfFile) {
        ctx.fillStyle = '#666';
        ctx.font = '20px Arial';
        ctx.fillText(`${pdfFile.name} - Page ${currentPage}`, 50, 50);
      } else {
        ctx.fillStyle = '#666';
        ctx.font = '20px Arial';
        ctx.fillText('Upload a PDF to get started', 50, 50);
      }
      
      drawAnnotationsOnCanvas(ctx);
    }
  }, [annotations, currentStroke, penColor, penWidth, pdfPageImage, pdfFile, currentPage]);

  const drawAnnotationsOnCanvas = (ctx: CanvasRenderingContext2D) => {
    // Draw all annotations
    annotations.forEach(annotation => {
      if (annotation.type === 'stroke') {
        const stroke = annotation as StrokeAnnotation;
        if (stroke.points.length > 1) {
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.lineWidth;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          
          ctx.beginPath();
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
          for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
          }
          ctx.stroke();
        }
      } else if (annotation.type === 'text') {
        const textAnnotation = annotation as TextAnnotation;
        ctx.fillStyle = textAnnotation.color;
        ctx.font = `${textAnnotation.fontSize}px Arial`;
        ctx.fillText(textAnnotation.text, textAnnotation.x, textAnnotation.y);
      }
    });

    // Draw current stroke
    if (currentStroke.length > 1) {
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      ctx.moveTo(currentStroke[0].x, currentStroke[0].y);
      for (let i = 1; i < currentStroke.length; i++) {
        ctx.lineTo(currentStroke[i].x, currentStroke[i].y);
      }
      ctx.stroke();
    }
  };

  // Re-render when annotations change
  useEffect(() => {
    renderAnnotations();
  }, [renderAnnotations]);

  // AI Processing
  const processWithAI = async () => {
    if (!canvasRef.current) return;
    
    setIsProcessing(true);
    try {
      const imageData = canvasRef.current.toDataURL('image/png');
      const base64Image = imageData.split(',')[1];
      
      const feedback = await processWithAITutor(base64Image, `Page ${currentPage} of ${pdfFile?.name || 'document'}`);
      setTutorResponse(feedback);
      setShowTutorModal(true);
    } catch (error) {
      console.error('AI processing error:', error);
      setTutorResponse('Sorry, there was an error processing your request. Please check your API keys and try again.');
      setShowTutorModal(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const tools = [
    { tool: Tool.SELECT, icon: MousePointer, label: 'Select' },
    { tool: Tool.PEN, icon: Pen, label: 'Pen' },
    { tool: Tool.TEXT, icon: Type, label: 'Text' },
    { tool: Tool.ERASER, icon: Eraser, label: 'Eraser' }
  ];

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">PDF Markup & AI Tutor</h1>
          <div className="flex items-center space-x-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload PDF
            </button>
            <button
              className="bg-green-600 px-4 py-2 rounded hover:bg-green-700"
              onClick={processWithAI}
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Ask AI Tutor'}
            </button>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex flex-row bg-gray-800 p-2 space-x-2">
        {tools.map(({ tool, icon: Icon, label }) => (
          <button
            key={tool}
            className={`p-2 rounded ${selectedTool === tool ? 'bg-blue-500' : 'bg-gray-700'} hover:bg-blue-400`}
            onClick={() => setSelectedTool(tool)}
            title={label}
          >
            <Icon />
          </button>
        ))}
        <input
          type="color"
          value={penColor}
          onChange={e => setPenColor(e.target.value)}
          className="ml-4"
          title="Pen Color"
        />
        <input
          type="range"
          min={1}
          max={10}
          value={penWidth}
          onChange={e => setPenWidth(Number(e.target.value))}
          className="ml-2"
          title="Pen Width"
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <canvas
          ref={canvasRef}
          width={800}
          height={1000}
          className="border border-gray-700 bg-white"
          style={{ cursor: selectedTool === Tool.PEN ? 'crosshair' : 'default' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        />
        {pdfFile && (
          <div className="flex flex-row items-center mt-4 space-x-2">
            <button
              className="px-2 py-1 bg-gray-700 rounded"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              Prev
            </button>
            <span>
              Page {currentPage} of {pdfFile.numPages}
            </span>
            <button
              className="px-2 py-1 bg-gray-700 rounded"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= pdfFile.numPages}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* AI Tutor Modal */}
      {showTutorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white text-black p-6 rounded shadow-lg max-w-lg w-full">
            <h2 className="text-xl font-bold mb-2">AI Tutor Feedback</h2>
            <p className="mb-4">{tutorResponse}</p>
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              onClick={() => setShowTutorModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;