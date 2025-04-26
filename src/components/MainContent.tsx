'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore, TocItem, LegislationContent, Comment } from '@/lib/store/useAppStore'; // Adjust path if needed
import LegislationEditor from './LegislationEditor'; // Import the Tiptap component
import LegislationToolbar from './LegislationToolbar'; // Import the toolbar
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Reverting to standard Shadcn path
import { Terminal, Loader2, Eye, Pencil, GitCompareArrows, X, AlertCircle } from "lucide-react"; // Removed MessageSquare, added Loader2, Eye, Pencil, GitCompareArrows, X
import { useInView } from 'react-intersection-observer'; // Import useInView
import CommentInputSidebar from './CommentInputSidebar';
import { Editor } from '@tiptap/core';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group" // Import ToggleGroup
import { createClient } from '@/lib/supabaseClient'; // Import Supabase client factory

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
  // onSectionVisible: (id: string) => void; // Likely no longer needed
}
// --- END NEW ---

// --- ProposedChange Type (Mirrored from Dashboard) ---
interface ProposedChange {
    id: number;
    created_at: string;
    user_id: string;
    legislation_id: string;
    legislation_title: string;
    section_key: string; // This might be 'fullDocument' for our current setup
    section_title: string; // Might be the legislation title
    original_html: string | null; // Original HTML of the *entire* document at time of change? Needs clarification.
    proposed_html: string | null; // Proposed HTML for the *entire* document
    status: string;
    context_before: string | null; // Less relevant for full document changes?
    context_after: string | null; // Less relevant for full document changes?
}
// --- END ProposedChange Type ---

export default function MainContent({ }: MainContentProps) { // Props might be empty now
  const {
    selectedLegislation,
    // selectedLegislationContent, // We'll use fullDocumentHtml now
    isLoadingContent,
    fullDocumentHtml, // Use combined HTML state
    setFullDocumentHtml, // Use action for combined HTML
    submitStatus, // Keep for displaying messages
    fetchComments, // Still needed if comments fetched based on legislation ID
    addComment,
    setFocusedMarkId, // Action to set focus
    focusedMarkId, // State to react to focus changes
    // Removed state/actions related to buttons moved to LeftSidebar:
    // hasUnsavedChanges, submitChangesForReview, resetContent, isCommentSidebarOpen, comments
  } = useAppStore();

  // State for managing the comment *input* sidebar specifically
  const [showCommentInputFor, setShowCommentInputFor] = useState<string | null>(null);
  // const [activeSectionKeyForComment, setActiveSectionKeyForComment] = useState<string | null>(null); // Section key may be less relevant now
  const supabase = createClient(); // Initialize Supabase client
  const mainContentRef = useRef<HTMLDivElement>(null); // Ref for the main scrollable area
  const editorRef = useRef<any>(null); // Ref to potentially access editor instance if needed

  // --- Fetch comments when legislation changes (Keep this) ---
  // This assumes CommentDisplaySidebar is rendered elsewhere based on store state
  useEffect(() => {
    if (selectedLegislation?.identifier) {
      fetchComments(selectedLegislation.identifier); // Fetch comments for the selected legislation
    }
  }, [selectedLegislation, fetchComments]);
  // ----------------------------------------------------------

  console.log('[MainContent] Rendering. isLoading:', isLoadingContent, 'fullDocumentHtml:', fullDocumentHtml?.substring(0, 100) + '...');

  // Function to scroll to a mark and set focus (Keep this)
  const handleScrollToMark = useCallback((markId: string) => {
    console.log(`[MainContent] Scrolling to markId: ${markId}`);
    setFocusedMarkId(markId); // Set focus in the store

    if (!mainContentRef.current) return;

    // Find the element using data-mark-id within the scrollable area
    const markElement = mainContentRef.current.querySelector(`span[data-mark-id="${markId}"]`);

    if (markElement) {
      markElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add highlight effect
      markElement.classList.add('scroll-target-highlight');
      setTimeout(() => {
        markElement.classList.remove('scroll-target-highlight');
      }, 2000);
    } else {
      console.warn(`Could not find mark element with ID: ${markId}`);
    }
  }, [setFocusedMarkId]); // Dependency on setFocusedMarkId

  // --- State for editor instance ---
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);

  // --- Handler to receive editor instance ---
  const handleEditorReady = useCallback((editor: Editor) => {
     console.log("[MainContent] Editor instance received", !!editor); // Log if editor is received
     setEditorInstance(editor);
  }, []);

  // Effect to scroll when focusedMarkId changes externally (e.g., clicking comment card)
  useEffect(() => {
    if (focusedMarkId && mainContentRef.current) {
       // Check if the element is already visible to prevent unnecessary scrolling
       const markElement = mainContentRef.current.querySelector(`span[data-mark-id="${focusedMarkId}"]`);
       if (markElement) {
           const rect = markElement.getBoundingClientRect();
           const parentRect = mainContentRef.current.getBoundingClientRect();
           if (rect.top < parentRect.top || rect.bottom > parentRect.bottom) {
               console.log(`[MainContent] External focus change detected, scrolling to markId: ${focusedMarkId}`);
               handleScrollToMark(focusedMarkId);
           } else {
               // Optionally still apply highlight even if already visible
                markElement.classList.add('scroll-target-highlight');
                setTimeout(() => {
                    markElement.classList.remove('scroll-target-highlight');
                }, 2000);
                console.log(`[MainContent] External focus change detected, markId ${focusedMarkId} already in view.`);
           }
       } else {
            console.warn(`[MainContent] Could not find element for externally focused markId: ${focusedMarkId}`);
       }
    }
  }, [focusedMarkId, handleScrollToMark]);


  // Function triggered by the toolbar's "Add Comment" button
  const handleToolbarAddCommentClick = (markId: string) => {
    console.log(`[MainContent] Add comment triggered for markId: ${markId}`);
    setShowCommentInputFor(markId);
    // setActiveSectionKeyForComment('fullDocument'); // Associate with the whole document for now
    // Optional: Scroll the new mark into view after it's added and the input opens
    setTimeout(() => handleScrollToMark(markId), 100);
  };

  // Function to close comment input
  const handleCommentInputClose = () => {
    console.log("[MainContent] Closing comment input sidebar");
    setShowCommentInputFor(null);
    // setActiveSectionKeyForComment(null);
  };

  // Function to submit comment (Keep this, triggered by CommentInputSidebar)
  const handleCommentSubmit = async (commentData: {
        comment_text: string;
        legislation_id: string;
        section_key: string; // Still needed for backend/storage logic
        mark_id: string;
    }) => {
      console.log("[MainContent] Submitting comment via API call:", commentData);
      // The actual API call logic remains the same
      try {
          const response = await fetch('/api/comments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({...commentData, section_key: 'fullDocument' }), // Force section_key for now
          });

          if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
          }

          const newComment: Comment = await response.json();
          console.log("[MainContent] Comment submitted successfully, adding to store:", newComment);

          addComment(newComment); // Use Zustand action

          // Use submitStatus for feedback, but maybe a different state is better for comments?
          // setSubmitStatus({ type: 'success', message: 'Comment added!'});
          // setTimeout(() => setSubmitStatus(null), 3000);

          handleCommentInputClose(); // Close input sidebar on success

      } catch (error: any) {
          console.error("[MainContent] Failed to submit comment:", error);
          // setSubmitStatus({ type: 'error', message: `Comment submission failed: ${error.message}` });
          // Display error within the input sidebar itself?
          throw error; // Re-throw for the input sidebar to handle
      }
  };

  // --- NEW: View Mode State ---
  type ViewMode = 'view' | 'changes' | 'edit';
  const [viewMode, setViewMode] = useState<ViewMode>('view');
  const [explanatoryNoteHtml, setExplanatoryNoteHtml] = useState<string | null>(null);
  const [isExplanatoryNoteVisible, setIsExplanatoryNoteVisible] = useState<boolean>(true);
  // State to hold changes for diff view (will fetch later)
  const [allPendingChanges, setAllPendingChanges] = useState<ProposedChange[]>([]);
  const [isLoadingChanges, setIsLoadingChanges] = useState<boolean>(false);
  const [changesError, setChangesError] = useState<string | null>(null);
  const [baseHtmlForDiff, setBaseHtmlForDiff] = useState<string | null>(null); // New state for base HTML
  // --- END NEW ---

  // --- NEW: Extract Explanatory Note ---
  useEffect(() => {
    if (fullDocumentHtml && viewMode === 'view') {
        // Attempt to extract explanatory note (adjust selector as needed)
        // Common IDs used in legislation.gov.uk are 'note' or elements within a specific structure.
        // Let's try a common pattern first.
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = fullDocumentHtml;
        // Look for a div with id="note" or the specific structure from the example
        const noteElement = tempDiv.querySelector('#note, .LegContentsItem span.LegContentsNo a[href$="/note"]')?.closest('.LegContentsEntry') || tempDiv.querySelector('div#explanatory-note'); // Added fallback

        if (noteElement) {
            console.log("[MainContent] Explanatory Note element found.");
            setExplanatoryNoteHtml(noteElement.outerHTML);
            setIsExplanatoryNoteVisible(true); // Show it when new content loads
            // Optional: Modify the main HTML *carefully* to remove the note to avoid duplication.
            // This is complex and risky. A better approach might be to hide it via CSS in the editor's view mode.
            // For now, we'll just display it separately.
        } else {
            console.log("[MainContent] Explanatory Note element not found with selectors.");
            setExplanatoryNoteHtml(null);
        }
    } else {
        // Clear note if not in view mode or no HTML
        setExplanatoryNoteHtml(null);
    }
  }, [fullDocumentHtml, viewMode]);
  // --- END NEW ---

  // --- Fetch ALL Pending Changes ---
  useEffect(() => {
    const fetchAllChanges = async () => {
        if (!selectedLegislation?.identifier) return;

        console.log(`[MainContent] Fetching all pending changes for ${selectedLegislation.identifier}`);
        setIsLoadingChanges(true);
        setChangesError(null);
        setAllPendingChanges([]);
        setBaseHtmlForDiff(null); // Reset base HTML

        try {
             // **IMPORTANT:** Fetching *all* changes usually requires specific permissions.
             // The standard RLS allows users to see only their own.
             // We likely need a Supabase RPC function (`get_all_pending_changes`)
             // defined with `SECURITY DEFINER` or adjust RLS for specific roles.
             // Using RPC is generally safer.

            // Placeholder for RPC call:
            const { data, error } = await supabase.rpc('get_all_pending_changes_for_legislation', {
                p_legislation_id: selectedLegislation.identifier
            });

            // Fallback/Alternative (if RLS allows or for testing):
            // const { data, error } = await supabase
            //     .from('proposed_changes')
            //     .select('*')
            //     .eq('legislation_id', selectedLegislation.identifier)
            //     .eq('status', 'pending')
            //     .order('created_at', { ascending: true }); // Oldest first might be better for applying diffs

            if (error) {
                console.error("[MainContent] Error fetching all pending changes:", error);
                throw error;
            }

            const fetchedChanges = (data as ProposedChange[]) || [];
            console.log(`[MainContent] Fetched ${fetchedChanges.length} pending changes.`);
            setAllPendingChanges(fetchedChanges);

            // Determine the base HTML for comparison
            if (fetchedChanges.length > 0) {
                // The original HTML *before* the very first pending change
                setBaseHtmlForDiff(fetchedChanges[0].original_html);
            } else {
                 // If no pending changes, the base is the current document for diffing purposes (no diffs)
                 setBaseHtmlForDiff(fullDocumentHtml);
            }

        } catch (err: any) {
            console.error("[MainContent] Failed to fetch all pending changes:", err);
            setChangesError(err.message || "Failed to load pending changes.");
            setAllPendingChanges([]);
            setBaseHtmlForDiff(null);
        } finally {
            setIsLoadingChanges(false);
        }
    };

    if (selectedLegislation?.identifier && (viewMode === 'changes' || viewMode === 'edit')) {
        fetchAllChanges();
    } else {
        setAllPendingChanges([]);
        setChangesError(null);
        setBaseHtmlForDiff(null); // Clear base HTML if not in relevant modes
    }
    // Add supabase to dependencies
  }, [selectedLegislation, viewMode, supabase, fullDocumentHtml]);
  // --- END Fetch ---

  // --- Loading State ---
  if (isLoadingContent) {
    return (
      <div className="flex-grow p-6 flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <Loader2 className="animate-spin h-8 w-8 text-blue-500 mx-auto mb-2" />
          Loading content...
        </div>
      </div>
    );
  }

  // --- No Legislation Selected State ---
  if (!selectedLegislation) {
    return <div className="flex-grow p-6 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900">Select legislation from the sidebar to view its content.</div>;
  }

  // --- No Content State ---
  if (fullDocumentHtml === null) { // Check combined HTML state
      console.log('[MainContent] Error: fullDocumentHtml is null after loading.');
      return <div className="flex-grow p-6 text-center text-gray-400 bg-white dark:bg-gray-900">No content available or failed to load for this item.</div>;
  }

  // --- Main Render ---
  return (
    // Outer container - NOT scrollable, controls overall flex layout
    <div className="flex-grow flex flex-col bg-white dark:bg-gray-900 relative h-full">

        {/* Header Area (Non-Scrolling) */}
        <div className="p-6 pb-2 flex-shrink-0"> {/* Adjusted padding */}
            {/* Document Title */}
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">{selectedLegislation.title}</h1>

            {/* --- NEW: View Mode Toggle --- */}
            <div className="mb-3 flex justify-between items-center">
                 <ToggleGroup type="single" value={viewMode} onValueChange={(value) => { if (value) setViewMode(value as ViewMode) }} size="sm">
                    <ToggleGroupItem value="view" aria-label="View mode">
                        <Eye className="h-4 w-4 mr-1" /> View
                    </ToggleGroupItem>
                    <ToggleGroupItem value="changes" aria-label="View changes mode">
                        <GitCompareArrows className="h-4 w-4 mr-1" /> Changes
                    </ToggleGroupItem>
                    <ToggleGroupItem value="edit" aria-label="Edit mode">
                         <Pencil className="h-4 w-4 mr-1" /> Edit
                    </ToggleGroupItem>
                </ToggleGroup>
                {/* Optional: Add other controls here if needed */}
            </div>
            {/* --- END NEW --- */}

            {/* Submission Status Alert */}
            {submitStatus && (
               <Alert className={`mb-3 ${submitStatus.type === 'error' ? 'border-red-500 text-red-700 dark:text-red-400 dark:border-red-600' : 'border-green-500 text-green-700 dark:text-green-400 dark:border-green-600'}`}>
                <Terminal className="h-4 w-4" />
                <AlertTitle>{submitStatus.type === 'success' ? 'Success' : 'Error'}</AlertTitle>
                <AlertDescription>
                  {submitStatus.message}
                </AlertDescription>
              </Alert>
          )}

            {/* --- NEW: Explanatory Note Display (View Mode Only) --- */}
            {viewMode === 'view' && explanatoryNoteHtml && isExplanatoryNoteVisible && (
                 <Alert variant="default" className="mb-3 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-gray-800 relative">
                     <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                     <AlertTitle className="text-blue-800 dark:text-blue-300">Explanatory Note</AlertTitle>
                     <AlertDescription className="prose dark:prose-invert max-w-none text-sm text-gray-700 dark:text-gray-300">
                          {/* Render the extracted HTML */}
                          <div dangerouslySetInnerHTML={{ __html: explanatoryNoteHtml }} />
                     </AlertDescription>
                     <button
                         onClick={() => setIsExplanatoryNoteVisible(false)}
                         className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                         aria-label="Close explanatory note"
                     >
                         <X className="h-4 w-4" />
                     </button>
                 </Alert>
             )}
             {/* --- END NEW --- */}

            {/* --- NEW: Display Changes Loading/Error --- */}
             {(viewMode === 'changes' || viewMode === 'edit') && isLoadingChanges && (
                <div className="text-sm text-gray-500 dark:text-gray-400 my-2 flex items-center">
                    <Loader2 className="animate-spin h-4 w-4 mr-2" /> Loading changes...
                </div>
             )}
             {(viewMode === 'changes' || viewMode === 'edit') && changesError && (
                 <Alert variant="destructive" className="my-2">
                     <AlertCircle className="h-4 w-4" />
                     <AlertTitle>Error Loading Changes</AlertTitle>
                     <AlertDescription>{changesError}</AlertDescription>
                 </Alert>
             )}
            {/* --- END NEW --- */}

        </div>

        {/* --- Sticky Toolbar Area (Non-Scrolling) --- */}
        {/* Only show toolbar in Edit mode */}
        {viewMode === 'edit' && (
            <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 py-1 px-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                {editorInstance && (
                    <LegislationToolbar
                        editor={editorInstance}
                        onAddCommentClick={handleToolbarAddCommentClick}
                    />
                )}
                {!editorInstance && <div className="h-10 flex items-center text-sm text-gray-400">Toolbar loading...</div>}
            </div>
        )}

        {/* --- Scrollable Editor Area --- */}
        {/* Adjust padding top if toolbar is not visible */}
        <div ref={mainContentRef} className={`flex-grow overflow-y-auto p-6 ${viewMode === 'edit' ? 'pt-2' : 'pt-4'} scroll-smooth`}>
            {/* Single Editor for the whole document */}
            <div className="flex-grow"> {/* Removed prose class, Tiptap usually handles this */}
              { (viewMode === 'changes' || viewMode === 'edit') && baseHtmlForDiff !== null ? (
                  <div className={`border rounded p-4 ${allPendingChanges.length > 0 ? 'bg-yellow-50 dark:bg-gray-800 border-yellow-200 dark:border-yellow-700' : 'bg-gray-50 dark:bg-gray-800'}`}>
                      {allPendingChanges.length > 0 && (
                          <>
                              <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">Pending Changes Overview</h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                  Found {allPendingChanges.length} pending change(s). Differences from the original version may be highlighted below.
                              </p>
                          </>
                      )}
                      {allPendingChanges.length === 0 && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                              No pending changes found. Viewing current document state.
                          </p>
                      )}
                      <LegislationEditor
                          content={fullDocumentHtml} // Always show current state in editor view
                          editable={viewMode === 'edit'}
                          onChange={viewMode === 'edit' ? setFullDocumentHtml : undefined}
                          onAddCommentClick={handleToolbarAddCommentClick}
                          onEditorReady={handleEditorReady}
                          showToolbar={false}
                          // Pass props for diffing
                          baseHtmlForDiff={baseHtmlForDiff}
                          currentHtmlForDiff={fullDocumentHtml}
                      />
                  </div>
              ) : (
                  // View mode OR Edit/Changes mode before changes/base are loaded
                  <LegislationEditor
                      content={fullDocumentHtml}
                      editable={viewMode === 'edit'}
                      onChange={viewMode === 'edit' ? setFullDocumentHtml : undefined}
                      onAddCommentClick={handleToolbarAddCommentClick}
                      onEditorReady={handleEditorReady}
                      showToolbar={false}
                      // No diffing needed here
                      baseHtmlForDiff={null}
                      currentHtmlForDiff={fullDocumentHtml}
                  />
              )}
            </div>
        </div>

         {/* Comment Input Sidebar (positioning might need review based on layout changes) */}
         {/* Only allow adding comments in Edit mode? Or also View Changes? Let's stick to Edit for now */}
         {viewMode === 'edit' && showCommentInputFor && selectedLegislation && (
          <div className="absolute top-0 right-0 h-full z-30">
              <CommentInputSidebar
                 markId={showCommentInputFor}
                 legislationId={selectedLegislation.identifier}
                 sectionKey={'fullDocument'}
                 onSubmit={handleCommentSubmit}
                 onClose={handleCommentInputClose}
              />
          </div>
         )}
    </div>
  );
}