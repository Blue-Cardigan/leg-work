'use client';

import React from 'react';
import { useAppStore, TocItem, LegislationContent } from '@/lib/store/useAppStore'; // Adjust path if needed
import LegislationEditor from './LegislationEditor'; // Import the Tiptap component

// Helper function to generate safe IDs from titles or hrefs
const generateSafeId = (input: string): string => {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ') // Remove invalid chars
        .trim()
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-'); // Replace multiple hyphens with single
};

export default function MainContent() {
  const { 
    selectedLegislation, 
    selectedLegislationContent, 
    isLoadingContent,
    updateIntroHtml,
    updateSectionHtml
  } = useAppStore();

  console.log('[MainContent] Rendering. isLoading:', isLoadingContent, 'Content:', selectedLegislationContent);

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

  if (!selectedLegislationContent) {
      console.log('[MainContent] Error: selectedLegislationContent is falsy after loading.', selectedLegislationContent);
      return <div className="flex-grow p-6 text-center text-gray-400 bg-white dark:bg-gray-900">No content available or failed to load for this item.</div>;
  }

  const { introHtml, toc } = selectedLegislationContent;

  return (
    <div className="flex-grow p-6 overflow-y-auto bg-white dark:bg-gray-900">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">{selectedLegislation.title}</h1>

      {/* Display Introductory Text using Tiptap */}
      {introHtml !== null ? (
         <div className="prose dark:prose-invert max-w-none mb-6 legislation-intro">
           <LegislationEditor 
             content={introHtml} 
             editable={true} 
             onChange={updateIntroHtml} 
           />
         </div>
      ) : (
        <p className="text-gray-500 dark:text-gray-400 italic mb-6">No introductory text found for this document.</p>
      )}

      {/* Display Navigable Table of Contents */}
      {toc && toc.length > 0 && (
          <details className="mb-8 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 sticky top-0 z-10" open>
              <summary className="cursor-pointer p-3 font-semibold text-lg text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t list-none">
                  Table of Contents
              </summary>
              <ul className="p-4 border-t border-gray-200 dark:border-gray-700 max-h-60 overflow-y-auto">
                  {toc.map((item: TocItem, index: number) => {
                      // Generate a unique ID for linking. Use title or part of href.
                      const sectionId = generateSafeId(item.title || `section-${index}`);
                      // Check if it's a placeholder heading link
                      const isHeading = item.fullHref.includes('#heading-');
                      return (
                          <li key={`${item.fullHref}-${index}`} style={{ marginLeft: `${item.level * 1.5}rem` }} className="mb-1">
                             {/* Render as plain text if it's just a heading, otherwise render link */}
                             {isHeading ? (
                                <span 
                                   className="text-sm text-gray-700 dark:text-gray-300 font-semibold"
                                   title={item.title} // Add title for accessibility/tooltip
                                >
                                   {item.title}
                                </span>
                             ) : (
                                <a
                                    href={`#${sectionId}`}
                                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                    title={`Jump to: ${item.title}`}
                                >
                                    {item.title}
                                </a>
                             )}
                          </li>
                      );
                   })}
              </ul>
          </details>
      )}

      {/* Display Content Sections */}
      <div className="legislation-content space-y-6">
        {toc && toc.length > 0 ? (
             toc.map((item: TocItem, index: number) => {
                // Skip rendering content sections for placeholder headings
                if (item.fullHref.includes('#heading-')) {
                    return null; 
                }
                const sectionId = generateSafeId(item.title || `section-${index}`);
                const sectionHtml = selectedLegislationContent.sectionsHtml?.[item.fullHref];

                return (
                  <section key={item.fullHref} id={sectionId} className="legislation-section border-t border-gray-200 dark:border-gray-700 pt-4 scroll-mt-20">
                      <h2 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">{item.title}</h2>
                       {/* Use Tiptap Editor for section content */}
                       <div className="prose dark:prose-invert max-w-none">
                          <LegislationEditor 
                             content={sectionHtml} 
                             editable={true} 
                             onChange={(newHtml) => updateSectionHtml(item.fullHref, newHtml)}
                          /> 
                          {/* Fallback if sectionHtml is null/undefined initially */}
                          {!sectionHtml && <p className="text-gray-500 italic">Content loading or not available...</p>}
                       </div>
                  </section>
                );
            })
        ) : (
             // Update condition to check introHtml directly
            introHtml === null && <p className="text-gray-500 dark:text-gray-400 italic mt-6">No content sections found for this document.</p>
        )}
      </div>

       {/* Link to original source */}
       {selectedLegislation && selectedLegislation.href && (
         <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
           <a 
             href={selectedLegislation.href} 
             target="_blank" 
             rel="noopener noreferrer"
             className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
           >
             View Original Source on legislation.gov.uk
           </a>
         </div>
       )}

    </div>
  );
}