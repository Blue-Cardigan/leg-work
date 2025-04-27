'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore, LegislationContent, Comment, useFocusedMarkId, useActiveCommentInputMarkId, useCommentActions } from '@/lib/store/useAppStore'; // Adjust path if needed
import LegislationEditor from './LegislationEditor'; // Import the Tiptap component
import LegislationToolbar from './LegislationToolbar'; // Import the toolbar
import DiffViewer from './ui/DiffViewer'; // Import the DiffViewer component
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Reverting to standard Shadcn path
import { Terminal, Loader2, Eye, Pencil, GitCompareArrows, X, AlertCircle, ChevronUp, ChevronDown, Send, Trash2, Lock, MessageSquare, Info } from "lucide-react"; // Added Send, Trash2, Lock, MessageSquare, Info
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group" // Import ToggleGroup
import { createClient } from '@/lib/supabaseClient'; // Import Supabase client factory
import { Button } from "@/components/ui/button"; // Import Button for collapse toggle
import { Editor } from '@tiptap/core';
import { User } from '@supabase/supabase-js'; // Import Supabase User type

// Define ProposedChange interface locally
interface ProposedChange {
    id: number;
    created_at: string;
    user_id: string;
    legislation_id: string;
    legislation_title: string;
    section_key: string;
    section_title: string;
    original_html: string | null;
    proposed_html: string | null;
    status: string;
    context_before: string | null;
    context_after: string | null;
}

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

// --- NEW: Simple Skeleton Loader Component ---
const SkeletonLoader: React.FC<{ message?: string }> = ({ message = "Loading content..." }) => (
    <div className="flex-grow p-6 flex flex-col items-center justify-center bg-white dark:bg-gray-900 text-center text-gray-500 dark:text-gray-400">
         <Loader2 className="animate-spin h-8 w-8 text-blue-500 mx-auto mb-3" />
         <p className="text-sm mb-4">{message}</p>
         <div className="w-full max-w-md space-y-4 animate-pulse">
             <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-3/4 mx-auto"></div>
      <div className="space-y-2">
                 <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-full"></div>
                 <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-5/6 mx-auto"></div>
      </div>
      </div>
    </div>
  );
// --- END Skeleton Loader ---

export default function MainContent({ }: MainContentProps) { // Props might be empty now
  const {
    selectedLegislation,
    isLoadingContent: isGlobalLoadingContent, // Rename for clarity
    fullDocumentHtml,
    setFullDocumentHtml,
    submitStatus,
    fetchComments,
    setFocusedMarkId,
    initialFullDocumentHtml, // <-- Get initial HTML for correct base setting
    // --- NEW: State and actions for submit/discard buttons --- 
    hasUnsavedChanges,
    isSubmitting,
    submitChangesForReview,
    resetContent,
    // --- END NEW ---
  } = useAppStore();
  // Explicitly select the action function from the store state
  const setSubmitStatusDirectly = useAppStore(state => state.setSubmitStatusDirectly);

  const focusedMarkId = useFocusedMarkId();
  const activeCommentInputMarkId = useActiveCommentInputMarkId();
  const { setActiveCommentInputMarkId } = useCommentActions();

  const [localEditorContent, setLocalEditorContent] = useState<string | null>(null);
  const supabase = createClient();
  const mainContentRef = useRef<HTMLDivElement>(null);

  // --- State for editor instance ---
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);

  // --- View Mode and Changes State ---
  type ViewMode = 'view' | 'changes' | 'edit';
  const [viewMode, setViewMode] = useState<ViewMode>('view');
  const [allPendingChanges, setAllPendingChanges] = useState<ProposedChange[]>([]);
  const [isLoadingChanges, setIsLoadingChanges] = useState<boolean>(false);
  const [changesError, setChangesError] = useState<string | null>(null);
  const [baseHtmlForDiff, setBaseHtmlForDiff] = useState<string | null>(null);
  const [isDiffDataReady, setIsDiffDataReady] = useState<boolean>(false);
  // --- NEW: State for final proposed HTML in 'changes' mode ---
  const [finalProposedHtml, setFinalProposedHtml] = useState<string | null>(null);

  // --- Header and Note State ---
  const [explanatoryNoteHtml, setExplanatoryNoteHtml] = useState<string | null>(null);
  const [isExplanatoryNoteVisible, setIsExplanatoryNoteVisible] = useState<boolean>(true);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState<boolean>(false);

  // --- NEW: Authentication State ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [showLoginAlert, setShowLoginAlert] = useState<boolean>(false);
  // --- END NEW ---

  // --- NEW: Effect to Check Authentication Status ---
  useEffect(() => {
    const checkAuth = async () => {
        setAuthLoading(true);
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) {
                console.error("Error fetching session:", error);
                setCurrentUser(null);
            } else {
                setCurrentUser(session?.user ?? null);
                console.log("[MainContent Auth] Session fetched, user:", session?.user?.email ?? "none");
            }
        } catch (err) {
            console.error("Unexpected error during auth check:", err);
            setCurrentUser(null);
        } finally {
            setAuthLoading(false);
        }
    };
    checkAuth();

    // Also listen for auth state changes (login/logout)
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        console.log(`[MainContent Auth] Auth state changed: ${event}, User: ${session?.user?.email ?? 'none'}`);
        setCurrentUser(session?.user ?? null);
        // Hide login alert if user logs in while it's shown
        if (event === "SIGNED_IN") {
            setShowLoginAlert(false);
        }
    });

    // Cleanup listener on component unmount
    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [supabase]);
  // --- END NEW ---

  // --- Fetch comments when legislation changes (Keep this) ---
  // This assumes CommentDisplaySidebar is rendered elsewhere based on store state
  useEffect(() => {
    if (selectedLegislation?.identifier) {
      fetchComments(selectedLegislation.identifier); // Fetch comments for the selected legislation
    }
  }, [selectedLegislation, fetchComments]);
  // ----------------------------------------------------------

  console.log('[MainContent] Rendering. isLoading:', isGlobalLoadingContent, 'fullDocumentHtml:', fullDocumentHtml?.substring(0, 100) + '...');

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

  // --- Handler to receive editor instance ---
  const handleEditorReady = useCallback((editor: Editor) => {
     console.log("[MainContent] Editor instance ready.");
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
  const handleToolbarAddCommentClick = useCallback((markId: string) => {
    if (!editorInstance) {
        console.error("Cannot add comment: Editor instance not available.");
        return;
    }
     console.log(`[MainContent] handleToolbarAddCommentClick called with markId: ${markId}`);
     // Set the active input mark ID using the action from the store
     setActiveCommentInputMarkId(markId); // Use the action here
  }, [editorInstance, setActiveCommentInputMarkId]);

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
              setLocalEditorContent(fullDocumentHtml ?? ''); // Initialize with global or empty string
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

  // --- Fetch ALL Pending Changes and Determine Base HTML ---
  useEffect(() => {
    const fetchAllChangesAndSetBase = async () => {
        if (!selectedLegislation?.identifier) return;

        // Reset states before fetching
        setIsLoadingChanges(true);
        setChangesError(null);
        setAllPendingChanges([]);
        setBaseHtmlForDiff(null);
        setIsDiffDataReady(false); // Explicitly set diff not ready
        console.log(`[MainContent FetchChanges] Fetching for ${selectedLegislation.identifier}. Global loading: ${isGlobalLoadingContent}`);

        // --- NEW: Reset final proposed HTML --- 
        setFinalProposedHtml(null);

        try {
            // Fetch pending changes
            const { data, error } = await supabase.rpc('get_all_pending_changes_for_legislation', {
                p_legislation_id: selectedLegislation.identifier
            });

            if (error) throw error;

            const fetchedChanges = (data as ProposedChange[]) || [];
            setAllPendingChanges(fetchedChanges);
            console.log(`[MainContent FetchChanges] Fetched ${fetchedChanges.length} changes.`);

            // Determine the base HTML for comparison
            let baseHtml: string | null = null;
            if (fetchedChanges.length > 0 && fetchedChanges[0].original_html !== null) {
                // Base is the original HTML *before* the very first pending change
                baseHtml = fetchedChanges[0].original_html;
                console.log(`[MainContent FetchChanges] Base HTML set from first pending change's original_html.`);
            } else {
                // If no pending changes OR the first change's original_html is null (shouldn't happen?),
                // the "base" for diffing purposes is the initial state loaded from the store.
                 baseHtml = initialFullDocumentHtml; // Use the initial state from store
                 console.log(`[MainContent FetchChanges] Base HTML set from initialFullDocumentHtml (length: ${baseHtml?.length ?? 0}). No pending changes or first original_html was null.`);
            }
            setBaseHtmlForDiff(baseHtml);

            // Now that changes are fetched and base HTML is determined, mark diff data as ready
            setIsDiffDataReady(true);
            console.log(`[MainContent FetchChanges] Diff data is now ready. Base HTML length: ${baseHtml?.length ?? 0}`);

            // --- NEW: Set final proposed HTML --- 
            if (fetchedChanges.length > 0 && fetchedChanges[fetchedChanges.length - 1].proposed_html !== null) {
                // Assume last change holds the cumulative proposed state
                setFinalProposedHtml(fetchedChanges[fetchedChanges.length - 1].proposed_html);
                console.log(`[MainContent FetchChanges] Final proposed HTML set from last pending change.`);
            } else {
                // If no changes, the "final proposed" is the same as the current/initial
                setFinalProposedHtml(fullDocumentHtml);
                console.log(`[MainContent FetchChanges] Final proposed HTML set from fullDocumentHtml (no pending changes).`);
            }

        } catch (err: any) {
            console.error("[MainContent FetchChanges] Failed to fetch or process:", err);
            setChangesError(err.message || "Failed to load pending changes.");
            setAllPendingChanges([]);
            setBaseHtmlForDiff(null);
            setIsDiffDataReady(false);
            setFinalProposedHtml(null); // Ensure reset on early exit
        } finally {
            setIsLoadingChanges(false); // Loading finished (success or error)
        }
    };

    // Only fetch changes if needed for the current mode AND the initial global content has loaded
    if (selectedLegislation?.identifier && (viewMode === 'changes' || viewMode === 'edit') && !isGlobalLoadingContent) {
        fetchAllChangesAndSetBase();
    } else {
        // Reset if not in relevant modes or global content is still loading
        setAllPendingChanges([]);
        setChangesError(null);
        setBaseHtmlForDiff(null);
        setIsDiffDataReady(false);
        setFinalProposedHtml(null);
    }
  }, [selectedLegislation, viewMode, supabase, initialFullDocumentHtml, isGlobalLoadingContent, fullDocumentHtml]); // Added dependencies
  // --- END Fetch ---

  // --- Derived Loading State ---
  // Overall loading is true if global content is loading OR if we are in diff mode and waiting for changes/baseHTML OR auth is loading
  const isLoading = authLoading || isGlobalLoadingContent || ((viewMode === 'changes' || viewMode === 'edit') && isLoadingChanges);
  const isEditorReadyForDisplay = !authLoading && !isGlobalLoadingContent && (viewMode === 'view' || ((viewMode === 'changes' || viewMode === 'edit') && isDiffDataReady));

  // --- Loading State ---
  if (isLoading) {
    // Customize message based on what's loading
    let loadingMessage = "Loading...";
    if (authLoading) {
        loadingMessage = "Checking authentication...";
    } else if (isGlobalLoadingContent) {
        loadingMessage = "Loading content...";
    } else if (isLoadingChanges) {
        loadingMessage = "Loading pending changes...";
    } else if ((viewMode === 'changes' || viewMode === 'edit') && !isDiffDataReady) {
        loadingMessage = "Preparing diff view..."; // Catch state where changes loaded but diff isn't ready yet
    }
    return <SkeletonLoader message={loadingMessage} />;
  }

  // --- No Legislation Selected State ---
  if (!selectedLegislation) {
    return <div className="flex-grow p-6 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900">Select legislation from the sidebar to view its content.</div>;
  }

  // --- Error or No Content State (After Loading) ---
  // If global content failed to load (and not in edit mode trying to use local content)
  if (fullDocumentHtml === null && viewMode !== 'edit') {
      console.log('[MainContent] Error: fullDocumentHtml is null after loading attempt (not in edit mode). Displaying loader.');
      // TODO: Display a more specific error message if available from the store
      return <SkeletonLoader message="Running 🦵🦵" />;
  }
  // If entering edit mode but initialization failed (global was null)
  if (viewMode === 'edit' && localEditorContent === null) {
      console.log('[MainContent] Warning: Entering edit mode but initial content was null. Cannot edit.');
       return (
        <div className="flex-grow p-6 text-center text-orange-600 dark:text-orange-400 bg-white dark:bg-gray-900">
           Cannot enter edit mode because the initial content failed to load.
        </div>
      );
  }

  // --- Handler for Mode Change (Updated for Auth Check & View Mode Fix) ---
  const handleModeChange = (newMode: ViewMode | null) => {
      if (!newMode || newMode === viewMode || authLoading) return; // Don't change mode if auth state is loading

      // Auth check before entering edit mode
      if (newMode === 'edit' && !currentUser) {
          console.log("[MainContent] User not logged in. Preventing switch to edit mode.");
          setShowLoginAlert(true);
          return;
      } else {
          setShowLoginAlert(false);
      }

      console.log(`[MainContent] Switching mode from ${viewMode} to ${newMode}`);

      setViewMode(newMode);

      // Reset diff readiness flag when switching modes, it will be re-evaluated by useEffect
      setIsDiffDataReady(false);

      if (newMode === 'edit') {
          // Initialize local state with the *current* fullDocumentHtml (could be initial or previously submitted)
          // If a user submitted changes, fullDocumentHtml *might* differ from initialFullDocumentHtml
          // Fetching pending changes should handle showing the correct base.
          setLocalEditorContent(fullDocumentHtml ?? '');
          console.log("[MainContent] Mode switched to edit. Initializing localEditorContent from current fullDocumentHtml.");
      } else {
          // Clear local state if switching out of edit mode
          if (localEditorContent !== null) { // Clear only if it was actually set
              setLocalEditorContent(null);
              console.log("[MainContent] Mode switched away from edit. Cleared localEditorContent.");
          }
      }
  };

  // --- Determine props for LegislationEditor based on viewMode (VIEW MODE FIX) ---
  let editorContentToShow: string | null = null;
  let baseHtmlForEditor: string | null = null;
  let currentHtmlForEditor: string | null = null;
  let changesForEditor: ProposedChange[] = []; // <-- New prop value

  switch (viewMode) {
      case 'view':
          // --- FIX: Always show the initial, unchanged content in view mode ---
          editorContentToShow = initialFullDocumentHtml;
          // No diff needed
          break;
      case 'changes':
          // Show the final state reflecting *pending* changes
          editorContentToShow = finalProposedHtml; // Derived from fetched changes
          if (isDiffDataReady) {
              baseHtmlForEditor = baseHtmlForDiff; // Original before *first* pending change (or initial if none)
              currentHtmlForEditor = finalProposedHtml; // Final state *after* all pending changes
              changesForEditor = allPendingChanges;
          }
          break;
      case 'edit':
          // Show local, unsaved edits
          editorContentToShow = localEditorContent;
          if (isDiffDataReady) {
              baseHtmlForEditor = baseHtmlForDiff; // Original before *first* pending change (or initial if none)
              currentHtmlForEditor = localEditorContent; // Compare against local edits
              changesForEditor = allPendingChanges; // Pass pending changes for context (optional display)
          }
          break;
  }

  console.log(`[MainContent Props Calculation - View Mode Fix] Mode: ${viewMode}, isDiffReady: ${isDiffDataReady}`);
  console.log(` - initialFullDocumentHtml: ${initialFullDocumentHtml !== null ? initialFullDocumentHtml.substring(0, 50) + '...' : 'null'}`);
  console.log(` - baseHtmlForEditor: ${baseHtmlForEditor !== null ? baseHtmlForEditor.substring(0, 50) + '...' : 'null'}`);
  console.log(` - currentHtmlForEditor: ${currentHtmlForEditor !== null ? currentHtmlForEditor.substring(0, 50) + '...' : 'null'}`);
  console.log(` - editorContentToShow: ${editorContentToShow !== null ? editorContentToShow.substring(0, 50) + '...' : 'null'}`);

  // --- NEW: Handle Discard Logic --- 
  const handleDiscard = () => {
    if (confirm("Are you sure you want to discard your changes? This cannot be undone.")) {
        console.log("Discarding changes...");
        resetContent(); // Reset global store state
        // --- NEW: Reset local state and switch mode --- 
        setLocalEditorContent(initialFullDocumentHtml ?? ''); // Revert local editor content
        setViewMode('view'); // Switch back to view mode
        console.log("Switched back to view mode after discard.");
        // --- END NEW ---
    }
  };
  // --- END NEW ---

  // --- NEW: Handler to save local changes to store and submit ---
  const handleSaveChangesAndSubmit = () => {
    // Check if the action function was successfully selected
    if (!setSubmitStatusDirectly) {
        console.error("setSubmitStatusDirectly action not found in store!");
        return; // Prevent further execution if action is missing
    }

    if (localEditorContent !== null) {
        if (localEditorContent === initialFullDocumentHtml) {
             console.log("[MainContent] No changes detected compared to the initial document. Nothing to submit.");
              setSubmitStatusDirectly({ type: 'success', message: 'No changes to submit.' }, false);
              setTimeout(() => setSubmitStatusDirectly(null), 3000); // Clear status only
             return;
        }

        console.log("[MainContent] Saving local changes to store before submitting...");
        setFullDocumentHtml(localEditorContent);

        console.log("[MainContent] Triggering submitChangesForReview...");
        submitChangesForReview();
    } else {
        console.warn("[MainContent] Attempted to save and submit with null localEditorContent.");
         setSubmitStatusDirectly({ type: 'error', message: 'Cannot submit: No content available.' }, false);
         setTimeout(() => setSubmitStatusDirectly(null), 5000); // Clear status only
    }
  };
  // --- END NEW ---

  // --- NEW: Login Alert ---
  if (showLoginAlert) {
    return (
        <Alert
            variant="default" // Use default variant, styling handled by classes
            className="mb-3 border-yellow-500 text-yellow-700 dark:text-yellow-400 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/50 relative" // Added background and relative positioning
        >
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Login Required</AlertTitle>
            <AlertDescription>
                You must be logged in to make edits. Please <a href="/login" className="font-medium underline hover:text-yellow-800 dark:hover:text-yellow-300">log in</a> or <a href="/signup" className="font-medium underline hover:text-yellow-800 dark:hover:text-yellow-300">sign up</a>.
            </AlertDescription>
             {/* Optional: Add close button */}
             <button
                onClick={() => setShowLoginAlert(false)}
                className="absolute top-2 right-2 text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-200"
                aria-label="Close login prompt"
            >
                <X className="h-4 w-4" />
            </button>
        </Alert>
    );
  }
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
                 <ToggleGroup
                     type="single"
                     value={viewMode}
                     // Update onValueChange to handle potential blocking by handleModeChange
                     onValueChange={(value) => {
                         // If the value is empty (toggle deselected) or same as current, do nothing
                         if (!value || value === viewMode) return;
                         handleModeChange(value as ViewMode);
                     }}
                     size="sm"
                 >
                    <ToggleGroupItem value="view" aria-label="View mode">
                        <Eye className="h-4 w-4 mr-1" /> View
                    </ToggleGroupItem>
                    <ToggleGroupItem value="changes" aria-label="View changes mode">
                        <GitCompareArrows className="h-4 w-4 mr-1" /> Changes
                    </ToggleGroupItem>
                    <ToggleGroupItem
                        value="edit"
                        aria-label="Edit mode"
                        disabled={authLoading || !currentUser} // Disable if loading auth or not logged in
                        title={!currentUser ? "Log in to edit" : "Edit mode"} // Add tooltip
                    >
                         {currentUser ? <Pencil className="h-4 w-4 mr-1" /> : <Lock className="h-4 w-4 mr-1 text-gray-400" />} Edit
                    </ToggleGroupItem>
                </ToggleGroup>
                 {/* --- NEW: Submit/Discard Buttons (only in Edit mode) --- */}
                 {viewMode === 'edit' && (
                     <div className="flex items-center space-x-2">
                         {/* Discard Button Logic (compare local to initial) */}
                         {localEditorContent !== initialFullDocumentHtml && ( // Show discard only if local differs from initial
                             <Button
                                 variant="outline"
                                 onClick={handleDiscard}
                                 disabled={isSubmitting}
                                 size="sm"
                                 title="Discard Changes"
                             >
                                 <Trash2 className="h-4 w-4" />
                             </Button>
                         )}
                         {/* Submit Button Logic (compare local to initial) */}
                         <Button
                             onClick={handleSaveChangesAndSubmit}
                             disabled={isSubmitting || localEditorContent === initialFullDocumentHtml} // Disable if submitting or no changes from initial
                             size="sm"
                             className={localEditorContent !== initialFullDocumentHtml ? "bg-green-600 hover:bg-green-700" : ""} // Style based on changes from initial
                             title={localEditorContent !== initialFullDocumentHtml ? "Submit Changes for Review" : "No changes to submit"}
                         >
                             {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : <Send className="h-4 w-4" />}
                         </Button>
                     </div>
                 )}
                 {/* --- END NEW --- */}
                 {/* --- Collapse Toggle Button (Always Visible) --- */}
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
             {(viewMode === 'changes' || viewMode === 'edit') && !isLoadingChanges && changesError && (
                 <Alert variant="destructive" className="my-2">
                    {/* ... alert content ... */}
                    <AlertCircle className="h-4 w-4" />
                     <AlertTitle>Error Loading Changes</AlertTitle>
                     <AlertDescription>{changesError}</AlertDescription>
                 </Alert>
             )}
             {/* Message about pending changes (only if diff data is ready) */}
             {(viewMode === 'changes' || viewMode === 'edit') && isDiffDataReady && (
                <div className={`text-sm p-2 rounded mb-2 ${allPendingChanges.length > 0 ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200' : 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200'}`}>
                     {allPendingChanges.length > 0
                        ? `Displaying ${allPendingChanges.length} pending change(s). Insertions highlighted below.`
                        : `No pending changes found. Displaying the current version.`
                     }
                 </div>
             )}

        </div>

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

        {/* --- Sticky Toolbar Area (Non-Scrolling) --- */}
        {/* Only show toolbar in Edit mode - Remains visible even if header above is collapsed */}
        {/* Its stickiness should now correctly attach to the top of the parent when header is collapsed */}
        {viewMode === 'edit' && currentUser && ( // Also check currentUser here
            <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 py-1 px-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                {editorInstance ? (
                    <LegislationToolbar
                        editor={editorInstance}
                        onAddCommentClick={handleToolbarAddCommentClick}
                    />
                ) : (
                   <div className="h-10 flex items-center text-sm text-gray-400">Toolbar loading...</div>
                )}
            </div>
        )}

        {/* Removed collapse styling from here */}
        {/* Padding top adjusted based on edit mode (toolbar presence), not collapse state */}
        <div
            ref={mainContentRef}
            className={`flex-grow overflow-y-auto p-6 ${viewMode === 'edit' ? 'pt-2' : 'pt-4'} scroll-smooth`}
        >
            {/* Single Editor or Diff Viewer */}
            <div className="flex-grow">
              {isEditorReadyForDisplay ? (
                  <> {/* Use Fragment to conditionally render one child */} 
                    {viewMode === 'changes' ? (
                       <DiffViewer
                            oldString={baseHtmlForEditor}
                            newString={currentHtmlForEditor}
                        />
                    ) : (
                        <LegislationEditor
                            // Use the derived content variable
                            content={editorContentToShow}
                            editable={viewMode === 'edit' && !!currentUser} // Editor editable only if in edit mode AND logged in
                            onChange={(viewMode === 'edit' && !!currentUser) ? setLocalEditorContent : undefined} // Only allow changes if logged in
                            onAddCommentClick={(viewMode === 'edit' && !!currentUser) ? handleToolbarAddCommentClick : undefined} // Only allow comments if logged in
                            onEditorReady={handleEditorReady}
                            showToolbar={false} // Toolbar is handled above
                            // --- Pass the full changes list (kept for potential future use, though not directly used by editor now) ---
                            allPendingChanges={changesForEditor}
                        />
                    )}
                  </>
              ) : (
                  // This case should ideally be caught by the top-level isLoading check,
                  // but acts as a fallback if something unexpected happens.
                  <SkeletonLoader message="Preparing view..." />
              )}
            </div>
        </div>
    </div>
  );
}