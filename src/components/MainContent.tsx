'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAppStore, TocItem, LegislationContent, Comment } from '@/lib/store/useAppStore'; // Adjust path if needed
import LegislationEditor from './LegislationEditor'; // Import the Tiptap component
import CommentDisplaySidebar from './CommentDisplaySidebar'; // Import the new sidebar
import { Button } from '@/components/ui/button'; // Reverting to standard Shadcn path
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Reverting to standard Shadcn path
import { Terminal, MessageSquare } from "lucide-react"; // Added MessageSquare icon
import { useInView } from 'react-intersection-observer'; // Import useInView
import CommentInputSidebar from './CommentInputSidebar';

// Helper function to generate safe IDs from titles or hrefs
const generateSafeId = (input: string): string => {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ') // Remove invalid chars
        .trim()
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-'); // Replace multiple hyphens with single
};

// Component for rendering each section and handling its visibility
interface SectionRendererProps {
  item: TocItem;
  index: number;
  sectionHtml: string | null | undefined;
  onVisible: (id: string) => void; // Callback when section becomes visible
  updateSectionHtml: (href: string, html: string) => void; // Add this prop
  onAddCommentTrigger: (markId: string, sectionKey: string) => void; // Add this prop
}

const SectionRenderer: React.FC<SectionRendererProps> = ({ item, index, sectionHtml, onVisible, updateSectionHtml, onAddCommentTrigger }) => {
  const sectionId = generateSafeId(item.title || `section-${index}`);
  const { ref, inView } = useInView({
      threshold: 0.1, // Trigger when 10% is visible
      rootMargin: '-10% 0px -50% 0px', // Similar margin to previous attempt
      // triggerOnce: false // Keep observing
  });

  useEffect(() => {
    if (inView) {
      onVisible(sectionId);
    }
  }, [inView, sectionId, onVisible]);

  return (
    <section
      ref={ref} // Assign ref from useInView
      key={`${item.fullHref}-${index}`}
      id={sectionId}
      className="legislation-section border-t border-gray-300 dark:border-gray-600 pt-6 scroll-mt-24"
    >
      <h2 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">{item.title}</h2>
      <div className="prose dark:prose-invert max-w-none">
        <LegislationEditor
          content={sectionHtml ?? null} // Default to null if sectionHtml is undefined/null
          editable={true}
          onChange={(newHtml) => {
            // Call the passed update function
            updateSectionHtml(item.fullHref, newHtml);
          }}
          onAddCommentClick={(markId) => onAddCommentTrigger(markId, item.fullHref)}
          // Pass editor instance up if needed later: onEditorReady={(editor) => setSectionEditor(item.fullHref, editor)}
        />
        {!sectionHtml && <p className="text-gray-500 italic">Content loading or not available...</p>}
      </div>
    </section>
  );
};

// --- NEW: Props for MainContent --- 
interface MainContentProps {
  onSectionVisible: (id: string) => void;
}
// --- END NEW ---

export default function MainContent({ onSectionVisible }: MainContentProps) { // Accept prop
  const {
    selectedLegislation,
    selectedLegislationContent,
    isLoadingContent,
    updateIntroHtml,
    updateSectionHtml, // Now correctly destructured
    hasUnsavedChanges,
    submitChangesForReview,
    resetContent,
    fetchComments, // Now exists in store
    comments, // Now exists in store
    addComment,
    setFocusedMarkId, // Get the action
  } = useAppStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isCommentSidebarOpen, setIsCommentSidebarOpen] = useState(false); // State for comment sidebar visibility
  const [showCommentInputFor, setShowCommentInputFor] = useState<string | null>(null); 
  const [activeSectionKeyForComment, setActiveSectionKeyForComment] = useState<string | null>(null);
  const mainContentRef = useRef<HTMLDivElement>(null); // Ref for the main scrollable area

  // Fetch comments when legislation changes or sidebar opens
  useEffect(() => {
    if (selectedLegislation?.identifier && isCommentSidebarOpen) { // Use identifier
      fetchComments(selectedLegislation.identifier);
    }
  }, [selectedLegislation, isCommentSidebarOpen, fetchComments]);

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

  // Function to scroll to the comment span in the DOM
  const handleScrollToComment = (commentId: string) => {
    if (!mainContentRef.current) return;

    // Find the element within the main content area
    // We query the entire main content area because the comment could be in the intro or any section
    const commentElement = mainContentRef.current.querySelector(`span[data-comment-id="${commentId}"]`);

    if (commentElement) {
      commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Optional: Add a temporary highlight effect (ensure CSS is defined elsewhere)
      commentElement.classList.add('scroll-target-highlight');
      setTimeout(() => {
        commentElement.classList.remove('scroll-target-highlight');
      }, 2000); // Remove highlight after 2 seconds
    } else {
      console.warn(`Could not find comment element with ID: ${commentId}`);
      // Optionally show a user message if the element isn't found
    }
  };

  // NEW: Function to scroll to a mark and set focus
  const handleScrollToMark = (markId: string) => {
    console.log(`[MainContent] Scrolling to markId: ${markId}`);
    setFocusedMarkId(markId); // Set focus in the store

    if (!mainContentRef.current) return;
    
    // Find the element using data-mark-id
    const markElement = mainContentRef.current.querySelector(`span[data-mark-id="${markId}"]`);

    if (markElement) {
      markElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Optional: Add a temporary highlight effect (ensure .scroll-target-highlight CSS exists)
      markElement.classList.add('scroll-target-highlight');
      setTimeout(() => {
        markElement.classList.remove('scroll-target-highlight');
      }, 2000); 
    } else {
      console.warn(`Could not find mark element with ID: ${markId}`);
    }
  };

  // NEW: Function to add comment
  const handleToolbarAddCommentClick = (markId: string, sectionKey: string) => {
    console.log(`[MainContent] Add comment triggered for markId: ${markId}, sectionKey: ${sectionKey}`);
    setShowCommentInputFor(markId);
    setActiveSectionKeyForComment(sectionKey);
  };

  // NEW: Function to close comment input
  const handleCommentInputClose = () => {
    console.log("[MainContent] Closing comment input sidebar");
    setShowCommentInputFor(null);
    setActiveSectionKeyForComment(null);
  };

  // NEW: Function to submit comment
  const handleCommentSubmit = async (commentData: { 
        comment_text: string; 
        legislation_id: string; // Should match what API/store expects
        section_key: string; 
        mark_id: string; 
    }) => {
      console.log("[MainContent] Submitting comment via store:", commentData);
      try {
          const response = await fetch('/api/comments', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
              },
              // Ensure body matches API expectation (might need user_id etc added server-side)
              body: JSON.stringify(commentData), 
          });

          if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
          }

          const newComment: Comment = await response.json(); 
          console.log("[MainContent] Comment submitted successfully, adding to store:", newComment);
          
          // Use the Zustand action to add the comment
          addComment(newComment);

          setSubmitStatus({ type: 'success', message: 'Comment added!'});
          setTimeout(() => setSubmitStatus(null), 3000);
          handleCommentInputClose(); // Close input sidebar on success

      } catch (error: any) {
          console.error("[MainContent] Failed to submit comment:", error);
          setSubmitStatus({ type: 'error', message: `Comment submission failed: ${error.message}` });
          // Do not close sidebar on error, let user see message / retry
          // Re-throw so the input sidebar can potentially catch it too (optional)
          throw error; 
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
    // Use Flexbox for layout
    <div className="flex flex-1 h-full overflow-hidden">
      {/* Main scrollable content area */}
      <div ref={mainContentRef} className="flex-grow p-6 overflow-y-auto bg-white dark:bg-gray-900 relative scroll-smooth">

        {/* Sticky Header for Title and Actions */}
        <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 py-4 mb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 truncate pr-4">{selectedLegislation.title}</h1>
            {/* Action Buttons */}
            {selectedLegislation && (
                <div className="flex items-center space-x-2">
                   {/* Comment Toggle Button */}
                   <Button
                     variant="outline"
                     size="sm"
                     onClick={() => setIsCommentSidebarOpen(!isCommentSidebarOpen)}
                     title={isCommentSidebarOpen ? "Hide Comments" : "Show Comments"}
                   >
                     <MessageSquare className="h-4 w-4 mr-1" />
                     {/* Show comment count - make sure comments is an array */}
                     {Array.isArray(comments) && comments.length > 0 ? comments.length : ''} 
                   </Button>

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
               onAddCommentClick={(markId) => handleToolbarAddCommentClick(markId, 'intro')}
             />
           </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 italic mb-6">No introductory text found for this document.</p>
        )}

        {/* Display Content Sections */}
        <div className="legislation-content space-y-6">
          {toc && toc.length > 0 ? (
               toc.map((item: TocItem, index: number) => {
                  if (item.fullHref.includes('#heading-')) {
                      // Render non-linked headings from TOC for structure
                       const headingId = generateSafeId(item.title || `heading-${index}`);
                       return (
                           <h3 key={`${item.fullHref}-${index}`} id={headingId} className="text-lg font-semibold mt-6 mb-2 text-gray-600 dark:text-gray-400" style={{ marginLeft: `${item.level * 1.5}rem` }}>
                              {item.title}
                           </h3>
                       );
                  } else {
                    // Use the correct property name sectionsHtml
                    const sectionHtml = selectedLegislationContent.sectionsHtml?.[item.fullHref];
                    return (
                      <SectionRenderer
                          key={`${item.fullHref}-${index}`}
                          item={item}
                          index={index}
                          sectionHtml={sectionHtml}
                          onVisible={onSectionVisible} // Pass down the received prop
                          updateSectionHtml={updateSectionHtml} // Pass down the function from store
                          onAddCommentTrigger={handleToolbarAddCommentClick}
                      />
                    );
                  }
               })
           ) : (
             introHtml === null && <p className="text-gray-500 dark:text-gray-400 italic mt-6">No content sections found for this document.</p>
           )}
        </div>
      </div> {/* End Main scrollable content area */}

      {/* Conditional Comment Sidebar */}
      {isCommentSidebarOpen && (
        <CommentDisplaySidebar
          onCardClick={handleScrollToMark}
        />
      )}

      {/* Comment Input Sidebar (Rendered on the right) */}
      {showCommentInputFor && activeSectionKeyForComment && selectedLegislation && (
          <CommentInputSidebar 
             markId={showCommentInputFor}
             legislationId={selectedLegislation.identifier} // Use identifier consistent with fetching
             sectionKey={activeSectionKeyForComment}
             onSubmit={handleCommentSubmit}
             onClose={handleCommentInputClose}
          />
      )}
    </div> // End Flex container
  );
}

// Remember to add CSS for temporary scroll highlight (e.g., in global.css or similar)
/* Example:
.scroll-target-highlight {
  background-color: rgba(0, 123, 255, 0.2) !important; 
  transition: background-color 0.3s ease-out;
  border-radius: 3px;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.4);
}
*/