
import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import type { PDFDocumentProxy, PDFPageProxy, PageViewport } from 'pdfjs-dist';
import { Annotation, Point, StrokeAnnotation, TextAnnotation, Tool, RenderedLatexAnnotation, SelectionRectangle } from '../types';
import { DEFAULT_PEN_COLOR, DEFAULT_PEN_LINE_WIDTH, ERASER_LINE_WIDTH, DEFAULT_TEXT_COLOR, DEFAULT_TEXT_FONT_SIZE_PDF_POINTS } from '../constants';
import ReactKatex from 'react-katex';

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

  const getCanvasCoordinates = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
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

          const { x: pdfX, y: pdfY } = textAnn; // These are PDF user space coordinates (Y-up) for top-left
          const canvasPoint = getCanvasCoordinatesFromPdf({x: pdfX, y: pdfY}); // canvasPoint.y is for the top line
          
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
        // LaTeX rendering is now handled by react-katex components in JSX
        case 'latex': {
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
    // This effect redraws canvas-based annotations whenever they change, or when essential rendering params change.
    // LaTeX annotations are handled by React's rendering based on the same state.
    drawAnnotations();
  }, [annotations, drawAnnotations, pageViewport]); // pageViewport ensures re-draw on zoom/page load.

  const [isLoadingPage, setIsLoadingPage] = useState(false);


  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvasPoint = getCanvasCoordinates(event);
    const pdfPoint = getPdfPageCoordinates(canvasPoint); // pdfPoint is in PDF user space (Y-up)

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
      
      // canvasPoint.x and canvasPoint.y are already relative to the annotationCanvas.
      // Since annotationCanvas is at (0,0) of its relative parent,
      // canvasPoint.x and canvasPoint.y are the correct offsets for the textarea.
      const inputX = canvasPoint.x;
      const inputY = canvasPoint.y;


      setTextInput({ x: inputX, y: inputY, id: newTextId, value: '' });
      const tempTextAnn: TextAnnotation = { // Storing PDF user space coords (Y-up) for top-left
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

      // Iterate in reverse for hit-testing top-most annotations first
      for (const ann of [...annotations].reverse()) { 
        // For text/latex, ann.x, ann.y are PDF user space for top-left.
        // For strokes, we check points.
        if (ann.type === 'text' || ann.type === 'latex') {
            const an = ann as TextAnnotation | RenderedLatexAnnotation;
            const annCanvasOrigin = getCanvasCoordinatesFromPdf({x: an.x, y: an.y}); // Canvas Y for top of annotation

            const approxCharWidth = (an.type === 'text' ? (an as TextAnnotation).fontSize * 0.6 : 20) * zoomLevel; 
            const approxLineHeight = (an.type === 'text' ? (an as TextAnnotation).fontSize * 1.2 : 25) * zoomLevel;
            
            let textBlockWidth = 0;
            let numLines = 1;
            if (an.type === 'text') {
                 numLines = (an as TextAnnotation).text.split('\n').length;
                 const lines = (an as TextAnnotation).text.split('\n');
                 lines.forEach(line => textBlockWidth = Math.max(textBlockWidth, line.length * approxCharWidth));
            } else { 
                // Approximate width for LaTeX: try to get it from rendered element or use a fallback
                const latexElement = document.getElementById(`latex-container-${an.id}`);
                textBlockWidth = latexElement ? latexElement.offsetWidth * zoomLevel : 100 * zoomLevel; // Account for zoom in hit test
                 // Approximate height (can be complex for multi-line LaTeX)
            }
            const textBlockHeight = numLines * approxLineHeight;


            if (canvasPoint.x >= annCanvasOrigin.x && canvasPoint.x <= annCanvasOrigin.x + textBlockWidth &&
                canvasPoint.y >= annCanvasOrigin.y && canvasPoint.y <= annCanvasOrigin.y + textBlockHeight) {
                foundAnnotationToMove = ann;
                break;
            }
        } else if (ann.type === 'stroke') {
            const strokeAnn = ann as StrokeAnnotation;
            for (const pt of strokeAnn.points) { // pt is in PDF user space
                const strokeCanvasPt = getCanvasCoordinatesFromPdf(pt); // Converted to canvas space
                const dist = Math.sqrt(Math.pow(strokeCanvasPt.x - canvasPoint.x, 2) + Math.pow(strokeCanvasPt.y - canvasPoint.y, 2));
                const hitRadius = Math.max( (strokeAnn.lineWidth * zoomLevel / 2), 3) + 5; // +5 for easier clicking
                if (dist < hitRadius) { 
                    if (dist < minDistance) { 
                        minDistance = dist;
                        foundAnnotationToMove = ann; 
                    }
                }
            }
            if (foundAnnotationToMove && foundAnnotationToMove.id === ann.id) break; 
        }
      }

      if (foundAnnotationToMove) {
        let annOriginCanvasPoint: Point;
        if (foundAnnotationToMove.type === 'stroke') {
            annOriginCanvasPoint = canvasPoint; 
        } else { 
            annOriginCanvasPoint = getCanvasCoordinatesFromPdf({ x: (foundAnnotationToMove as TextAnnotation | RenderedLatexAnnotation).x, y: (foundAnnotationToMove as TextAnnotation | RenderedLatexAnnotation).y });
        }

        setDrawingState(prev => ({
          ...prev,
          isMoving: true,
          movingAnnotation: { 
            id: foundAnnotationToMove!.id, 
            type: foundAnnotationToMove!.type,
            startOffset: { 
                x: canvasPoint.x - annOriginCanvasPoint.x, 
                y: canvasPoint.y - annOriginCanvasPoint.y  
            }
          },
          currentPoints: [canvasPoint] 
        }));
      }
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
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
            // Add logic for erasing text/latex if needed (e.g., if eraser center is within their bounds)
            // For text/LaTeX, more complex bounding box check against pdfEraserPoint would be needed.
          });
          annotationsToRemove.forEach(id => onRemoveAnnotation(id));
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
                    y: p.y - deltaPdfY, 
                })),
            };
            onUpdateAnnotation(updatedStroke);
            setDrawingState(prev => ({...prev, currentPoints: [...prev.currentPoints.slice(0, -1), canvasPoint]})); 

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

  const handlePointerUp = () => {
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
                y: topLeftPdf.y, 
                width: Math.abs(bottomRightPdf.x - topLeftPdf.x),
                height: Math.abs(topLeftPdf.y - bottomRightPdf.y) 
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

  const handlePointerLeave = () => { 
    if (drawingState.isDrawing || drawingState.isSelecting || drawingState.isMoving) {
        handlePointerUp();
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
      // ... (existing implementation - Note: react-katex HTML elements won't be on this canvas image)
      // This is a known limitation. For tutoring, the image context is PDF + canvas annotations.
      // To include HTML overlays, html2canvas or similar would be needed.
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
      
      return tempCanvas.toDataURL('image/png');
    },
    captureSelectionAsImage: async (rectPageCoords: SelectionRectangle): Promise<string | null> => {
        // ... (existing implementation - Note: react-katex HTML elements won't be on this canvas image)
        const pdfCanvas = pdfCanvasRef.current;
        const annCanvas = annotationCanvasRef.current;
        if (!pdfCanvas || !annCanvas || !pageViewport) return null;

        const topLeftCanvas = getCanvasCoordinatesFromPdf({x: rectPageCoords.x, y: rectPageCoords.y});
        const bottomRightCanvas = getCanvasCoordinatesFromPdf({x: rectPageCoords.x + rectPageCoords.width, y: rectPageCoords.y - rectPageCoords.height});
        
        const canvasX = topLeftCanvas.x;
        const canvasY = topLeftCanvas.y; 
        const canvasWidth = Math.abs(bottomRightCanvas.x - topLeftCanvas.x);
        const canvasHeight = Math.abs(bottomRightCanvas.y - topLeftCanvas.y); 

        if (canvasWidth <=0 || canvasHeight <=0) return null;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvasWidth;
        tempCanvas.height = canvasHeight;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return null;

        tempCtx.drawImage(
            pdfCanvas,
            canvasX, canvasY, canvasWidth, canvasHeight, 
            0, 0, canvasWidth, canvasHeight 
        );
        tempCtx.drawImage(
            annCanvas,
            canvasX, canvasY, canvasWidth, canvasHeight,
            0, 0, canvasWidth, canvasHeight
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
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        style={{ 
            cursor: selectedTool === Tool.PEN ? 'crosshair' : 
                    selectedTool === Tool.ERASER ? 'grab' : 
                    selectedTool === Tool.TEXT ? 'text' :
                    selectedTool === Tool.LATEX_SELECT ? 'copy' :
                    selectedTool === Tool.SELECT ? 'move' : 'default',
            touchAction: 'none' 
        }}
      />
      {textInput && pageViewport && ( 
        <textarea
          autoFocus
          value={textInput.value}
          onChange={handleTextInputChange}
          onKeyDown={handleTextInputKeyDown}
          onBlur={handleTextSubmit} 
          style={{
            position: 'absolute', 
            left: `${textInput.x}px`,
            top: `${textInput.y}px`,
            fontSize: `${DEFAULT_TEXT_FONT_SIZE_PDF_POINTS * pageViewport.scale}px`, 
            lineHeight: `${DEFAULT_TEXT_FONT_SIZE_PDF_POINTS * pageViewport.scale * 1.2}px`,
            border: '1px dashed gray',
            background: 'rgba(255,255,255,0.95)',
            color: textColor, 
            zIndex: 20, 
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
      {/* Render LaTeX annotations using react-katex */}
      {pageViewport && annotations
        .filter(ann => ann.type === 'latex')
        .map(ann => {
          const latexAnn = ann as RenderedLatexAnnotation;
          // Calculate canvas coordinates for the top-left of the LaTeX annotation
          const canvasPoint = getCanvasCoordinatesFromPdf({ x: latexAnn.x, y: latexAnn.y });
          
          return (
            <div
              key={latexAnn.id}
              id={`latex-container-${latexAnn.id}`} // Useful for debugging
              style={{
                position: 'absolute',
                pointerEvents: 'none', // Allow clicks to pass through to the canvas unless SELECT tool needs to interact
                zIndex: 15, // Above canvas, below active text input
                left: `${canvasPoint.x}px`, // Position relative to the parent (PdfAnnotator div)
                top: `${canvasPoint.y}px`,  // Position relative to the parent
                color: latexAnn.color,
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'top left',
              }}
            >
              <ReactKatex.InlineMath math={latexAnn.latexString} />
            </div>
          );
      })}
      <div className="print-only hidden">
          <h2>{pdfFileName} - Page {currentPageNum}</h2>
      </div>
    </div>
  );
});

export default PdfAnnotator;
