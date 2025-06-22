import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import type { PDFDocumentProxy, PDFPageProxy, PageViewport } from 'pdfjs-dist';
import { Annotation, Point, StrokeAnnotation, TextAnnotation, Tool, RenderedLatexAnnotation, SelectionRectangle } from '../types';
import { DEFAULT_PEN_COLOR, DEFAULT_PEN_LINE_WIDTH, ERASER_LINE_WIDTH, DEFAULT_TEXT_COLOR, DEFAULT_TEXT_FONT_SIZE_PDF_POINTS } from '../constants';
import katex from 'katex';

// Helper to generate unique IDs
const generateId = (): string => Math.random().toString(36).substr(2, 9);

interface PdfAnnotatorProps {
  pdfDoc: PDFDocumentProxy;
  currentPageNum: number;
  annotations: Annotation[];
  selectedTool: Tool;
  penColor: string;
  penLineWidth: number;
  textColor: string;
  zoomLevel: number;
  onAddAnnotation: (annotation: Annotation) => void;
  onUpdateAnnotation: (annotation: Annotation) => void;
  onRemoveAnnotation: (annotationId: string) => void;
  onSelectionForLatex: (selectionBoxPageCoords: SelectionRectangle) => void;
  pdfFileName: string; // for printing
}

interface CanvasDrawingState {
  isDrawing: boolean;
  isSelecting: boolean;
  isMoving: boolean;
  currentPoints: Point[];
  selectionStartPoint: Point | null;
  selectionBox: SelectionRectangle | null; // For LaTeX selection, in canvas coordinates
  activeTextAnnotation: TextAnnotation | null; // For text editing
  movingAnnotation: { id: string, type: Annotation['type'], startOffset: Point } | null;
}

const PdfAnnotator = forwardRef<
  { 
    capturePageAsImage: () => Promise<string | null>;
    captureSelectionAsImage: (rectPageCoords: SelectionRectangle) => Promise<string | null>;
    getViewport: () => PageViewport | null;
  },
  PdfAnnotatorProps
>(({
  pdfDoc,
  currentPageNum,
  annotations,
  selectedTool,
  penColor,
  penLineWidth,
  textColor,
  zoomLevel,
  onAddAnnotation,
  onUpdateAnnotation,
  onRemoveAnnotation,
  onSelectionForLatex,
  pdfFileName,
}, ref) => {
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
  const [drawingState, setDrawingState] = useState<CanvasDrawingState>({
    isDrawing: false,
    isSelecting: false,
    isMoving: false,
    currentPoints: [],
    selectionStartPoint: null,
    selectionBox: null,
    activeTextAnnotation: null,
    movingAnnotation: null,
  });
  const [pageViewport, setPageViewport] = useState<PageViewport | null>(null);
  const [textInput, setTextInput] = useState<{ x: number, y: number, id: string, value: string } | null>(null); // For text tool input

  const getCanvasCoordinates = (event: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = annotationCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const getPdfPageCoordinates = (canvasPoint: Point): Point => {
    if (!pageViewport) return canvasPoint; // Should not happen if page is rendered
    const [pdfX, pdfY] = pageViewport.convertToPdfPoint(canvasPoint.x, canvasPoint.y);
    return { x: pdfX, y: pdfY };
  };

  const getCanvasCoordinatesFromPdf = (pdfPoint: Point): Point => {
    if (!pageViewport) return pdfPoint;
    const [canvasX, canvasY] = pageViewport.convertToViewportPoint(pdfPoint.x, pdfPoint.y);
    return { x: canvasX, y: canvasY };
  };
  
  const drawAnnotations = useCallback(() => {
    const canvas = annotationCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !pageViewport) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Clear existing KaTeX containers before redrawing
    const parent = annotationCanvasRef.current?.parentElement;
    if (parent) {
        const latexContainers = parent.querySelectorAll('div[id^="latex-container-"]');
        latexContainers.forEach(container => container.remove());
    }


    annotations.forEach(annotation => {
      ctx.beginPath();
      switch (annotation.type) {
        case 'stroke': {
          const stroke = annotation as StrokeAnnotation;
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.lineWidth * zoomLevel; // Adjust line width by zoom
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          stroke.points.forEach((point, index) => {
            const canvasPoint = getCanvasCoordinatesFromPdf(point);
            if (index === 0) ctx.moveTo(canvasPoint.x, canvasPoint.y);
            else ctx.lineTo(canvasPoint.x, canvasPoint.y);
          });
          ctx.stroke();
          break;
        }
        case 'text': {
          const textAnn = annotation as TextAnnotation;
          if (textAnn.editing) break; // Don't draw if editing via HTML input

          const { x: pdfX, y: pdfY } = textAnn;
          const canvasPoint = getCanvasCoordinatesFromPdf({x: pdfX, y: pdfY});
          
          ctx.fillStyle = textAnn.color;
          // Font size in PDF points needs to be scaled by zoom for canvas rendering
          const canvasFontSize = textAnn.fontSize * pageViewport.scale; 
          ctx.font = `${canvasFontSize}px Arial`;
          ctx.textBaseline = 'top';
          textAnn.text.split('\n').forEach((line, i) => {
            ctx.fillText(line, canvasPoint.x, canvasPoint.y + (i * canvasFontSize * 1.2)); // 1.2 for line height
          });
          break;
        }
        case 'latex': {
          const latexAnn = annotation as RenderedLatexAnnotation;
          const containerId = `latex-container-${latexAnn.id}`; // Unique ID for container
          let container = document.getElementById(containerId);
          // Create container if it doesn't exist
          if (!container && annotationCanvasRef.current?.parentElement) {
            container = document.createElement('div');
            container.id = containerId;
            container.style.position = 'absolute';
            container.style.pointerEvents = 'none'; // So it doesn't interfere with canvas events
            container.style.zIndex = '15'; // Ensure it's above canvas but below text input
            annotationCanvasRef.current.parentElement.appendChild(container);
          }
          
          if (container) { // Ensure container exists before styling and rendering
            const canvasPoint = getCanvasCoordinatesFromPdf({x: latexAnn.x, y: latexAnn.y});
            const canvasRect = annotationCanvasRef.current?.getBoundingClientRect();

            container.style.left = `${(canvasRect?.left || 0) + canvasPoint.x}px`;
            container.style.top = `${(canvasRect?.top || 0) + canvasPoint.y}px`;
            container.style.color = latexAnn.color;
            
            container.style.transform = `scale(${zoomLevel})`;
            container.style.transformOrigin = 'top left';

            try {
              katex.render(latexAnn.latexString, container, {
                throwOnError: false,
                displayMode: false, 
              });
            } catch (e) {
              console.error("KaTeX rendering error:", e);
              container.innerText = "Error rendering LaTeX";
            }
          }
          break;
        }
      }
    });

    // Draw current drawing path if any
    if (drawingState.isDrawing && drawingState.currentPoints.length > 1 && selectedTool === Tool.PEN) {
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penLineWidth * zoomLevel;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      drawingState.currentPoints.forEach((point, index) => { // These points are already canvas coordinates
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
    }
    
    // Draw selection box for LaTeX tool
    if (drawingState.isSelecting && drawingState.selectionBox && selectedTool === Tool.LATEX_SELECT) {
        const { x, y, width, height } = drawingState.selectionBox; // These are canvas coordinates
        ctx.strokeStyle = 'rgba(0, 123, 255, 0.7)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x, y, width, height);
        ctx.setLineDash([]);
    }

  }, [annotations, drawingState, penColor, penLineWidth, selectedTool, pageViewport, zoomLevel]);


  useEffect(() => {
    if (!pdfDoc) return;
    setIsLoadingPage(true);
    pdfDoc.getPage(currentPageNum).then((page: PDFPageProxy) => {
      const desiredViewport = page.getViewport({ scale: zoomLevel });
      setPageViewport(desiredViewport);

      const pdfCanvas = pdfCanvasRef.current;
      const annotationCanvas = annotationCanvasRef.current;
      if (pdfCanvas && annotationCanvas) {
        pdfCanvas.height = desiredViewport.height;
        pdfCanvas.width = desiredViewport.width;
        annotationCanvas.height = desiredViewport.height;
        annotationCanvas.width = desiredViewport.width;

        const pdfCtx = pdfCanvas.getContext('2d');
        if (pdfCtx) {
          const renderContext = {
            canvasContext: pdfCtx,
            viewport: desiredViewport,
          };
          page.render(renderContext).promise.then(() => {
            setIsLoadingPage(false);
            // drawAnnotations(); // Called by annotations effect or zoom effect
          });
        }
      }
    }).catch(err => {
        console.error("Error rendering page:", err);
        setIsLoadingPage(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc, currentPageNum, zoomLevel]); 

  useEffect(() => {
    // This effect redraws annotations whenever they change, or when essential rendering params change.
    drawAnnotations();
  }, [annotations, drawAnnotations, pageViewport]); // pageViewport ensures re-draw on zoom/page load.

  const [isLoadingPage, setIsLoadingPage] = useState(false);


  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvasPoint = getCanvasCoordinates(event);
    const pdfPoint = getPdfPageCoordinates(canvasPoint);

    if (selectedTool === Tool.PEN) {
      setDrawingState(prev => ({ ...prev, isDrawing: true, currentPoints: [canvasPoint] }));
    } else if (selectedTool === Tool.ERASER) {
      setDrawingState(prev => ({ ...prev, isDrawing: true, currentPoints: [canvasPoint] })); // Eraser also draws
    } else if (selectedTool === Tool.LATEX_SELECT) {
      setDrawingState(prev => ({ ...prev, isSelecting: true, selectionStartPoint: canvasPoint, selectionBox: null }));
    } else if (selectedTool === Tool.TEXT) {
      if (textInput) { 
        handleTextSubmit();
      }
      const newTextId = generateId();
      // Position textarea relative to canvas parent for correct scroll behavior
      const canvasWrapper = annotationCanvasRef.current?.parentElement;
      const parentRect = canvasWrapper?.getBoundingClientRect();
      const inputX = canvasPoint.x + (annotationCanvasRef.current?.offsetLeft || 0) - (parentRect?.left || 0);
      const inputY = canvasPoint.y + (annotationCanvasRef.current?.offsetTop || 0) - (parentRect?.top || 0);

      setTextInput({ x: inputX, y: inputY, id: newTextId, value: '' });
      const tempTextAnn: TextAnnotation = {
        id: newTextId,
        type: 'text',
        x: pdfPoint.x,
        y: pdfPoint.y,
        text: '',
        fontSize: DEFAULT_TEXT_FONT_SIZE_PDF_POINTS, 
        color: textColor,
        editing: true,
      };
      onAddAnnotation(tempTextAnn); 
      setDrawingState(prev => ({ ...prev, activeTextAnnotation: tempTextAnn }));

    } else if (selectedTool === Tool.SELECT) {
      let foundAnnotationToMove: Annotation | null = null;
      let minDistance = Infinity;

      for (const ann of [...annotations].reverse()) { 
        const annCanvasPos = getCanvasCoordinatesFromPdf({x: (ann as any).x || 0, y: (ann as any).y || 0}); 
        if (ann.type === 'text' || ann.type === 'latex') {
            const textAnn = ann as TextAnnotation | RenderedLatexAnnotation;
            const approxWidth = (textAnn.type === 'text' ? (textAnn as TextAnnotation).text.length * (textAnn as TextAnnotation).fontSize * 0.5 : 100) * zoomLevel; 
            const approxHeight = (textAnn.type === 'text' ? (textAnn as TextAnnotation).fontSize : 50) * zoomLevel; 
            if (canvasPoint.x >= annCanvasPos.x && canvasPoint.x <= annCanvasPos.x + approxWidth &&
                canvasPoint.y >= annCanvasPos.y && canvasPoint.y <= annCanvasPos.y + approxHeight) {
                foundAnnotationToMove = ann;
                break;
            }
        } else if (ann.type === 'stroke') {
            const strokeAnn = ann as StrokeAnnotation;
            for (const pt of strokeAnn.points) {
                const strokeCanvasPt = getCanvasCoordinatesFromPdf(pt);
                const dist = Math.sqrt(Math.pow(strokeCanvasPt.x - canvasPoint.x, 2) + Math.pow(strokeCanvasPt.y - canvasPoint.y, 2));
                if (dist < (strokeAnn.lineWidth * zoomLevel / 2) + 5) { 
                    if (dist < minDistance) {
                        minDistance = dist;
                        foundAnnotationToMove = ann;
                    }
                }
            }
            if (foundAnnotationToMove && foundAnnotationToMove.type === 'stroke') break; 
        }
      }

      if (foundAnnotationToMove) {
        const annCanvasPos = getCanvasCoordinatesFromPdf({x: (foundAnnotationToMove as any).x || 0, y: (foundAnnotationToMove as any).y || 0});
        setDrawingState(prev => ({
          ...prev,
          isMoving: true,
          movingAnnotation: { 
            id: foundAnnotationToMove!.id, 
            type: foundAnnotationToMove!.type,
            startOffset: (foundAnnotationToMove!.type === 'stroke') 
              ? { x: 0, y: 0 } 
              : { x: canvasPoint.x - annCanvasPos.x, y: canvasPoint.y - annCanvasPos.y }
          },
          currentPoints: [canvasPoint] // Store initial mouse point for stroke delta calculation
        }));
      }
    }
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingState.isDrawing && !drawingState.isSelecting && !drawingState.isMoving) return;
    const canvasPoint = getCanvasCoordinates(event);

    if (drawingState.isDrawing) {
      setDrawingState(prev => ({ ...prev, currentPoints: [...prev.currentPoints, canvasPoint] }));
      if (selectedTool === Tool.ERASER && pageViewport) {
          const pdfEraserPoint = getPdfPageCoordinates(canvasPoint);
          const annotationsToRemove: string[] = [];
          annotations.forEach(ann => {
            if (ann.type === 'stroke') {
              if (ann.points.some(p => {
                const dist = Math.sqrt(Math.pow(p.x - pdfEraserPoint.x,2) + Math.pow(p.y - pdfEraserPoint.y,2));
                const eraserRadiusPdf = (ERASER_LINE_WIDTH / 2) / pageViewport.scale;
                return dist < eraserRadiusPdf;
              })) {
                annotationsToRemove.push(ann.id);
              }
            }
          });
          annotationsToRemove.forEach(id => onRemoveAnnotation(id));
          // Visual erasing effect (destination-out) is complex to make permanent without path manipulation
          // The above logic removes entire strokes if part of them is touched by eraser center.
      }
    } else if (drawingState.isSelecting && drawingState.selectionStartPoint) {
      const start = drawingState.selectionStartPoint;
      const width = canvasPoint.x - start.x;
      const height = canvasPoint.y - start.y;
      setDrawingState(prev => ({ ...prev, selectionBox: { x: start.x, y: start.y, width, height } }));
    } else if (drawingState.isMoving && drawingState.movingAnnotation && pageViewport) {
        const { id, type, startOffset } = drawingState.movingAnnotation;
        const currentAnnotation = annotations.find(a => a.id === id);
        if (!currentAnnotation) return;

        if (type === 'stroke') {
            const prevMouseCanvasPoint = drawingState.currentPoints[drawingState.currentPoints.length-1];
            const deltaCanvasX = canvasPoint.x - prevMouseCanvasPoint.x;
            const deltaCanvasY = canvasPoint.y - prevMouseCanvasPoint.y;
            
            const deltaPdfX = deltaCanvasX / pageViewport.scale;
            const deltaPdfY = deltaCanvasY / pageViewport.scale;

            const updatedStroke = {
                ...currentAnnotation as StrokeAnnotation,
                points: (currentAnnotation as StrokeAnnotation).points.map(p => ({
                    x: p.x + deltaPdfX,
                    y: p.y + deltaPdfY,
                })),
            };
            onUpdateAnnotation(updatedStroke);
            setDrawingState(prev => ({...prev, currentPoints: [...prev.currentPoints, canvasPoint]})); 

        } else if (type === 'text' || type === 'latex') {
            const newCanvasX = canvasPoint.x - startOffset.x;
            const newCanvasY = canvasPoint.y - startOffset.y;
            const newPdfPoint = getPdfPageCoordinates({x: newCanvasX, y: newCanvasY});
            
            const updatedAnn = {
                ...currentAnnotation,
                x: newPdfPoint.x,
                y: newPdfPoint.y,
            };
            onUpdateAnnotation(updatedAnn as TextAnnotation | RenderedLatexAnnotation);
        }
    }
  };

  const handleMouseUp = () => {
    if (drawingState.isDrawing && selectedTool === Tool.PEN) {
      if (drawingState.currentPoints.length > 1 && pageViewport) {
        const newStroke: StrokeAnnotation = {
          id: generateId(),
          type: 'stroke',
          points: drawingState.currentPoints.map(p => getPdfPageCoordinates(p)),
          color: penColor,
          lineWidth: penLineWidth, 
        };
        onAddAnnotation(newStroke);
      }
    } else if (drawingState.isSelecting && drawingState.selectionBox && selectedTool === Tool.LATEX_SELECT) {
        const {x, y, width, height} = drawingState.selectionBox; 
        const selRectCanvas: SelectionRectangle = {
            x: width < 0 ? x + width : x,
            y: height < 0 ? y + height : y,
            width: Math.abs(width),
            height: Math.abs(height)
        };

        if (selRectCanvas.width > 5 && selRectCanvas.height > 5 && pageViewport) { 
            const topLeftPdf = getPdfPageCoordinates({x: selRectCanvas.x, y: selRectCanvas.y});
            const bottomRightPdf = getPdfPageCoordinates({x: selRectCanvas.x + selRectCanvas.width, y: selRectCanvas.y + selRectCanvas.height});
            
            const selectionBoxPageCoords: SelectionRectangle = {
                x: topLeftPdf.x,
                y: topLeftPdf.y, // PDF Y is from top, so this is fine
                width: Math.abs(bottomRightPdf.x - topLeftPdf.x),
                height: Math.abs(bottomRightPdf.y - topLeftPdf.y) 
            };
            onSelectionForLatex(selectionBoxPageCoords);
        }
    }
    
    setDrawingState(prev => ({
      ...prev,
      isDrawing: false,
      isSelecting: false,
      isMoving: false,
      currentPoints: [],
      selectionStartPoint: null,
      selectionBox: null,
      movingAnnotation: null,
    }));
  };

  const handleMouseLeave = () => { 
    if (drawingState.isDrawing || drawingState.isSelecting || drawingState.isMoving) {
        handleMouseUp();
    }
  };

  const handleTextSubmit = () => {
    if (textInput && drawingState.activeTextAnnotation) {
      const finalAnnotation: TextAnnotation = {
        ...drawingState.activeTextAnnotation,
        text: textInput.value,
        editing: false, 
      };
      onUpdateAnnotation(finalAnnotation); 
      setTextInput(null);
      setDrawingState(prev => ({ ...prev, activeTextAnnotation: null }));
    }
  };
  
  const handleTextInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (textInput) {
      setTextInput({ ...textInput, value: e.target.value });
       // Dynamically adjust textarea height
      e.target.style.height = 'auto';
      e.target.style.height = `${e.target.scrollHeight}px`;
    }
  };
  
  const handleTextInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); 
        handleTextSubmit();
    }
    if (e.key === 'Escape') {
        if (textInput && drawingState.activeTextAnnotation) {
            onRemoveAnnotation(drawingState.activeTextAnnotation.id); 
        }
        setTextInput(null);
        setDrawingState(prev => ({ ...prev, activeTextAnnotation: null }));
    }
  };

  useImperativeHandle(ref, () => ({
    getViewport: () => pageViewport,
    capturePageAsImage: async (): Promise<string | null> => {
      const pdfCanvas = pdfCanvasRef.current;
      const annCanvas = annotationCanvasRef.current;
      if (!pdfCanvas || !annCanvas || !pageViewport) return null;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = pageViewport.width;
      tempCanvas.height = pageViewport.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return null;

      tempCtx.drawImage(pdfCanvas, 0, 0);
      tempCtx.drawImage(annCanvas, 0, 0);
      
      // KaTeX elements are HTML, not on canvas. For tutoring context, this means LaTeX won't be in the image.
      // This is a limitation. html2canvas or similar would be needed for full fidelity.

      return tempCanvas.toDataURL('image/png');
    },
    captureSelectionAsImage: async (rectPageCoords: SelectionRectangle): Promise<string | null> => {
        // This function will capture from both PDF and Annotation layers for better context
        const pdfCanvas = pdfCanvasRef.current;
        const annCanvas = annotationCanvasRef.current;
        if (!pdfCanvas || !annCanvas || !pageViewport) return null;

        const topLeftCanvas = getCanvasCoordinatesFromPdf({x: rectPageCoords.x, y: rectPageCoords.y});
        const widthCanvas = Math.abs(rectPageCoords.width * pageViewport.scale); // Ensure positive
        const heightCanvas = Math.abs(rectPageCoords.height * pageViewport.scale); // Ensure positive
        
        // Adjust x,y if width/height were negative from PDF coords calculation
        const finalCanvasX = rectPageCoords.width < 0 ? topLeftCanvas.x - widthCanvas : topLeftCanvas.x;
        const finalCanvasY = rectPageCoords.height < 0 ? topLeftCanvas.y - heightCanvas : topLeftCanvas.y;


        if (widthCanvas <=0 || heightCanvas <=0) return null;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = widthCanvas;
        tempCanvas.height = heightCanvas;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return null;

        // Draw the selected portion of the PDF canvas (background)
        tempCtx.drawImage(
            pdfCanvas,
            finalCanvasX, finalCanvasY, widthCanvas, heightCanvas, 
            0, 0, widthCanvas, heightCanvas 
        );
        // Draw the selected portion of the annotation canvas (foreground)
        tempCtx.drawImage(
            annCanvas,
            finalCanvasX, finalCanvasY, widthCanvas, heightCanvas,
            0, 0, widthCanvas, heightCanvas
        );
        
        return tempCanvas.toDataURL('image/png');
    }
  }));

  return (
    <div className="relative shadow-lg" style={{ userSelect: (selectedTool === Tool.TEXT || drawingState.activeTextAnnotation) ? 'auto' : 'none' }}>
      {isLoadingPage && <div className="absolute inset-0 bg-gray-500 bg-opacity-50 flex items-center justify-center z-20"><div className="text-white text-xl">Loading page...</div></div>}
      <canvas ref={pdfCanvasRef} className="block border border-gray-500" />
      <canvas
        ref={annotationCanvasRef}
        className="absolute top-0 left-0 border border-transparent z-10"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: selectedTool === Tool.PEN ? 'crosshair' : 
                         selectedTool === Tool.ERASER ? 'grab' : 
                         selectedTool === Tool.TEXT ? 'text' :
                         selectedTool === Tool.LATEX_SELECT ? 'copy' :
                         selectedTool === Tool.SELECT ? 'move' : 'default' }}
      />
      {textInput && pageViewport && (
        <textarea
          autoFocus
          value={textInput.value}
          onChange={handleTextInputChange}
          onKeyDown={handleTextInputKeyDown}
          onBlur={handleTextSubmit} 
          style={{
            position: 'absolute', // Relative to the PdfAnnotator's parent (main scroll area)
            left: `${textInput.x}px`,
            top: `${textInput.y}px`,
            fontSize: `${DEFAULT_TEXT_FONT_SIZE_PDF_POINTS * pageViewport.scale}px`, 
            lineHeight: `${DEFAULT_TEXT_FONT_SIZE_PDF_POINTS * pageViewport.scale * 1.2}px`,
            border: '1px dashed gray',
            background: 'rgba(255,255,255,0.95)',
            color: textColor,
            zIndex: 20, // Above annotation canvas
            minWidth: '100px', 
            minHeight: `${DEFAULT_TEXT_FONT_SIZE_PDF_POINTS * pageViewport.scale * 1.2}px`,
            outline: 'none',
            overflow: 'hidden', 
            resize: 'none', 
            fontFamily: 'Arial', 
          }}
          className="p-1 rounded shadow-md"
          rows={1} 
        />
      )}
      <div className="print-only hidden">
          <h2>{pdfFileName} - Page {currentPageNum}</h2>
      </div>
    </div>
  );
});

export default PdfAnnotator;