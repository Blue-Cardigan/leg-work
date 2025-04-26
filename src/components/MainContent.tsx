'use client';

import React, { useState } from 'react';
import { useAppStore, TocItem, LegislationContent } from '@/lib/store/useAppStore'; // Adjust path if needed
import LegislationEditor from './LegislationEditor'; // Import the Tiptap component
import { Button } from '@/components/ui/button'; // Reverting to standard Shadcn path
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Reverting to standard Shadcn path
import { Terminal } from "lucide-react"

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
    updateSectionHtml,
    hasUnsavedChanges, // Get the flag from the store
    submitChangesForReview, // Get the action from the store
    resetContent // Action to discard changes
  } = useAppStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  console.log('[MainContent] Rendering. isLoading:', isLoadingContent, 'Content:', selectedLegislationContent);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitStatus(null);
    console.log("Attempting to submit changes...");
    const result = await submitChangesForReview();
    console.log("Submission result:", result);

    if (result.success) {
        if (result.error && result.error.includes("No changes")) {
             // Handle the case where there were technically no changes
             setSubmitStatus({ type: 'success', message: 'No changes detected or submitted.' });
        } else {
             setSubmitStatus({ type: 'success', message: 'Changes submitted successfully for review!' });
        }
    } else {
        setSubmitStatus({ type: 'error', message: `Submission failed: ${result.error || 'Unknown error'}` });
    }
    setIsSubmitting(false);

    // Optionally hide the message after a delay
    setTimeout(() => setSubmitStatus(null), 5000);
  };

  const handleDiscard = () => {
    if (confirm("Are you sure you want to discard your changes? This cannot be undone.")) {
        console.log("Discarding changes...");
        resetContent();
        setSubmitStatus({ type: 'success', message: 'Changes discarded.'});
        setTimeout(() => setSubmitStatus(null), 3000);
    }
  };

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
    <div className="flex-grow p-6 overflow-y-auto bg-white dark:bg-gray-900 relative">

      {/* Sticky Header for Title and Actions */}
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 py-4 mb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 truncate pr-4">{selectedLegislation.title}</h1>
          {/* Action Buttons */}
          {selectedLegislation && (
              <div className="flex items-center space-x-2">
                 {hasUnsavedChanges && (
                   <Button variant="outline" onClick={handleDiscard} disabled={isSubmitting} size="sm">
                      Discard Changes
                   </Button>
                 )}
                 <Button 
                     onClick={handleSubmit} 
                     disabled={!hasUnsavedChanges || isSubmitting}
                     size="sm"
                     className={hasUnsavedChanges ? "bg-green-600 hover:bg-green-700" : ""}
                 >
                     {isSubmitting ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Submitting...
                        </>
                     ) : 'Submit Changes'}
                 </Button>
              </div>
           )}
        </div>
        {/* Submission Status Alert */}
        {submitStatus && (
             <Alert className={`mt-3 ${submitStatus.type === 'error' ? 'border-red-500 text-red-700 dark:text-red-400 dark:border-red-600' : 'border-green-500 text-green-700 dark:text-green-400 dark:border-green-600'}`}>
              <Terminal className="h-4 w-4" />
              <AlertTitle>{submitStatus.type === 'success' ? 'Success' : 'Error'}</AlertTitle>
              <AlertDescription>
                {submitStatus.message}
              </AlertDescription>
            </Alert>
        )}
      </div>

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
          <details className="mb-8 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 sticky top-[88px] z-10" open> {/* Adjusted sticky top */} 
              <summary className="cursor-pointer p-3 font-semibold text-lg text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t list-none">
                  Table of Contents
              </summary>
              <ul className="p-4 border-t border-gray-200 dark:border-gray-700 max-h-60 overflow-y-auto">
                  {toc.map((item: TocItem, index: number) => {
                      const sectionId = generateSafeId(item.title || `section-${index}`);
                      const isHeading = item.fullHref.includes('#heading-');
                      return (
                          <li key={`${item.fullHref}-${index}`} style={{ marginLeft: `${item.level * 1.5}rem` }} className="mb-1">
                             {isHeading ? (
                                <span 
                                   className="text-sm text-gray-700 dark:text-gray-300 font-semibold"
                                   title={item.title}
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
                if (item.fullHref.includes('#heading-')) {
                    return null; 
                }
                const sectionId = generateSafeId(item.title || `section-${index}`);
                const sectionHtml = selectedLegislationContent.sectionsHtml?.[item.fullHref];

                return (
                  <section key={`${item.fullHref}-${index}`} id={sectionId} className="legislation-section border-t border-gray-200 dark:border-gray-700 pt-4 scroll-mt-20">
                      <h2 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">{item.title}</h2>
                       <div className="prose dark:prose-invert max-w-none">
                          <LegislationEditor 
                             content={sectionHtml} // Pass the section HTML
                             editable={true} 
                             onChange={(newHtml) => {
                                 // Ensure updateSectionHtml exists before calling
                                 if (updateSectionHtml) {
                                     updateSectionHtml(item.fullHref, newHtml);
                                 }
                             }}
                          /> 
                          {!sectionHtml && <p className="text-gray-500 italic">Content loading or not available...</p>}
                       </div>
                  </section>
                );
            })
        ) : (
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