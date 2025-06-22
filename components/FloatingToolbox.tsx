import React, { useState } from 'react';
import { Tool } from '../src/types';
import { ZOOM_LEVELS } from '../constants';

interface FloatingToolboxProps {
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
}> = ({ icon, label, isActive, onClick, disabled }) => (  <button
    title={label}
    onClick={onClick}
    disabled={disabled}    className={`p-3 hover:bg-gray-600 transition-colors ${
      isActive ? 'bg-gray-800 text-white' : 'bg-gray-700 text-gray-100'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} flex items-center justify-center w-14 h-14 rounded-full`}
  >
    {icon}
  </button>
);

const FloatingToolbox: React.FC<FloatingToolboxProps> = ({
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPenSettings, setShowPenSettings] = useState(false);  // Page controls removed as requested
  const [showZoomControls, setShowZoomControls] = useState(false);

  const handleTutoringHint = () => {
    const question = prompt("Optional: What specific question do you have about your work on this page?");
    onGetTutoringHint(question || undefined);
  };
  const handleToolClick = (tool: Tool) => {
    onToolChange(tool);
    // If pen tool is selected, show pen settings
    if (tool === Tool.PEN) {
      setShowPenSettings(true);
      setShowZoomControls(false);
    } else {
      setShowPenSettings(false);
    }
  };
  
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
    // Close all sub-menus when collapsing
    if (isExpanded) {
      setShowPenSettings(false);
      setShowZoomControls(false);
    }
  };return (
    <div className="fixed left-4 top-20 z-50 flex flex-col-reverse items-center gap-3 print:hidden">
      {/* Toolbox Container */}
      <div className="relative">
        {/* Main Button */}        <button
          onClick={toggleExpand}
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-full w-20 h-20 flex items-center justify-center shadow-lg transition-all duration-300"
          style={{ boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)' }}
        >{isExpanded ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
            </svg>
          )}
        </button>        {/* Expanded Toolbox */}
        {isExpanded && (
          <div className="absolute left-0 top-28 flex flex-col gap-5 items-center bg-blue-500 py-8 px-1 transition-all duration-300" style={{ borderRadius: '40px', boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)', width: '80px' }}>
            {/* Pen Tool */}
            <ToolButton
              label="Pen Tool"
              icon={<PencilIcon />}
              isActive={selectedTool === Tool.PEN}
              onClick={() => handleToolClick(Tool.PEN)}
              disabled={isDisabled}
            />
              {/* Text Tool removed as requested */}
            
            {/* Eraser Tool */}
            <ToolButton
              label="Eraser Tool"
              icon={<EraserIcon />}
              isActive={selectedTool === Tool.ERASER}
              onClick={() => handleToolClick(Tool.ERASER)}
              disabled={isDisabled}
            />
            
            {/* LaTeX Selection Tool */}
            <ToolButton
              label="Select for LaTeX"
              icon={<LatexIcon />}
              isActive={selectedTool === Tool.LATEX_SELECT}
              onClick={() => handleToolClick(Tool.LATEX_SELECT)}
              disabled={isDisabled}
            />
            
            {/* Select/Move Tool */}
            <ToolButton
              label="Select/Move Tool"
              icon={<SelectIcon />}
              isActive={selectedTool === Tool.SELECT}
              onClick={() => handleToolClick(Tool.SELECT)}
              disabled={isDisabled}
            />
              {/* Page Controls removed as requested */}
              {/* Zoom Controls */}
            <ToolButton
              label="Zoom Controls"
              icon={<ZoomIcon />}
              isActive={showZoomControls}
              onClick={() => {
                setShowZoomControls(!showZoomControls);
                setShowPenSettings(false);
              }}
              disabled={isDisabled}
            />
            
            {/* AI Tutoring Hint */}
            <ToolButton
              label="Get AI Tutoring Hint"
              icon={<LightBulbIcon />}
              isActive={false}
              onClick={handleTutoringHint}
              disabled={isDisabled}
            />
          </div>
        )}        {/* Pen Settings Popover */}
        {isExpanded && showPenSettings && (
          <div className="absolute left-24 top-28 bg-gray-800 p-4 rounded-lg shadow-lg w-64 transition-all duration-300">
            <h3 className="text-white text-sm font-semibold mb-2">Pen Settings</h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="penColor" className="text-xs text-gray-400 block">Color</label>
                <input
                  type="color"
                  id="penColor"
                  value={penColor}
                  onChange={(e) => onPenColorChange(e.target.value)}
                  className="w-full h-8 rounded border border-gray-600"
                />
              </div>
              <div>
                <label htmlFor="penWidth" className="text-xs text-gray-400 block">Width: {penLineWidth}px</label>
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
              <button 
                onClick={() => setShowPenSettings(false)} 
                className="text-xs text-gray-400 hover:text-white mt-2"
              >
                Close
              </button>
            </div>
          </div>
        )}        {/* Page Controls Popover removed */}{/* Zoom Controls Popover */}
        {isExpanded && showZoomControls && (
          <div className="absolute left-24 top-28 bg-gray-800 p-4 rounded-lg shadow-lg w-64 transition-all duration-300">
            <h3 className="text-white text-sm font-semibold mb-2">Zoom Controls</h3>
            <div className="flex flex-col items-center text-xs text-gray-400">
              <label htmlFor="zoomLevel" className="mb-2">Zoom: {Math.round(zoomLevel*100)}%</label>
              <select 
                id="zoomLevel" 
                value={zoomLevel} 
                onChange={(e) => onZoomChange(Number(e.target.value))}
                disabled={isDisabled}
                className="bg-gray-700 text-white text-xs rounded p-2 w-full"
              >
                {ZOOM_LEVELS.map(level => <option key={level} value={level}>{level*100}%</option>)}
              </select>
              <button 
                onClick={() => setShowZoomControls(false)} 
                className="text-xs text-gray-400 hover:text-white mt-4"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// SVG Icons
const PencilIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" /></svg>;
// TextIcon removed - no longer needed
const EraserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z" /></svg>;
const LatexIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>;
const SelectIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="m15 15-6 6m0 0-6-6m6 6V9a6 6 0 0 1 12 0v3" /></svg>;
const LightBulbIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.355a7.5 7.5 0 0 1-4.5 0m4.5 0v-.75A2.25 2.25 0 0 0 13.5 14.25H10.5A2.25 2.25 0 0 0 8.25 12V9.75M12 18.75m0-9.75A2.25 2.25 0 0 1 14.25 9H15V7.5A2.25 2.25 0 0 0 12.75 5.25H11.25A2.25 2.25 0 0 0 9 7.5V9h.75A2.25 2.25 0 0 1 12 11.25Zm0-8.25h.008v.008H12V10.5Z" /></svg>;
// PageIcon removed - no longer needed
const ZoomIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM10.5 7.5v6m3-3h-6" /></svg>;

export default FloatingToolbox;
