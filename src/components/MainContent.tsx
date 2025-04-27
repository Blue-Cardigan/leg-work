'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore, LegislationContent, Comment, useFocusedMarkId, useActiveCommentInputMarkId, useCommentActions } from '@/lib/store/useAppStore'; // Adjust path if needed
import LegislationEditor from './LegislationEditor'; // Import the Tiptap component
import LegislationToolbar from './LegislationToolbar'; // Import the toolbar
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Reverting to standard Shadcn path
import { Terminal, Loader2, Eye, Pencil, GitCompareArrows, X, AlertCircle, ChevronUp, ChevronDown } from "lucide-react"; // Added ChevronUp/Down
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group" // Import ToggleGroup
import { createClient } from '@/lib/supabaseClient'; // Import Supabase client factory
import { Button } from "@/components/ui/button"; // Import Button for collapse toggle
import { Editor } from '@tiptap/core';

// Helper function to generate safe IDs from titles or hrefs
const generateSafeId = (input: string): string => {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ') // Remove invalid chars
        .trim()
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-'); // Replace multiple hyphens with single
};

// --- NEW: Props for MainContent --- 
type MainContentProps = object; // <-- Use type object instead
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

// --- NEW: Simple Skeleton Loader Component ---
const SkeletonLoader: React.FC = () => (
    <div className="space-y-4 p-6 animate-pulse">
      <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
      <div className="space-y-2">
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded"></div>
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-5/6"></div>
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-4/6"></div>
      </div>
       <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/2 mt-4"></div>
       <div className="space-y-2 pt-4">
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded"></div>
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-5/6"></div>
      </div>
    </div>
  );
// --- END Skeleton Loader ---

export default function MainContent({ }: MainContentProps) { // Props might be empty now
  const {
    selectedLegislation,
    // selectedLegislationContent, // We'll use fullDocumentHtml now
    isLoadingContent,
    fullDocumentHtml, // Use combined HTML state
    setFullDocumentHtml, // Use action for combined HTML
    submitStatus, // Keep for displaying messages
    fetchComments, // Still needed if comments fetched based on legislation ID
    setFocusedMarkId, // Action to set focus
    // Removed state/actions related to buttons moved to LeftSidebar:
    // hasUnsavedChanges, submitChangesForReview, resetContent, isCommentSidebarOpen, comments
  } = useAppStore();
  const focusedMarkId = useFocusedMarkId(); // Use selector hook
  const activeCommentInputMarkId = useActiveCommentInputMarkId(); // Use selector hook
  const { setActiveCommentInputMarkId } = useCommentActions(); // Get specific action

  // --- NEW: Local state for editor content during editing ---
  const [localEditorContent, setLocalEditorContent] = useState<string | null>(null);
  // --- END NEW ---

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
    console.log(`[MainContent] Add comment triggered for markId: ${markId}. Activating input in RightSidebar.`);
    setActiveCommentInputMarkId(markId); // Use store action to set the active mark ID
    // RightSidebar will react to activeCommentInputMarkId and show input
    // Optional: Scroll the new mark into view immediately? 
    setTimeout(() => handleScrollToMark(markId), 100); 
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
  // --- NEW: Collapse state for HEADER area --- Renamed from isEditorCollapsed
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState<boolean>(false);
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

  // --- NEW: Sync local state when entering edit mode or when global HTML changes ---
  useEffect(() => {
      if (viewMode === 'edit') {
          // Initialize local state when entering edit mode
          if (localEditorContent === null) { // Only initialize if not already set
              setLocalEditorContent(fullDocumentHtml);
              console.log("[MainContent] Initialized localEditorContent for edit mode.");
          }
      } else {
           // Clear local state when leaving edit mode
           if (localEditorContent !== null) {
                setLocalEditorContent(null);
                console.log("[MainContent] Cleared localEditorContent.");
           }
      }
      // If the global HTML changes *while not* in edit mode, ensure local state is cleared
      // (e.g., switching legislation resets everything)
      // However, if global HTML changes *while* in edit mode (e.g., due to external update/reset),
      // we might need a strategy (prompt user? discard local changes?). For now, let's keep local changes.
  }, [viewMode, fullDocumentHtml, localEditorContent]); // Rerun when mode or global HTML changes - Added localEditorContent
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
        {/* Use Skeleton Loader during initial load as well for consistency */}
        <SkeletonLoader />
        {/* Original Loader Text:
        <div className="text-center text-gray-500 dark:text-gray-400">
          <Loader2 className="animate-spin h-8 w-8 text-blue-500 mx-auto mb-2" />
          Loading content...
        </div>
        */}
      </div>
    );
  }

  // --- No Legislation Selected State ---
  if (!selectedLegislation) {
    return <div className="flex-grow p-6 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900">Select legislation from the sidebar to view its content.</div>;
  }

  // --- No Content State (After Loading) ---
  // Render Skeleton instead of text if content is null after load attempt
  if (fullDocumentHtml === null && viewMode !== 'edit') {
      console.log('[MainContent] Error: fullDocumentHtml is null after loading (not in edit mode). Showing skeleton.');
      // Return the skeleton loader within the basic header structure
      return (
        <div className="flex-grow flex flex-col bg-white dark:bg-gray-900 relative h-full">
            {/* Render Header Area (potentially collapsed) even when showing skeleton */}
            <div className={`flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${isHeaderCollapsed ? 'max-h-0 p-0 mb-0 invisible opacity-0' : 'p-6 pb-2 visible opacity-100'}`}>
                <div className="flex justify-between items-center mb-3">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{selectedLegislation.title}</h1>
                     {/* Collapse button position might need adjustment here - placing it with toggles */}
                </div>
                 <div className="mb-3 flex justify-between items-center">
                     <ToggleGroup type="single" value={viewMode} onValueChange={(value) => { handleModeChange(value as ViewMode) }} size="sm">
                          {/* Toggle Items - placeholder */}
                           <ToggleGroupItem value="view" aria-label="View mode"><Eye className="h-4 w-4 mr-1" /> View</ToggleGroupItem>
                           <ToggleGroupItem value="changes" aria-label="View changes mode"><GitCompareArrows className="h-4 w-4 mr-1" /> Changes</ToggleGroupItem>
                           <ToggleGroupItem value="edit" aria-label="Edit mode"><Pencil className="h-4 w-4 mr-1" /> Edit</ToggleGroupItem>
                     </ToggleGroup>
                     <Button
                         variant="ghost"
                         size="sm"
                         onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
                         aria-label={isHeaderCollapsed ? "Expand header" : "Collapse header"}
                     >
                         {isHeaderCollapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
                     </Button>
                 </div>
            </div>
            {/* Show Skeleton in the main area */}
            <div className="flex-grow overflow-y-auto">
                <SkeletonLoader />
            </div>
        </div>
      );
  }

  // Allow rendering editor in edit mode even if global HTML was initially null, using local state
  if (viewMode === 'edit' && localEditorContent === null) {
      console.log('[MainContent] Warning: Entering edit mode but localEditorContent is null. Waiting initialization.');
      // Optional: show a specific loading state for edit mode init
      // return <div className="flex-grow p-6 text-center">Initializing editor...</div>;
  }

  // --- Handler for Mode Change ---
  const handleModeChange = (newMode: ViewMode | null) => {
      if (!newMode) return; // Should not happen with single type toggle group

      console.log(`[MainContent] Switching mode from ${viewMode} to ${newMode}`);

      // If switching *away* from edit mode, sync local changes to global store
      if (viewMode === 'edit' && newMode !== 'edit' && localEditorContent !== null) {
          console.log("[MainContent] Syncing localEditorContent to global store (setFullDocumentHtml).");
          setFullDocumentHtml(localEditorContent);
      }

      // Reset collapse state logic removed - collapse is independent of mode now
      // if (newMode !== 'view') {
      //     setIsHeaderCollapsed(false); // Keep header expanded unless explicitly collapsed
      // }

      setViewMode(newMode);

      // If switching *to* edit mode, ensure local state is initialized (handled by useEffect)
      if (newMode === 'edit' && localEditorContent === null) {
           setLocalEditorContent(fullDocumentHtml); // Initialize immediately if needed
           console.log("[MainContent] Immediately initializing localEditorContent for edit mode on switch.");
      } else if (newMode !== 'edit' && localEditorContent !== null) {
          // Clear local state if switching out of edit mode
          setLocalEditorContent(null);
          console.log("[MainContent] Cleared localEditorContent on mode switch away from edit.");
      }
  };
  // --- END NEW ---

  // --- Main Render ---
  return (
    // Outer container - NOT scrollable, controls overall flex layout
    <div className="flex-grow flex flex-col bg-white dark:bg-gray-900 relative h-full">

        {/* Header Area (Non-Scrolling, but now collapsible) */}
        {/* Apply collapse styles to this container */}
        <div className={`flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${isHeaderCollapsed ? 'max-h-0 p-0 mb-0 invisible opacity-0' : 'p-6 pb-2 visible opacity-100'}`}>
            {/* Document Title */}
            <div className="flex justify-between items-center mb-3">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{selectedLegislation.title}</h1>
                 {/* Collapse button moved below to be alongside toggles */}
            </div>

            {/* --- View Mode Toggle & Collapse Button --- */}
            <div className="mb-3 flex justify-between items-center">
                 <ToggleGroup type="single" value={viewMode} onValueChange={(value) => { handleModeChange(value as ViewMode) }} size="sm">
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
                 {/* --- NEW: Collapse Toggle Button (Always Visible) --- */}
                 <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
                    aria-label={isHeaderCollapsed ? "Expand header" : "Collapse header"}
                 >
                    {isHeaderCollapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
                 </Button>
                 {/* --- END NEW --- */}
            </div>
            {/* --- END View Mode Toggle & Collapse Button --- */}

            {/* Submission Status Alert */}
            {submitStatus && (
               <Alert className={`mb-3 ${submitStatus.type === 'error' ? 'border-red-500 text-red-700 dark:text-red-400 dark:border-red-600' : 'border-green-500 text-green-700 dark:text-green-400 dark:border-green-600'}`}>
                 {/* ... alert content ... */}
                 <Terminal className="h-4 w-4" />
                <AlertTitle>{submitStatus.type === 'success' ? 'Success' : 'Error'}</AlertTitle>
                <AlertDescription>
                  {submitStatus.message}
                </AlertDescription>
              </Alert>
          )}

            {/* --- Explanatory Note Display (Only if header NOT collapsed) --- */}
            {viewMode === 'view' && explanatoryNoteHtml && isExplanatoryNoteVisible && (
                 <Alert variant="default" className="mb-3 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-gray-800 relative">
                     {/* ... alert content ... */}
                     <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                     <AlertTitle className="text-blue-800 dark:text-blue-300">Explanatory Note</AlertTitle>
                     <AlertDescription className="prose dark:prose-invert max-w-none text-sm text-gray-700 dark:text-gray-300">
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

            {/* --- Display Changes Loading/Error (Only if header NOT collapsed) --- */}
             {(viewMode === 'changes' || viewMode === 'edit') && isLoadingChanges && (
                <div className="text-sm text-gray-500 dark:text-gray-400 my-2 flex items-center">
                    <Loader2 className="animate-spin h-4 w-4 mr-2" /> Loading changes...
                </div>
             )}
             {(viewMode === 'changes' || viewMode === 'edit') && changesError && (
                 <Alert variant="destructive" className="my-2">
                    {/* ... alert content ... */}
                    <AlertCircle className="h-4 w-4" />
                     <AlertTitle>Error Loading Changes</AlertTitle>
                     <AlertDescription>{changesError}</AlertDescription>
                 </Alert>
             )}

        </div> {/* End of collapsible header area */}

         {/* --- NEW: Floating Expand Header Button --- */}
        {isHeaderCollapsed && (
            <Button
                variant="ghost"
                size="icon" // Use icon size for a compact button
                onClick={() => setIsHeaderCollapsed(false)}
                aria-label="Expand header"
                className="absolute top-2 right-4 z-20 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" // Positioned top-right
            >
                <ChevronDown className="h-6 w-6" />
            </Button>
        )}
        {/* --- END NEW --- */}

        {/* --- Sticky Toolbar Area (Non-Scrolling) --- */}
        {/* Only show toolbar in Edit mode - Remains visible even if header above is collapsed */}
        {/* Its stickiness should now correctly attach to the top of the parent when header is collapsed */}
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
        {/* Removed collapse styling from here */}
        {/* Padding top adjusted based on edit mode (toolbar presence), not collapse state */}
        <div
            ref={mainContentRef}
            className={`flex-grow overflow-y-auto p-6 ${viewMode === 'edit' ? 'pt-2' : 'pt-4'} scroll-smooth`}
        >
            {/* Single Editor for the whole document */}
            <div className="flex-grow">
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
                          content={viewMode === 'edit' ? localEditorContent : fullDocumentHtml}
                          editable={viewMode === 'edit'}
                          onChange={viewMode === 'edit' ? setLocalEditorContent : undefined}
                          onAddCommentClick={viewMode === 'edit' ? handleToolbarAddCommentClick : undefined}
                          onEditorReady={handleEditorReady}
                          showToolbar={false}
                          baseHtmlForDiff={baseHtmlForDiff}
                          currentHtmlForDiff={viewMode === 'edit' ? localEditorContent : fullDocumentHtml}
                      />
                  </div>
              ) : (
                  // View mode OR Edit/Changes mode before base diff loaded
                  <LegislationEditor
                      content={viewMode === 'edit' ? localEditorContent : fullDocumentHtml}
                      editable={viewMode === 'edit'}
                      onChange={viewMode === 'edit' ? setLocalEditorContent : undefined}
                      onAddCommentClick={viewMode === 'edit' ? handleToolbarAddCommentClick : undefined}
                      onEditorReady={handleEditorReady}
                      showToolbar={false}
                      baseHtmlForDiff={null}
                      currentHtmlForDiff={viewMode === 'edit' ? localEditorContent : fullDocumentHtml}
                  />
              )}
            </div>
        </div>
    </div>
  );
}