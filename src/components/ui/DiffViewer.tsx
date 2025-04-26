import React from 'react';
import HtmlDiff from 'htmldiff-js';

interface DiffViewerProps {
  oldString: string | null | undefined;
  newString: string | null | undefined;
}

const DiffViewer: React.FC<DiffViewerProps> = ({ oldString, newString }) => {
  const oldContent = oldString ?? '';
  const newContent = newString ?? '';

  // Use htmldiff-js to compute the diff
  const diffHtml = HtmlDiff.execute(oldContent, newContent);

  // Basic styling for the diff tags
  const diffStyles = `
    .htmldiff {
      overflow-x: auto; /* Handle potential overflow */
    }
    .htmldiff ins {
      background-color: rgba(0, 255, 0, 0.2);
      text-decoration: none;
    }
    .htmldiff del {
      background-color: rgba(255, 0, 0, 0.2);
      text-decoration: line-through;
    }
  `;

  return (
    <div className="text-sm p-2 border rounded bg-gray-50 dark:bg-gray-800 max-h-48 overflow-y-auto whitespace-normal break-words">
      {/* Inject the styles */}
      <style>{diffStyles}</style>
      {/* Render the diff HTML using dangerouslySetInnerHTML */}
      <div 
        className="htmldiff prose dark:prose-invert prose-sm max-w-none" 
        dangerouslySetInnerHTML={{ __html: diffHtml }}
      />
      
      {/* Conditional rendering for empty/no changes - check raw output */}
       {(diffHtml === oldContent && diffHtml === newContent && diffHtml !== '') && (
         <span className="text-gray-500 italic">No changes detected.</span>
       )}
       {oldContent === '' && newContent === '' && (
          <span className="text-gray-500 italic">No content provided for comparison.</span>
      )}
    </div>
  );
};

export default DiffViewer; 