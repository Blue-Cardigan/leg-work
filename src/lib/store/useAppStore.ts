import { create } from 'zustand';
import { useMemo } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { immer } from 'zustand/middleware/immer';
import type { User } from '@supabase/supabase-js';

// Define the shape of a legislation item
export interface LegislationItem {
  title: string;
  href: string; // Full URL
  identifier: string; // Unique ID (e.g., uksi/2023/123)
  type: string;
  year: string;
  isAmendment?: boolean; // Add optional property for filtering
}

// --- Define TOC Item Structure ---
export interface TocItem {
  title: string;
  fullHref: string;
  level: number;
}

// --- Define Legislation Content Structure ---
export interface LegislationContent {
  toc: TocItem[];
  introHtml: string | null;
  sectionsHtml: { [href: string]: string | null }; // Corrected property name
}

// --- NEW: Define Chat Message structure --- 
export interface ChatMessagePart {
  text: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  parts: ChatMessagePart[];
  contextUsed?: string | null; // <-- Add optional field to store context
}
// --- END NEW ---

// --- NEW: Define Comment structure ---
export interface Comment {
  id: string; // UUID from database
  legislation_identifier: string; // ID of the legislation document (keep for now, note API uses legislation_id)
  mark_id: string; // Added: ID linking to the highlighted text in the editor
  comment_text: string; // Renamed from text to match API/DB
  created_at: string;
  user_id: string; // ID of the user who commented
  user_email?: string; // Added: Email of the user (optional)
  resolved: boolean; // Keep for now, note API selects resolved_at
  // Removed range_start_char, range_end_char as they aren't currently used here
  // Note: section_key is selected in API but not added here yet
}
// --- END NEW ---

// Define the structure of the store's state AND actions
interface AppState {
  allLegislationList: LegislationItem[]; // Holds the raw, unfiltered list
  isLoadingList: boolean;
  error: Error | string | null;
  searchTerm: string;
  selectedTypes: string[]; 
  availableTypes: string[]; 
  selectedLegislation: LegislationItem | null;
  selectedLegislationContent: LegislationContent | null;
  isLoadingContent: boolean;
  errorContent: Error | string | null;

  // --- NEW: Chat State ---
  chatMessages: ChatMessage[];
  isChatLoading: boolean;
  chatError: Error | string | null;
  // --- END NEW ---

  // --- NEW: Comment State ---
  comments: Comment[];
  isLoadingComments: boolean;
  commentsError: Error | string | null;
  focusedCommentId: string | null; // Track the currently focused comment
  focusedMarkId: string | null; // Track the currently focused comment mark
  // --- END NEW ---

  // --- NEW: Amendment Filter State ---
  showAmendments: boolean;
  // --- END NEW ---

  // --- Add back state for change tracking ---
  originalLegislationContent: LegislationContent | null; // Store the initial loaded content
  hasUnsavedChanges: boolean; // Flag to track edits
  // --- End Add back ---

  // --- NEW: Sidebar State ---
  isSidebarCollapsed: boolean;
  // --- END NEW ---

  // --- Add state for combined content ---
  fullDocumentHtml: string | null;
  initialFullDocumentHtml: string | null; // <-- NEW: Store the initial HTML
  isSubmitting: boolean;
  submitStatus: { type: 'success' | 'error'; message: string } | null;

  // --- NEW: State for managing comment input within RightSidebar ---
  activeCommentInputMarkId: string | null; // Which mark_id are we creating a comment for?
  isSubmittingComment: boolean; // Loading state for comment submission
  commentSubmitError: string | null; // Error state for comment submission
  // --- END NEW ---

  // --- NEW: Right Sidebar Content State ---
  rightSidebarContent: 'chat' | 'comments'; // What to show in the right sidebar
  isRightSidebarOpen: boolean; // NEW: Track visibility
  // --- END NEW ---

  // Actions are now top-level methods
  fetchLegislationList: () => Promise<void>;
  setSearchTerm: (term: string) => void;
  setSelectedTypes: (types: string[]) => void; 
  setSelectedLegislation: (item: LegislationItem | null) => void;
  fetchLegislationContent: (urlToFetch: string) => Promise<void>;
  resetContent: () => void;
  // --- NEW: Chat Actions ---
  sendChatMessage: (messageText: string) => Promise<void>;
  // --- END NEW ---
  // --- NEW: Editor Update Actions ---
  updateIntroHtml: (newHtml: string) => void;
  updateSectionHtml: (href: string, newHtml: string) => void;
  // --- END NEW ---
  // --- NEW: Comment Actions ---
  fetchComments: (legislationIdentifier: string) => Promise<void>;
  addComment: (newComment: Comment) => void;
  setFocusedCommentId: (commentId: string | null) => void; // Action to set focused comment
  setFocusedMarkId: (markId: string | null) => void; // NEW: Action to set focused mark ID
  // TODO: Add resolveComment, deleteComment actions
  // --- END NEW ---
  // --- NEW: Amendment Filter Action ---
  toggleShowAmendments: () => void;
  // --- END NEW ---

  // --- NEW: Sidebar Action ---
  toggleSidebar: () => void;
  // --- END NEW ---

  // --- Add back actions for change tracking & submission ---
  setOriginalContent: (content: LegislationContent | null) => void; // Internal action
  submitChangesForReview: () => Promise<{ success: boolean; error?: string }>;
  // --- End Add back ---

  // --- Add state for comment sidebar visibility ---
  isCommentSidebarOpen: boolean;

  // --- Add action for combined content ---
  setFullDocumentHtml: (html: string) => void;

  // --- Add action for comment sidebar ---
  toggleCommentSidebar: () => void;

  // --- NEW: Add missing action signatures ---
  setActiveCommentInputMarkId: (markId: string | null) => void;
  submitComment: (commentData: { comment_text: string; legislation_id: string; mark_id: string; section_key?: string }) => Promise<{ success: boolean }>;
  setRightSidebarContent: (contentType: 'chat' | 'comments') => void;
  toggleRightSidebar: () => void; // NEW: Action signature
  applySuggestion: (originalText: string, suggestedText: string) => void; // <-- NEW ACTION SIGNATURE
  // --- END NEW ---
}

// Create the Zustand store with Immer middleware for easier state updates
export const useAppStore = create(
  immer<AppState>((set, get) => ({ // REMOVED: & { actions: AppActions }
    // Initial State
    allLegislationList: [],
    isLoadingList: false,
    error: null,
    searchTerm: '',
    selectedTypes: [], 
    availableTypes: [], 
    selectedLegislation: null,
    selectedLegislationContent: null,
    isLoadingContent: false,
    errorContent: null,
    // --- NEW: Chat Initial State ---
    chatMessages: [],
    isChatLoading: false,
    chatError: null,
    // --- END NEW ---
    // --- NEW: Comment Initial State ---
    comments: [],
    isLoadingComments: false,
    commentsError: null,
    focusedCommentId: null, // Initialize focusedCommentId to null
    focusedMarkId: null, // Initialize focusedMarkId to null
    // --- END NEW ---
    // --- NEW: Amendment Filter Initial State ---
    showAmendments: false, // Default to false
    // --- END NEW ---

    // --- Add back initial state for change tracking ---
    originalLegislationContent: null,
    hasUnsavedChanges: false,
    // --- End Add back ---

    // --- NEW: Sidebar Initial State ---
    isSidebarCollapsed: false,
    // --- END NEW ---

    // --- Add state for combined content ---
    fullDocumentHtml: null,
    initialFullDocumentHtml: null, // <-- Initialize new state
    isSubmitting: false,
    submitStatus: null,

    // --- NEW: Comment Input Initial State ---
    activeCommentInputMarkId: null,
    isSubmittingComment: false,
    commentSubmitError: null,
    // --- END NEW ---

    // --- NEW: Right Sidebar Initial State ---
    rightSidebarContent: 'chat',
    isRightSidebarOpen: false, // NEW: Default to closed
    // --- END NEW ---

    // --- Actions are now defined directly --- 
    fetchLegislationList: async () => {
      if (get().isLoadingList) return; 
      set((state) => {
        state.isLoadingList = true;
        state.error = null;
        state.allLegislationList = []; 
        state.availableTypes = []; 
        state.selectedTypes = []; 
      });

      try {
        const response = await fetch('/api/legislation/list');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: LegislationItem[] = await response.json();

        const types = Array.from(new Set(data.map(item => item.type))).sort();

        set((state) => {
          state.allLegislationList = data;
          state.availableTypes = types;
          state.selectedTypes = [...types]; 
          state.isLoadingList = false;

          if (state.selectedLegislation) {
            const stillExists = data.some(item => item.href === state.selectedLegislation?.href);
            if (!stillExists) {
              state.selectedLegislation = null; 
              state.selectedLegislationContent = null;
              state.originalLegislationContent = null; // Clear original if item removed
              state.hasUnsavedChanges = false; // Reset flag
              state.isLoadingContent = false;
              state.errorContent = null;
              state.chatMessages = []; // Clear chat history
              state.chatError = null;
              state.isChatLoading = false;
              state.comments = []; // Clear comments
              state.commentsError = null;
              state.isLoadingComments = false;
              state.focusedCommentId = null; 
              state.focusedMarkId = null;
              state.activeCommentInputMarkId = null; // Reset comment input trigger
              state.rightSidebarContent = 'chat'; // Reset sidebar content
              state.isSidebarCollapsed = false; // Expand left sidebar
              state.isCommentSidebarOpen = false;
            }
          }
        });
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        console.error("Failed to fetch legislation list:", error);
        set((state) => {
          state.error = error.message;
          state.isLoadingList = false;
        });
      }
    },

    setSearchTerm: (term: string) => {
      set((state) => {
        state.searchTerm = term;
      });
    },

    setSelectedTypes: (types: string[]) => {
      set((state) => {
        state.selectedTypes = types;
      });
    },

    setSelectedLegislation: (item: LegislationItem | null) => {
      if (get().hasUnsavedChanges) {
          if (!confirm("You have unsaved changes. Are you sure you want to switch legislation? Your changes will be lost.")) {
              return; // User cancelled
          }
      }

      if (item && item.href === get().selectedLegislation?.href) {
        // If the same item is clicked again, just toggle the sidebar
        get().toggleSidebar(); 
        return; 
      }

      set((state) => {
        const isNewSelection = item?.href !== state.selectedLegislation?.href;
        state.selectedLegislation = item;
        state.selectedLegislationContent = null; 
        state.fullDocumentHtml = null; // Explicitly clear combined HTML
        state.errorContent = null;
        state.hasUnsavedChanges = false; 
        state.isLoadingContent = false; // Reset loading initially
        state.chatMessages = []; // Clear chat history
        state.chatError = null;
        state.isChatLoading = false;
        state.comments = []; // Clear comments
        state.commentsError = null;
        state.isLoadingComments = false;
        state.focusedCommentId = null; 
        state.focusedMarkId = null;
        state.activeCommentInputMarkId = null; // Reset comment input trigger
        state.isCommentSidebarOpen = false;
        state.submitStatus = null; // Clear any previous submit status
        state.rightSidebarContent = 'chat'; // Default to chat on new selection

        // Collapse sidebar ONLY if selecting a NEW item
        if (item && isNewSelection && !state.isSidebarCollapsed) {
          state.isSidebarCollapsed = true;
        } else if (!item) {
           // If clearing selection, expand sidebar
           state.isSidebarCollapsed = false;
        }

        // Trigger content fetch if an item is selected
        if (item) {
            // Call fetchLegislationContent with the correct URL (item.href)
            get().fetchLegislationContent(item.href); 
        }
      });
    },

    fetchLegislationContent: async (urlToFetch: string) => {
      if (!urlToFetch) {
        console.warn("[Store] fetchLegislationContent called with no URL.");
        set({ selectedLegislationContent: null, isLoadingContent: false, fullDocumentHtml: null, initialFullDocumentHtml: null, hasUnsavedChanges: false, comments: [], activeCommentInputMarkId: null });
        return;
      }

      // Retrieve the identifier from the currently selected item for fetching comments later
      const identifier = get().selectedLegislation?.identifier;

      // Only set loading if not already loading (prevent flickering)
      if (!get().isLoadingContent) {
          set({ isLoadingContent: true });
      }
      // Reset specific states before fetching new content
      set((state) => {
         state.errorContent = null;
         state.selectedLegislationContent = null; // Clear old structured content
         state.fullDocumentHtml = null; // Explicitly clear combined HTML here too
         state.hasUnsavedChanges = false;
         state.comments = []; // Clear comments for the new item
         state.isCommentSidebarOpen = false; // Close comment sidebar
         state.focusedMarkId = null;
         state.focusedCommentId = null;
         state.activeCommentInputMarkId = null; // Reset comment input
         state.submitStatus = null; // Clear submit status
      });

      console.log(`[Store] Fetching content for URL: ${urlToFetch}`);

      try {
        // Use the correct API endpoint and pass the URL as a query parameter
        const apiUrl = `/api/legislation/content?url=${encodeURIComponent(urlToFetch)}`;
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          // Try to get error message from JSON body first
          let errorMsg = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            errorMsg = errorData.error || errorMsg;
          } catch (jsonError) {
            // If parsing JSON fails, try to get text body
            try {
                 const textBody = await response.text();
                 errorMsg += ` - ${textBody.substring(0, 100)}`; // Include part of text body
            } catch {} // Ignore error reading text body
          }
          console.error(`[API Error] Failed fetch: ${errorMsg}`);
          throw new Error(errorMsg);
        }
        
        // We expect JSON now from the correct endpoint
        const data: LegislationContent = await response.json(); 
        console.log('[Store] Content fetched:', data);

        // Combine intro and sections into fullDocumentHtml
        let combinedHtml = data.introHtml || ''; 
        if (data.toc && data.sectionsHtml) {
            data.toc.forEach(item => {
                // Only include actual content sections, not placeholder headings
                if (!item.fullHref.includes('#heading-') && data.sectionsHtml[item.fullHref]) {
                    const sectionId = generateSafeId(item.title || item.fullHref); 
                    // Add section title heading BEFORE the content
                    combinedHtml += `<h2 data-section-href="${item.fullHref}" id="${sectionId}">${item.title}</h2>`;
                    combinedHtml += data.sectionsHtml[item.fullHref]; // Add content
                } else if (item.fullHref.includes('#heading-')) {
                     // Add non-linked headings for structure
                     const headingId = generateSafeId(item.title || `heading-${item.fullHref}`);
                     // Adjust heading level based on TOC level? (e.g., level 0 -> h2, level 1 -> h3)
                     const headingLevel = Math.min(6, item.level + 2); // Clamp between h2 and h6
                     combinedHtml += `<h${headingLevel} data-toc-heading="true" id="${headingId}" style="margin-left: ${item.level * 1.5}rem;">${item.title}</h${headingLevel}>`;
                }
            });
        }

        // Store both initial and current (which are the same initially)
        set({
          selectedLegislationContent: data,
          isLoadingContent: false,
          fullDocumentHtml: combinedHtml,
          initialFullDocumentHtml: combinedHtml, // <-- Store the initial version
          hasUnsavedChanges: false,
        });

        // Fetch comments associated with this legislation *after* content is set
        if (identifier) {
          get().fetchComments(identifier);
        } else {
          console.warn("[Store] Could not fetch comments after content load: identifier was missing.");
        }

      } catch (error: any) { // Catch block handles fetch errors AND JSON parsing errors
        console.error('[Store] Error fetching or processing content:', error);
        set({ 
            errorContent: error.message || "Failed to load content", 
            isLoadingContent: false, 
            selectedLegislationContent: null, 
            fullDocumentHtml: null,
            initialFullDocumentHtml: null // <-- Clear initial on error
        });
      }
    },
    
     resetContent: () => {
        const currentSelection = get().selectedLegislation;
        if (currentSelection) {
            console.log("[Store] Resetting content for:", currentSelection.identifier);
            get().fetchLegislationContent(currentSelection.href);
            // fetchLegislationContent already resets initialFullDocumentHtml and hasUnsavedChanges
        } else {
             console.warn("[Store] Cannot reset content, no legislation selected.");
        }
    },

    // --- NEW: Chat Actions ---
    sendChatMessage: async (messageText: string) => {
      // Extract context from messageText IF PRESENT (used for association)
      let contextTextForAssociation: string | null = null;
      const contextMatch = messageText.match(/^Context \(lines \d+-\d+\):\n([\s\S]*?)\n\nQuestion:/);
      if (contextMatch && contextMatch[1]) {
          contextTextForAssociation = contextMatch[1];
      }

      if (!messageText.trim() || get().isChatLoading) return;
  
      const newUserMessage: ChatMessage = { role: 'user', parts: [{ text: messageText }] };
      
      // Add user message immediately using Immer pattern
      set((state) => {
        state.chatMessages.push(newUserMessage);
        state.isChatLoading = true;
        state.chatError = null;
      });
  
      try {
        const currentHistory = get().chatMessages.slice(0, -1); // History excludes the latest user message
        const response = await fetch('/api/chat', { // Assuming /api/chat endpoint
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
              history: currentHistory, 
              message: messageText // Send the full message including context preamble
          }),
        });
  
        if (!response.ok || !response.body) {
          let errorMsg = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            errorMsg = errorData.error || errorMsg;
          } catch (e) { /* Ignore parsing error if body is not JSON */ }
          throw new Error(errorMsg);
        }
  
        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let modelResponseText = '';
        let modelMessageIndex = -1;

        // Add initial model message placeholder, INCLUDING the associated context
        set(state => {
          state.chatMessages.push({
            role: 'model',
            parts: [{ text: '' }],
            contextUsed: contextTextForAssociation, // <-- Associate context here
          });
          modelMessageIndex = state.chatMessages.length - 1;
        });
  
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          modelResponseText += chunk;
  
          // Update the last message (model's response) incrementally using Immer
          set(state => {
            // Ensure message exists and update its parts
            if (modelMessageIndex !== -1 && state.chatMessages[modelMessageIndex]?.parts) {
               state.chatMessages[modelMessageIndex].parts = [{ text: modelResponseText }];
            }
          });
        }
        
        // Ensure final state is set correctly after stream ends
        set(state => {
          state.isChatLoading = false;
        });
  
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error("Chat request failed:", error);
        // Add an error message placeholder to the chat
        set(state => { 
          state.chatMessages.push({ role: 'model', parts: [{ text: `Error: ${errorMsg}` }] });
          state.isChatLoading = false; 
          state.chatError = errorMsg; 
        });
      }
    },
    // --- END NEW ---
    // --- NEW: Editor Update Actions ---
    updateIntroHtml: (newHtml: string) => {
      // This should likely not be used directly anymore.
      // Changes should be managed via setFullDocumentHtml.
      console.warn("updateIntroHtml called - this might be deprecated. Use setFullDocumentHtml.");
      // set((state) => {
      //   if (state.selectedLegislationContent) {
      //     // state.selectedLegislationContent.introHtml = newHtml;
      //     // state.hasUnsavedChanges = true; // Mark changes
      //   }
      // });
    },
    updateSectionHtml: (href: string, newHtml: string) => {
      // This should likely not be used directly anymore.
      console.warn("updateSectionHtml called - this might be deprecated. Use setFullDocumentHtml.");
      // set((state) => {
      //   if (state.selectedLegislationContent?.sectionsHtml) {
      //     // state.selectedLegislationContent.sectionsHtml[href] = newHtml;
      //     // state.hasUnsavedChanges = true; // Mark changes
      //   }
      // });
    },
    // --- END NEW ---
    // --- NEW: Comment Actions ---
    fetchComments: async (legislationIdentifier: string) => {
      if (!legislationIdentifier) {
        console.warn("fetchComments called with no identifier.");
        set({ comments: [], isLoadingComments: false });
        return;
      }
      if (get().isLoadingComments) return;

      set(state => {
        state.isLoadingComments = true;
        state.commentsError = null;
      });

      console.log(`[Store] Fetching comments for legislation ID: ${legislationIdentifier}`);
      try {
        const supabase = createClient();
        // Fetch comments matching the identifier
        // Ensure the API path and query param name are correct
        const response = await fetch(`/api/comments?legislation_id=${encodeURIComponent(legislationIdentifier)}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        const fetchedComments: any[] = await response.json(); // Use any[] initially

        // Basic validation/transformation if needed (e.g., parsing dates)
        const validComments: Comment[] = fetchedComments.map(c => ({
          ...c, // Spread existing fields
          // Ensure required fields exist and potentially transform types
          id: String(c.id), // Ensure ID is string
          // legislation_identifier: String(c.legislation_id), // API returns legislation_id, keep it? 
          legislation_identifier: String(c.legislation_id || legislationIdentifier), // Use provided identifier as fallback
          mark_id: String(c.mark_id),
          comment_text: String(c.comment_text),
          created_at: String(c.created_at),
          user_id: String(c.user_id),
          user_email: c.user_email ? String(c.user_email) : undefined,
          resolved: !!c.resolved_at, // Convert resolved_at timestamp to boolean
          // Ensure all fields expected by the Comment type are present
        })).filter(c => c.id && c.mark_id && c.comment_text && c.created_at && c.user_id);

        console.log(`[Store] Fetched ${validComments.length} comments.`);
        set(state => {
          state.comments = validComments;
          state.isLoadingComments = false;
        });

      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        console.error("Failed to fetch comments:", error);
        set(state => {
          state.commentsError = error.message;
          state.isLoadingComments = false;
        });
      }
    },

    addComment: (newComment: Comment) => {
      set((state) => {
        // Avoid duplicates if submit somehow triggers multiple times
        if (!state.comments.some(c => c.id === newComment.id)) {
        state.comments.push(newComment);
        }
      });
    },
    setFocusedCommentId: (commentId: string | null) => {
      set((state) => {
        state.focusedCommentId = commentId;
        // Optionally clear mark focus when comment focus changes
        // if (commentId !== null) {
        //     state.focusedMarkId = null; 
        // }
      });
    },
    setFocusedMarkId: (markId: string | null) => { // NEW action
      set((state) => {
        state.focusedMarkId = markId;
        // Optionally clear comment focus when mark focus changes
        // if (markId !== null) {
        //     state.focusedCommentId = null; 
        // }
      });
    },
    // --- END NEW ---
    // --- NEW: Amendment Filter Action ---
    toggleShowAmendments: () => {
      set((state) => {
        state.showAmendments = !state.showAmendments;
      });
    },

    // --- NEW: Sidebar Action ---
    toggleSidebar: () => {
      set((state) => {
        state.isSidebarCollapsed = !state.isSidebarCollapsed;
      });
    },
    // --- END NEW ---

    // --- Add back actions for change tracking & submission ---
    setOriginalContent: (content: LegislationContent | null) => {
      set((state) => {
        state.originalLegislationContent = content 
            ? JSON.parse(JSON.stringify(content)) // Deep copy
            : null;
        state.hasUnsavedChanges = false; // Reset flag when new content is loaded
      });
    },

    submitChangesForReview: async () => {
      const supabase = createClient();
      const {
        selectedLegislation,
        fullDocumentHtml, // Current proposed HTML
        initialFullDocumentHtml, // The very first loaded HTML
        hasUnsavedChanges
      } = get();

      // Check if initial content was ever loaded
      if (initialFullDocumentHtml === null && selectedLegislation) {
         console.error("Submit Error: Initial content was never loaded or failed to load.");
         set({ submitStatus: { type: 'error', message: 'Cannot submit: Initial content missing.'}, isSubmitting: false });
         setTimeout(() => set({ submitStatus: null }), 5000);
         return { success: false, error: "Cannot submit: Initial content missing." };
      }

      // Check for actual changes relative to the initially loaded state
      // Note: hasUnsavedChanges flag is still useful for UI indication,
      // but this check prevents submitting if the user reverted back to original.
      if (fullDocumentHtml === initialFullDocumentHtml) {
        console.log("No effective changes compared to initial version.");
        set({ submitStatus: { type: 'success', message: 'No changes from original version.'}, isSubmitting: false });
        setTimeout(() => set({ submitStatus: null }), 3000);
        // Resetting hasUnsavedChanges as there's nothing to save
        set({ hasUnsavedChanges: false });
        return { success: true, error: "No changes from original version." };
      }


      if (!selectedLegislation || fullDocumentHtml === null) {
        // This check might be redundant now due to initialFullDocumentHtml check, but keep for safety
        console.error("Submit Error: Missing required data.", { selectedLegislation, fullDocumentHtml });
        set({ submitStatus: { type: 'error', message: 'Missing legislation data or current content.'}, isSubmitting: false });
        setTimeout(() => set({ submitStatus: null }), 5000);
        return { success: false, error: "Cannot submit: Missing current or original legislation data." };
      }

      // Get user ID
      const { data: { user }, error: userError } = await supabase.auth.getUser(); // Rely on server session handling if possible
      if (userError || !user) {
          console.error("Submit changes failed: User not authenticated.", userError);
          const message = `User not authenticated: ${userError?.message || 'Please log in.'}`;
          set({ submitStatus: { type: 'error', message }, isSubmitting: false });
          setTimeout(() => set({ submitStatus: null }), 5000);
          return { success: false, error: message };
      }
      const userId = user.id;

      // Prepare the payload for the API
      const payload = {
        identifier: selectedLegislation.identifier,
        title: selectedLegislation.title, // Send title
        initialHtml: initialFullDocumentHtml, // Send the absolute initial HTML
        proposedHtml: fullDocumentHtml, // Send the current HTML
      };

      set({ isSubmitting: true, submitStatus: null });
      try {
        console.log(`[AppStore] Submitting changes for ${payload.identifier} by user ${userId}.`);

        const response = await fetch(`/api/legislation/${payload.identifier}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload), // Send the new payload
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error("Error submitting changes via API:", errorData);
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        // Successfully submitted: Reset flag
        set(state => {
            state.hasUnsavedChanges = false; // Reset flag after successful submit
            state.isSubmitting = false;
            state.submitStatus = { type: 'success', message: result.message || 'Changes submitted successfully!' };
            // IMPORTANT: We might need to update `initialFullDocumentHtml` here if the workflow
            // assumes the newly submitted version becomes the new "base" for the *next* edit.
            // Or, refetching pending changes might handle this implicitly. Let's leave it for now.
        });
        setTimeout(() => set({ submitStatus: null }), 3000);

        console.log("Changes submitted successfully via API.");
        // Consider refetching pending changes here if needed: get().fetchAllChanges();
        return { success: true };

      } catch (err) {
        const message = err instanceof Error ? err.message : "An unknown error occurred during submission.";
        console.error("Submission failed:", message);
        set(state => {
            state.isSubmitting = false; // Ensure submitting is false on error
            state.submitStatus = { type: 'error', message };
        });
         // Clear status after delay
        setTimeout(() => set({ submitStatus: null }), 5000);
        return { success: false, error: message };
      }
    },
    // --- End add back --- 

    // --- Add state for comment sidebar visibility ---
    isCommentSidebarOpen: false,

    // --- Add action for combined content ---
    setFullDocumentHtml: (html) => {
        const previousHtml = get().fullDocumentHtml;
        // We use previousHtml for the unsaved changes *indicator* in the UI.
        // The actual check for submitting is against initialFullDocumentHtml.
        set((state) => {
            state.fullDocumentHtml = html;
            if (html !== previousHtml) {
                console.log("[Store] Content changed, marking as unsaved.");
                state.hasUnsavedChanges = true;
            } else {
                 // Avoid marking as unsaved if the content didn't actually change from the last state update
                 // console.log("[Store] Content update received, but no change detected from previous state.");
            }
        });
    },

    // --- Add action for comment sidebar ---
    toggleCommentSidebar: () => {
      console.warn("toggleCommentSidebar might be obsolete. Use setRightSidebarContent?");
      set((state) => ({ isCommentSidebarOpen: !state.isCommentSidebarOpen }));
    },

    // --- NEW: Comment Input/Submission Actions Implementation ---
    setActiveCommentInputMarkId: (markId: string | null) => {
        set((state) => {
            state.activeCommentInputMarkId = markId;
            state.commentSubmitError = null; // Clear previous errors when opening/closing
            // If opening the input, ensure the right sidebar shows comments
            if (markId !== null) {
                state.rightSidebarContent = 'comments';
            }
        });
    },

    submitComment: async (commentData: { comment_text: string; legislation_id: string; mark_id: string; section_key?: string }) => {
        if (!commentData.comment_text.trim() || !commentData.legislation_id || !commentData.mark_id) {
            console.error("Submit comment failed: Missing required data", commentData);
            set({ commentSubmitError: "Missing comment text, legislation ID, or mark ID.", isSubmittingComment: false });
            return { success: false };
        }

        set({ isSubmittingComment: true, commentSubmitError: null });

        try {
            const payload = { ...commentData, section_key: commentData.section_key || 'fullDocument' };
            console.log("[Store] Submitting comment via API call:", payload);

            const response = await fetch('/api/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const newComment: Comment = await response.json();
            console.log("[Store] Comment submitted successfully, adding to store:", newComment);

            get().addComment(newComment);
            set({ isSubmittingComment: false, activeCommentInputMarkId: null });
            return { success: true };

        } catch (error: any) {
            const message = error.message || "Failed to submit comment.";
            console.error("[Store] Failed to submit comment:", error);
            set({ isSubmittingComment: false, commentSubmitError: message });
            return { success: false };
        }
    },
    // --- END NEW ---

    // --- NEW: Right Sidebar Action Implementation ---
    setRightSidebarContent: (contentType: 'chat' | 'comments') => {
        set(state => {
            state.rightSidebarContent = contentType;
            // If switching away from comments, ensure the comment input is closed
            if (contentType !== 'comments') {
                state.activeCommentInputMarkId = null;
                state.commentSubmitError = null;
            }
            // Ensure the sidebar is open when content type is set explicitly
            if (!state.isRightSidebarOpen) {
                state.isRightSidebarOpen = true;
            }
        });
    },
    toggleRightSidebar: () => { // NEW: Implement toggle action
        set(state => {
            state.isRightSidebarOpen = !state.isRightSidebarOpen;
        });
    },
    // --- END NEW ---

    // --- NEW: Apply Suggestion Action Implementation ---
    applySuggestion: (originalText: string, suggestedText: string) => {
        set((state) => {
            if (state.fullDocumentHtml && originalText) {
                // Replace only the first occurrence for safety
                const updatedHtml = state.fullDocumentHtml.replace(originalText, suggestedText);
                if (updatedHtml !== state.fullDocumentHtml) {
                    console.log("[Store] Applying suggestion.");
                    state.fullDocumentHtml = updatedHtml;
                    state.hasUnsavedChanges = true;
                } else {
                    console.warn("[Store] Suggestion application failed: Original text not found in document.");
                    // Optionally notify the user here
                }
            } else {
                console.warn("[Store] Suggestion application failed: Missing document HTML or original text.");
            }
        });
    },
    // --- END NEW ---
  }))
);

// --- Helper function used in fetchLegislationContent and resetContent ---
const generateSafeId = (input: string): string => {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ') // Remove invalid chars
        .trim()
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-'); // Replace multiple hyphens with single
};

// --- Selectors (No changes needed here, but kept for reference) ---

// Memoized selector to get the filtered legislation list
export const useFilteredLegislationList = () => {
  // Select the necessary state slices
  const allLegislationList = useAppStore((state) => state.allLegislationList);
  const searchTerm = useAppStore((state) => state.searchTerm);
  const selectedTypes = useAppStore((state) => state.selectedTypes);
  const showAmendments = useAppStore((state) => state.showAmendments);

  // Memoize the filtering logic
  const filteredList = useMemo(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    if (!allLegislationList) return [];
    
    // Apply basic filtering (type and search term)
    const list = allLegislationList.filter(item => {
      const typeMatch = selectedTypes.includes(item.type);
      if (!typeMatch) return false;

      const amendmentMatch = showAmendments || !(item.isAmendment ?? item.title.toLowerCase().includes('amendment'));
        if (!amendmentMatch) return false;

      if (!searchTerm) return true; 

      const searchableText = `${item.title} ${item.year} ${item.identifier} ${item.type}`.toLowerCase();
      return searchableText.includes(lowerCaseSearchTerm);
    });

    return list;
  }, [allLegislationList, searchTerm, selectedTypes, showAmendments]); // Dependencies for memoization

  return filteredList;
};

// Selector to get the current app state (can be simplified if not needed elsewhere)
// export const useAppState = () => useAppStore((state) => state);

// Selector to specifically get actions (not needed with top-level actions)
// export const useAppActions = () => useAppStore((state) => state.actions);

// Selector to get the list of available types
export const useAvailableTypes = () => useAppStore((state) => state.availableTypes);

// Selector to get the currently selected types
export const useSelectedTypes = () => useAppStore((state) => state.selectedTypes);

// Selector for hasUnsavedChanges flag
export const useHasUnsavedChanges = () => useAppStore((state) => state.hasUnsavedChanges);

// Hooks for comments
export const useComments = () => useAppStore((state) => state.comments);
export const useIsLoadingComments = () => useAppStore((state) => state.isLoadingComments);
export const useCommentsError = () => useAppStore((state) => state.commentsError);
export const useFocusedCommentId = () => useAppStore((state) => state.focusedCommentId); // Hook for focused comment
export const useFocusedMarkId = () => useAppStore((state) => state.focusedMarkId); // Hook for focused mark

// Action Hook for Comments
export const useCommentActions = () => {
  const fetchComments = useAppStore((state) => state.fetchComments);
  const addComment = useAppStore((state) => state.addComment);
  const setFocusedCommentId = useAppStore((state) => state.setFocusedCommentId);
  const setFocusedMarkId = useAppStore((state) => state.setFocusedMarkId);
  const setActiveCommentInputMarkId = useAppStore((state) => state.setActiveCommentInputMarkId);
  const submitComment = useAppStore((state) => state.submitComment);

  return useMemo(() => ({
    fetchComments,
    addComment,
    setFocusedCommentId,
    setFocusedMarkId,
    setActiveCommentInputMarkId,
    submitComment,
  }), [fetchComments, addComment, setFocusedCommentId, setFocusedMarkId, setActiveCommentInputMarkId, submitComment]);
};

// Selector for sidebar state
export const useIsSidebarCollapsed = () => useAppStore((state) => state.isSidebarCollapsed);

// Selector for comment sidebar visibility
export const useIsCommentSidebarOpen = () => useAppStore((state) => state.isCommentSidebarOpen);

export const useSubmitStatus = () => useAppStore((state) => state.submitStatus);
export const useIsSubmitting = () => useAppStore((state) => state.isSubmitting);
export const useActiveCommentInputMarkId = () => useAppStore((state) => state.activeCommentInputMarkId);
export const useIsSubmittingComment = () => useAppStore((state) => state.isSubmittingComment);
export const useCommentSubmitError = () => useAppStore((state) => state.commentSubmitError);
export const useRightSidebarContent = () => useAppStore((state) => state.rightSidebarContent);
export const useIsRightSidebarOpen = () => useAppStore((state) => state.isRightSidebarOpen); // NEW: Selector