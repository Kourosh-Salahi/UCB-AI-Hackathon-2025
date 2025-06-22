import React from 'react';
import { Tool } from '../types';

interface ToolbarProps {
  selectedTool: Tool;
  onToolChange: (tool: Tool) => void;
  currentColor: string;
  onColorChange: (color: string) => void;
  currentSize: number;
  onSizeChange: (size: number) => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  selectedTool,
  onToolChange,
  currentColor,
  onColorChange,
  currentSize,
  onSizeChange
}) => {
  return (
    <div className="flex items-center gap-4 p-4 bg-gray-100 border-b border-gray-200">      <div className="flex gap-2">
        <button
          className={`p-2 rounded ${selectedTool === Tool.PEN ? 'bg-blue-500 text-white' : 'bg-white'}`}
          onClick={() => onToolChange(Tool.PEN)}
          title="Draw on the PDF"
        >
          ✏️ Pen
        </button>
        <button
          className={`p-2 rounded ${selectedTool === Tool.ERASER ? 'bg-blue-500 text-white' : 'bg-white'}`}
          onClick={() => onToolChange(Tool.ERASER)}
          title="Erase handwriting"
        >
          🧽 Eraser
        </button>
        <button
          className={`p-2 rounded ${selectedTool === Tool.LATEX ? 'bg-blue-500 text-white' : 'bg-white'}`}
          onClick={() => onToolChange(Tool.LATEX)}
          title="Convert handwriting to LaTeX text on the PDF"
        >
          🧮 Convert to LaTeX
        </button>
        <button
          className={`p-2 rounded ${selectedTool === Tool.ASK_AI ? 'bg-blue-500 text-white' : 'bg-white'}`}
          onClick={() => onToolChange(Tool.ASK_AI)}
          title="Get AI tutoring help on current work"
        >
          🤖 Ask AI Tutor
        </button>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="color">Color:</label>
        <input
          type="color"
          id="color"
          value={currentColor}
          onChange={(e) => onColorChange(e.target.value)}
          className="w-8 h-8"
        />
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="size">Size:</label>
        <input
          type="range"
          id="size"
          min="1"
          max="10"
          value={currentSize}
          onChange={(e) => onSizeChange(Number(e.target.value))}
          className="w-32"
        />
      </div>
    </div>
  );
};

export default Toolbar;
