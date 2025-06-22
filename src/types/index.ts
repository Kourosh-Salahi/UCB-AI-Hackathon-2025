export enum Tool {
  PEN = "PEN",
  LATEX = "LATEX"
}

export interface Point {
  x: number;
  y: number;
}

export interface StrokeAnnotation {
  type: 'stroke';
  points: Point[];
  color: string;
  lineWidth: number;
}

export interface TextAnnotation {
  type: 'text';
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
}

export interface LatexAnnotation {
  type: 'latex';
  x: number;
  y: number;
  latex: string;
  color: string;
}

export type Annotation = StrokeAnnotation | TextAnnotation | LatexAnnotation;

export interface PdfFile {
  document: any; // PDFDocumentProxy from pdf.js
  file: File;
  totalPages: number;
}
