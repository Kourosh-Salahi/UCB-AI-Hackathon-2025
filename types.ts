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
  points: Point[];
  color: string;
  lineWidth: number;
}

export interface TextAnnotation {
  id: string;
  type: 'text';
  x: number; // Position relative to PDF page original size (0,0 is top-left)
  y: number;
  text: string;
  fontSize: number; // in PDF points unit
  color: string;
  width?: number; // Calculated width for rendering/editing
  editing?: boolean; // True if currently being edited
}

export interface RenderedLatexAnnotation {
  id: string;
  type: 'latex';
  x: number; // Position relative to PDF page original size
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

export interface SelectionRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}