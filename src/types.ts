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
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
  width?: number;
  editing?: boolean;
}

export interface LatexAnnotation {
  id: string;
  type: 'latex';
  x: number;
  y: number;
  latexString: string;
  color: string;
}

export type Annotation = StrokeAnnotation | TextAnnotation | LatexAnnotation;

export type AnnotationsMap = Record<number, Annotation[]>;

export interface SelectionRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfFile {
  name: string;
  url: string;
  numPages: number;
  pdfDoc?: any; // PDFDocumentProxy from pdf.js
}