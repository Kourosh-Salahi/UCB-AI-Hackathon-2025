import React, { useEffect, useRef } from 'react';
import { Tool } from '../types';

interface PdfAnnotatorProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  currentTool: Tool;
  onStartDrawing: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onDraw: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onStopDrawing: () => void;
}

const PdfAnnotator: React.FC<PdfAnnotatorProps> = ({
  canvasRef,
  currentTool,
  onStartDrawing,
  onDraw,
  onStopDrawing
}) => {
  // Create a reference for the cursor canvas
  const cursorCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Define the cursor styles based on the current tool
  const getCursorStyle = () => {
    switch (currentTool) {
      case Tool.ERASER:
        return 'none'; // We'll draw our own cursor
      case Tool.LATEX:
        return 'crosshair';
      case Tool.PEN:
        return 'default';
      default:
        return 'default';
    }
  };
    // Handle custom cursor drawing
  useEffect(() => {
    if (!cursorCanvasRef.current || currentTool !== Tool.ERASER) return;
    
    const canvas = cursorCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Match cursor canvas size to main canvas
    if (canvasRef.current) {
      canvas.width = canvasRef.current.width;
      canvas.height = canvasRef.current.height;
    }
      // Function to draw the eraser cursor
    const drawEraserCursor = (x: number, y: number) => {
      const eraserRadius = 20; // Should match the eraser radius in App.tsx
      
      // Clear previous cursor
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw open circle cursor - simple black circle with no crosshair
      ctx.beginPath();
      ctx.arc(x, y, eraserRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)'; // Black outline
      ctx.lineWidth = 2;
      ctx.stroke();
    };
    
    // Handle mouse movement to update cursor position
    const handleMouseMove = (e: MouseEvent) => {
      if (currentTool !== Tool.ERASER) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      drawEraserCursor(x, y);
    };
    
    // Using document as the listener to ensure we capture all movements
    document.addEventListener('mousemove', handleMouseMove);
    
    // Initialize cursor at center of visible area
    if (canvasRef.current && canvasRef.current.getBoundingClientRect().width > 0) {
      const rect = canvasRef.current.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      drawEraserCursor(centerX, centerY);
    }
    
    // Clean up
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [currentTool, canvasRef]);
  
  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        onMouseDown={onStartDrawing}
        onMouseMove={onDraw}
        onMouseUp={onStopDrawing}
        onMouseLeave={onStopDrawing}
        style={{ cursor: getCursorStyle() }}
        className="absolute top-0 left-0"
      />
      {currentTool === Tool.ERASER && (
        <canvas
          ref={cursorCanvasRef}
          className="absolute top-0 left-0 pointer-events-none"
          style={{ zIndex: 20 }}
        />
      )}
    </div>
  );
};

export default PdfAnnotator;
