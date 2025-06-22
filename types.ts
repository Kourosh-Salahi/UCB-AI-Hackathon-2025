import type { PDFDocumentProxy } from 'pdfjs-dist';

export enum Tool {
  SELECT = 'SELECT',
  PEN = 'PEN',
  TEXT = 'TEXT',
  ERASER = 'ERASER',
  LATEX_SELECT = 'LATEX_SELECT',
}

export interface Point {
  x: number;
  y: number;
}

export interface StrokeAnnotation {
  id: string;
  type: 'stroke';
  points: Point[]; // Points are stored in canonical PDF user space coordinates
  color: string;
  lineWidth: number; // Represents line width on canvas at 100% zoom
}

export interface TextAnnotation {
  id: string;
  type: 'text';
  // Position of the top-left corner of the text annotation.
  // Stored in canonical PDF user space coordinates (origin typically bottom-left, Y increases upwards).
  x: number; 
  y: number; 
  text: string;
  fontSize: number; // Font size in PDF points unit
  color: string;
  width?: number; // Calculated width for rendering/editing on canvas
  editing?: boolean; // True if currently being edited via HTML textarea
}

export interface RenderedLatexAnnotation {
  id: string;
  type: 'latex';
  // Position of the top-left corner of the LaTeX annotation.
  // Stored in canonical PDF user space coordinates (origin typically bottom-left, Y increases upwards).
  x: number; 
  y: number; 
  latexString: string;
  color: string;
  // originalImageDataUrl?: string; // Optional: store image that generated this
}

export type Annotation = StrokeAnnotation | TextAnnotation | RenderedLatexAnnotation;

export type AnnotationsMap = Record<number, Annotation[]>; // pageNumber (1-indexed) -> Annotation[]

export interface PdfFile {
  name: string;
  url: string; // Object URL
  numPages: number;
  pdfDoc: PDFDocumentProxy; // PDFDocumentProxy from pdf.js
}

// Represents a rectangle, typically in canvas or PDF page coordinates.
// Ensure context defines whether Y increases upwards or downwards.
export interface SelectionRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}