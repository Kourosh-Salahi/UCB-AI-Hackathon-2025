import React from 'react';
import { Tool } from '../types';
import { ZOOM_LEVELS } from '../constants';

interface ToolbarProps {
  selectedTool: Tool;
  onToolChange: (tool: Tool) => void;
  penColor: string;
  onPenColorChange: (color: string) => void;
  penLineWidth: number;
  onPenLineWidthChange: (width: number) => void;
  onGetTutoringHint: (userQuestion?: string) => void;
  isDisabled: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
}

const ToolButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}> = ({ icon, label, isActive, onClick, disabled }) => (
  <button
    title={label}
    onClick={onClick}
    disabled={disabled}
    className={`p-3 rounded-lg hover:bg-gray-600 transition-colors ${
      isActive ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    {icon}
  </button>
);

const Toolbar: React.FC<ToolbarProps> = ({
  selectedTool,
  onToolChange,
  penColor,
  onPenColorChange,
  penLineWidth,
  onPenLineWidthChange,
  onGetTutoringHint,
  isDisabled,
  currentPage,
  totalPages,
  onPageChange,
  zoomLevel,
  onZoomChange
}) => {
  const handleTutoringHint = () => {
    const question = prompt("Optional: What specific question do you have about your work on this page?");
    onGetTutoringHint(question || undefined);
  };
  
  const commonButtonProps = { disabled: isDisabled };

  return (
    <div className="w-20 bg-gray-800 p-3 flex flex-col space-y-3 print:hidden shadow-lg">
      <ToolButton
        label="Pen Tool"
        icon={<PencilIcon />}
        isActive={selectedTool === Tool.PEN}
        onClick={() => onToolChange(Tool.PEN)}
        {...commonButtonProps}
      />
      <ToolButton
        label="Text Tool"
        icon={<TextIcon />}
        isActive={selectedTool === Tool.TEXT}
        onClick={() => onToolChange(Tool.TEXT)}
        {...commonButtonProps}
      />
      <ToolButton
        label="Eraser Tool"
        icon={<EraserIcon />}
        isActive={selectedTool === Tool.ERASER}
        onClick={() => onToolChange(Tool.ERASER)}
        {...commonButtonProps}
      />
      <ToolButton
        label="Select for LaTeX"
        icon={<LatexIcon />}
        isActive={selectedTool === Tool.LATEX_SELECT}
        onClick={() => onToolChange(Tool.LATEX_SELECT)}
        {...commonButtonProps}
      />
       <ToolButton
        label="Select/Move Tool"
        icon={<SelectIcon />}
        isActive={selectedTool === Tool.SELECT}
        onClick={() => onToolChange(Tool.SELECT)}
        {...commonButtonProps}
      />

      {selectedTool === Tool.PEN && !isDisabled && (
        <div className="p-2 bg-gray-700 rounded-md space-y-2">
          <label htmlFor="penColor" className="text-xs text-gray-400 block">Color</label>
          <input
            type="color"
            id="penColor"
            value={penColor}
            onChange={(e) => onPenColorChange(e.target.value)}
            className="w-full h-8 rounded border border-gray-600"
          />
          <label htmlFor="penWidth" className="text-xs text-gray-400 block mt-1">Width: {penLineWidth}px</label>
          <input
            type="range"
            id="penWidth"
            min="1"
            max="20"
            value={penLineWidth}
            onChange={(e) => onPenLineWidthChange(Number(e.target.value))}
            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      )}

      <div className="mt-auto space-y-3">
         {totalPages > 0 && (
          <div className="flex flex-col items-center text-xs text-gray-400 bg-gray-700 p-2 rounded-md">
            <span>Page {currentPage} of {totalPages}</span>
            <div className="flex mt-1">
              <button onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage <= 1 || isDisabled} className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded-l disabled:opacity-50">-</button>
              <button onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages || isDisabled} className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded-r disabled:opacity-50">+</button>
            </div>
          </div>
        )}
        <div className="flex flex-col items-center text-xs text-gray-400 bg-gray-700 p-2 rounded-md">
           <label htmlFor="zoomLevel" className="text-xs text-gray-400">Zoom: {Math.round(zoomLevel*100)}%</label>
            <select 
              id="zoomLevel" 
              value={zoomLevel} 
              onChange={(e) => onZoomChange(Number(e.target.value))}
              disabled={isDisabled}
              className="bg-gray-600 text-white text-xs rounded p-1 mt-1 w-full"
            >
              {ZOOM_LEVELS.map(level => <option key={level} value={level}>{level*100}%</option>)}
            </select>
        </div>
        <button
          onClick={handleTutoringHint}
          disabled={isDisabled}
          className="w-full p-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center"
        >
          <LightBulbIcon />
          <span className="mt-1">Get Hint</span>
        </button>
      </div>
    </div>
  );
};

// SVG Icons (Heroicons)
const PencilIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" /></svg>;
const TextIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-6.75 3h9m-9 3h9M3.75 8.25h.007v.008H3.75V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 3.75h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>;
const EraserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M11.025 2.222c.75-.104 1.458-.104 2.206 0l7.025 1.756a.75.75 0 0 1 .043 1.33l-2.33 1.036C17.062 6.72 16.038 8 14.626 8H9.373C7.96 8 6.938 6.721 6.108 6.344l-2.33-1.036a.75.75 0 0 1 .043-1.33L11.025 2.222Z M8.25 8.625V18a2.25 2.25 0 0 0 2.25 2.25h3a2.25 2.25 0 0 0 2.25-2.25V8.625m-7.5 0V5.625m7.5 3V5.625" /></svg>;
const LatexIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0-2.51 2.225.569-2.474a.75.75 0 0 0-.319-.698L7.84 12.428M13.684 16.6l2.057-2.057m0 0L18.75 12.25l-1.008-3.36M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Zm0 0a8.949 8.949 0 0 0 5.462-1.657L15.042 21.672Z" /></svg>;
const LightBulbIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.355a7.5 7.5 0 0 1-4.5 0m4.5 0v-.75A2.25 2.25 0 0 0 13.5 14.25H10.5A2.25 2.25 0 0 0 8.25 12V9.75M12 18.75m0-9.75A2.25 2.25 0 0 1 14.25 9H15V7.5A2.25 2.25 0 0 0 12.75 5.25H11.25A2.25 2.25 0 0 0 9 7.5V9h.75A2.25 2.25 0 0 1 12 11.25Zm0-8.25h.008v.008H12V10.5Z" /></svg>;
const SelectIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0-2.51 2.225.569-2.474a.75.75 0 0 0-.319-.698L7.84 12.428M13.684 16.6l2.057-2.057m0 0L18.75 12.25l-1.008-3.36M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Zm0 0a8.949 8.949 0 0 0 5.462-1.657L15.042 21.672Z" /></svg>; // Placeholder select icon, actual mouse pointer is better

export default Toolbar;
