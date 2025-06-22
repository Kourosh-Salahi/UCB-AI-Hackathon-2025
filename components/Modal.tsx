// src/components/Modal.tsx
import React from 'react';
import ReactKatex from 'react-katex'; 
// no CSS import here — your index.html already has the <link>

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const parseAndRenderTextWithLatex = (text: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  // match $$…$$ in group 2 or $…$ in group 4
  const regex = /(\$\$([\s\S]+?)\$\$)|(\$([^$\n]+?)\$)/g;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(text)) !== null) {
    const [full, , display, , inline] = m;
    const start = m.index;

    // plain text before
    if (start > lastIndex) {
      parts.push(
        <span key={`txt-${key++}`} className="katex">
          {text.slice(lastIndex, start)}
        </span>
      );
    }

    // display math
    if (display != null) {
      parts.push(
        <ReactKatex.BlockMath
          key={`blk-${key++}`}
          math={display}
        />
      );
    }
    // inline math
    else if (inline != null) {
      parts.push(
        <ReactKatex.InlineMath
          key={`inl-${key++}`}
          math={inline}
        />
      );
    }

    lastIndex = regex.lastIndex;
  }

  // trailing plain text
  if (lastIndex < text.length) {
    parts.push(
      <span key={`txt-${key++}`} className="katex">
        {text.slice(lastIndex)}
      </span>
    );
  }

  return parts;
};

const Modal: React.FC<ModalProps> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40 p-4 print:hidden">
    <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
      <header className="flex justify-between items-center p-4 border-b border-gray-700">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
          aria-label="Close modal"
        >
          ✕
        </button>
      </header>
      <section className="flex-1 overflow-y-auto p-4">
        <div className="whitespace-pre-wrap text-sm text-white">
          {typeof children === 'string'
            ? parseAndRenderTextWithLatex(children)
            : children}
        </div>
      </section>
      <footer className="p-4 border-t border-gray-700 text-right">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
        >
          Close
        </button>
      </footer>
    </div>
  </div>
);

export default Modal;