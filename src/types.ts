export enum Tool {
  PEN = "PEN",
  ERASER = "ERASER",
  LATEX = "LATEX",
  ASK_AI = "ASK_AI",
  TEXT = "TEXT",
  SELECT = "SELECT",
  LATEX_SELECT = "LATEX_SELECT"
}

export interface Point {
  x: number;
  y: number;
}

export interface SelectionRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StrokeAnnotation {
  type: 'stroke';
  id: string;
  points: Point[];
  color: string;
  lineWidth: number;
}

export interface TextAnnotation {
  type: 'text';
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  fontSize: number;
  editing?: boolean;
}

export interface LatexAnnotation {
  type: 'latex';
  id: string;
  x: number;
  y: number;
  latex: string;
  latexString?: string;  // For use with react-katex
  color: string;
}

// Interface for latex annotations that have been processed for rendering with react-katex
export interface RenderedLatexAnnotation extends LatexAnnotation {
  latexString: string;  // non-optional for rendered annotations
}

export interface RenderedLatexAnnotation extends LatexAnnotation {
  renderedHtml?: string;
}

export type Annotation = StrokeAnnotation | TextAnnotation | LatexAnnotation;

export interface PdfFile {
  document: any; // PDFDocumentProxy from pdf.js
  file: File;
  totalPages: number;
}