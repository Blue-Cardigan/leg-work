'use client';

import React from 'react';
import { useAppStore } from '@/lib/store/useAppStore'; // Adjust path if needed
import sanitizeHtml from 'sanitize-html';

// Allowed tags and attributes for sanitized intro text
const sanitizeOptions = {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'h3', 'p', 'ul', 'ol', 'li', 'blockquote', 'a', 'strong', 'em', 'u', 'span', 'br', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td']),
    allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        a: ['href', 'name', 'target'],
        img: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading'],
        '*': ['class', 'id', 'style'] // Allow class, id, style globally (be cautious with style)
    },
    // Allow style attribute with specific safe properties if needed, otherwise remove it
    // allowedStyles: { '* ': { 'color ': [/^#(0x)?[0-9a-f]+$/i, /^rgb\(/] } }
};

export default function MainContent() {
  const { selectedLegislation, selectedLegislationContent, isLoadingContent } = useAppStore();

  if (isLoadingContent) {
    return (
      <div className="flex-grow p-6 flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <svg className="animate-spin h-8 w-8 text-blue-500 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading content...
        </div>
      </div>
    );
  }

  if (!selectedLegislation) {
    return <div className="flex-grow p-6 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900">Select legislation from the sidebar to view its content.</div>;
  }

  // Handle the case where loading is finished but content failed to load or doesn't exist
  if (!selectedLegislationContent) {
      return <div className="flex-grow p-6 text-center text-gray-400 bg-white dark:bg-gray-900">No content available or failed to load for this item.</div>;
  }

  const { introHtml, toc } = selectedLegislationContent;
  // Sanitize only if introHtml is not null
  const cleanIntroHtml = introHtml ? sanitizeHtml(introHtml, sanitizeOptions) : null;


  return (
    <div className="flex-grow p-6 overflow-y-auto bg-white dark:bg-gray-900">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">{selectedLegislation.title}</h1>

      {/* Display Introductory Text */}
      {cleanIntroHtml ? (
         <div className="prose dark:prose-invert max-w-none mb-6 legislation-intro" dangerouslySetInnerHTML={{ __html: cleanIntroHtml }} />
      ) : (
        // Explicitly check if introHtml is null (meaning fetch happened but no intro was found)
        // vs. selectedLegislationContent being null (meaning fetch failed or didn't happen)
        introHtml === null &&
        <p className="text-gray-500 dark:text-gray-400 italic mb-6">No introductory text found for this document.</p>
      )}


      {/* Display Table of Contents */}
      {toc && toc.length > 0 && (
          <details className="mb-6 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700" open>
              <summary className="cursor-pointer p-3 font-semibold text-lg text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t list-none">
                  Table of Contents
              </summary>
              <ul className="p-4 border-t border-gray-200 dark:border-gray-700">
                  {toc.map((item, index) => (
                      <li key={`${item.fullHref}-${index}`} style={{ marginLeft: `${item.level * 1.5}rem` }} className="mb-1">
                          {/* Links don't navigate yet, just display */}
                           <span className="text-sm text-blue-600 dark:text-blue-400 hover:underline" title={item.fullHref}>
                               {item.title}
                           </span>
                      </li>
                  ))}
              </ul>
          </details>
      )}

      {/* Placeholder for actual editor/viewer */}
      {/* <div className="mt-6 border-t pt-4 border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 italic">Legislation content viewer/editor will go here.</p>
      </div> */}
    </div>
  );
} 