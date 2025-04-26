import { create } from 'zustand';
import { useMemo } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { immer } from 'zustand/middleware/immer';
import type { User } from '@supabase/supabase-js';

// Define the shape of a legislation item
export interface LegislationItem {
  title: string;
  href: string; // Full URL
  identifier: string;
  type: string;
  year: string;
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
  sectionsHtml: { [href: string]: string | null };
}

// --- NEW: Define Chat Message structure --- 
export interface ChatMessagePart {
  text: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  parts: ChatMessagePart[];
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

  // --- NEW: Amendment Filter State ---
  showAmendments: boolean;
  // --- END NEW ---

  // --- Add back state for change tracking ---
  originalLegislationContent: LegislationContent | null; // Store the initial loaded content
  hasUnsavedChanges: boolean; // Flag to track edits
  // --- End Add back ---

  // Actions are now top-level methods
  fetchLegislationList: () => Promise<void>;
  setSearchTerm: (term: string) => void;
  setSelectedTypes: (types: string[]) => void; 
  setSelectedLegislation: (item: LegislationItem | null) => void;
  fetchLegislationContent: (url: string) => Promise<void>;
  resetContent: () => void;
  // --- NEW: Chat Actions ---
  sendChatMessage: (messageText: string) => Promise<void>;
  // --- END NEW ---
  // --- NEW: Editor Update Actions ---
  updateIntroHtml: (newHtml: string) => void;
  updateSectionHtml: (href: string, newHtml: string) => void;
  // --- END NEW ---
  // --- NEW: Amendment Filter Action ---
  toggleShowAmendments: () => void;
  // --- END NEW ---

  // --- Add back actions for change tracking & submission ---
  setOriginalContent: (content: LegislationContent | null) => void; // Internal action
  submitChangesForReview: () => Promise<{ success: boolean; error?: string }>;
  // --- End Add back ---
}

// Type definition for the Supabase table row (needed for submit action)
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

// Define the actions available in the store - REMOVED AppActions interface

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
    // --- NEW: Amendment Filter Initial State ---
    showAmendments: false, // Default to true
    // --- END NEW ---

    // --- Add back initial state for change tracking ---
    originalLegislationContent: null,
    hasUnsavedChanges: false,
    // --- End Add back ---

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
        return; // Don't reload if already selected
      }

      set((state) => {
        state.selectedLegislation = item;
        state.selectedLegislationContent = null; 
        state.originalLegislationContent = null; 
        state.isLoadingContent = !!item; // Correctly sets loading to true when an item is selected
        state.errorContent = null;
        state.hasUnsavedChanges = false; 
      });

      if (item?.href) {
        get().fetchLegislationContent(item.href);
      }
    },

    fetchLegislationContent: async (url: string) => {
      if (!url) return; 

      set((state) => {
          if (!state.isLoadingContent) state.isLoadingContent = true;
         state.errorContent = null;
         state.selectedLegislationContent = null; 
         state.originalLegislationContent = null; 
         state.hasUnsavedChanges = false;
      });

      try {
        const apiUrl = `/api/legislation/content?url=${encodeURIComponent(url)}`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
             const errorBody = await response.text(); 
             console.error(`[AppStore] HTTP error fetching content! Status: ${response.status}, URL: ${apiUrl}, Body: ${errorBody}`);
             throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: LegislationContent = await response.json(); 
        console.log("[AppStore] Content received:", data);

         if (!data || typeof data.introHtml === 'undefined' || !data.toc || !data.sectionsHtml) {
            console.error("[AppStore] Invalid content structure received:", data);
            throw new Error("Invalid content structure received from API.");
         }

        get().setOriginalContent(data);
        
        set((state) => {
          state.selectedLegislationContent = data;
          state.isLoadingContent = false; // Set loading false on success
          // hasUnsavedChanges is reset by setOriginalContent
        });

      } catch (e) {
         const error = e instanceof Error ? e : new Error(String(e));
        console.error("[AppStore] Failed to fetch legislation content:", error);
        set((state) => {
          state.errorContent = error.message;
          state.isLoadingContent = false; // Set loading false on error
          state.selectedLegislation = null; 
          state.selectedLegislationContent = null;
          state.originalLegislationContent = null;
          state.hasUnsavedChanges = false;
        });
      }
    },
    
     resetContent: () => {
        // --- Reset editable content to the stored original content --- 
        set((state) => {
            if (state.originalLegislationContent) {
                // Use deep copy to avoid modifying the original state accidentally
                state.selectedLegislationContent = JSON.parse(JSON.stringify(state.originalLegislationContent));
            }
            state.isLoadingContent = false;
            state.errorContent = null;
            state.hasUnsavedChanges = false; // Reset flag on discard
        });
        // --- End reset --- 
    },
    // --- NEW: Chat Actions Implementation ---
    sendChatMessage: async (messageText: string) => {
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
              message: messageText 
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

        // Add initial model message placeholder
        set(state => {
          state.chatMessages.push({ role: 'model', parts: [{ text: '' }] });
          modelMessageIndex = state.chatMessages.length - 1;
        });
  
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          modelResponseText += chunk;
  
          // Update the last message (model's response) incrementally using Immer
          set(state => {
            if (modelMessageIndex !== -1 && state.chatMessages[modelMessageIndex]) {
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
    // --- NEW: Editor Update Actions Implementation ---
    updateIntroHtml: (newHtml: string) => {
      set((state) => {
        if (state.selectedLegislationContent) {
          // Check if the content actually changed before updating state
          if (state.selectedLegislationContent.introHtml !== newHtml) {
            state.selectedLegislationContent.introHtml = newHtml;
            state.hasUnsavedChanges = true; // Set flag
          }
        }
      });
    },
    updateSectionHtml: (href: string, newHtml: string) => {
      set((state) => {
        if (state.selectedLegislationContent?.sectionsHtml) {
           // Check if the content actually changed before updating state
           if (state.selectedLegislationContent.sectionsHtml[href] !== newHtml) {
              state.selectedLegislationContent.sectionsHtml[href] = newHtml;
              state.hasUnsavedChanges = true; // Set flag
           }
        }
      });
    },
    // --- END NEW ---
    // --- NEW: Amendment Filter Action Implementation ---
    toggleShowAmendments: () => {
      set((state) => {
        state.showAmendments = !state.showAmendments;
      });
    },

    // --- Add back internal action to set original content --- 
    setOriginalContent: (content) => {
        set((state) => {
            // Deep copy to prevent mutations affecting the original state
            state.originalLegislationContent = content ? JSON.parse(JSON.stringify(content)) : null; 
            // Reset unsaved changes flag when new original content is set
            state.hasUnsavedChanges = false; 
        });
    },
    // --- End add back --- 

    // --- Add back action to submit changes --- 
    submitChangesForReview: async () => {
      const supabase = createClient(); // Create client instance for this action
      const {
        selectedLegislation,
        selectedLegislationContent,
        originalLegislationContent,
        hasUnsavedChanges
      } = get();

      if (!hasUnsavedChanges) {
          console.log("No unsaved changes to submit.");
          return { success: true, error: "No changes to submit." };
      }

      if (!selectedLegislation || !selectedLegislationContent || !originalLegislationContent) {
        console.error("Submit Error: Missing required data.", { selectedLegislation, selectedLegislationContent, originalLegislationContent });
        return { success: false, error: "Cannot submit: Missing current or original legislation data." };
      }

      // Get user ID
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
          console.error("Submit changes failed: User not authenticated.", userError);
           return { success: false, error: `User not authenticated: ${userError?.message || 'Please log in.'}` };
      }
      const userId = user.id;

      // Define the structure of the data to insert, excluding DB-generated fields
      const changesToSubmit: Omit<ProposedChange, 'id' | 'created_at'>[] = [];

      // Compare intro HTML
      if (selectedLegislationContent.introHtml !== originalLegislationContent.introHtml) {
        changesToSubmit.push({
          user_id: userId,
          legislation_id: selectedLegislation.href,
          legislation_title: selectedLegislation.title,
          section_key: 'intro',
          section_title: 'Introduction',
          original_html: originalLegislationContent.introHtml,
          proposed_html: selectedLegislationContent.introHtml,
          status: 'pending',
          context_before: null, // Placeholder for context
          context_after: null,  // Placeholder for context
        });
      }

      // Compare sections HTML
      const currentSections = selectedLegislationContent.sectionsHtml || {};
      const originalSections = originalLegislationContent.sectionsHtml || {};
      const tocMap = new Map(selectedLegislationContent.toc.map(item => [item.fullHref, item]));
      const allSectionKeys = new Set([...Object.keys(currentSections), ...Object.keys(originalSections)]);

      allSectionKeys.forEach(key => {
           const currentHtml = currentSections[key];
           const originalHtml = originalSections[key];

           if (currentHtml !== originalHtml) {
               const tocItem = tocMap.get(key);
               const sectionTitle = tocItem?.title || `Section (${key.split('#')[1] || key})`;
               // TODO: Implement logic to get context_before and context_after if needed

               changesToSubmit.push({
                   user_id: userId,
                   legislation_id: selectedLegislation.href,
                   legislation_title: selectedLegislation.title,
                   section_key: key,
                   section_title: sectionTitle,
                   original_html: originalHtml ?? null,
                   proposed_html: currentHtml ?? null,
                   status: 'pending',
                   context_before: null, // Placeholder
                   context_after: null,  // Placeholder
               });
           }
      });

      if (changesToSubmit.length === 0) {
          // This case might occur if hasUnsavedChanges was true but the content was reverted manually
          console.warn("Submit changes called, but no actual differences found.");
          set(state => { state.hasUnsavedChanges = false }); // Correct the flag
          return { success: true, error: "No actual changes detected to submit." }; 
      }

      try {
        console.log(`[AppStore] Submitting ${changesToSubmit.length} changes for user ${userId}.`);
        const { error } = await supabase
          .from('proposed_changes')
          .insert(changesToSubmit);

        if (error) {
          console.error("Error submitting changes to Supabase:", error);
          throw error;
        }

        // Successfully submitted: Update original content to reflect submitted changes & reset flag
        get().setOriginalContent(selectedLegislationContent); // Use the internal action
        // The setOriginalContent action already resets hasUnsavedChanges

        console.log("Changes submitted successfully.");
        return { success: true };

      } catch (err) {
        const message = err instanceof Error ? err.message : "An unknown error occurred during submission.";
        console.error("Submission failed:", message);
        // Don't reset hasUnsavedChanges on failure, allow retry
        return { success: false, error: message };
      }
    },
    // --- End add back --- 
  }))
);

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
    
    // Apply basic filtering (type and search term)
    let list = allLegislationList.filter(item => {
      const typeMatch = selectedTypes.includes(item.type);
      if (!typeMatch) return false;

      if (!searchTerm) return true; 

      const searchableText = `${item.title} ${item.year} ${item.identifier} ${item.type}`.toLowerCase();
      return searchableText.includes(lowerCaseSearchTerm);
    });

    // Apply amendment filter if necessary
    if (!showAmendments) {
      list = list.filter(item => 
        !item.title.toLowerCase().includes('amendment')
      );
    }
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

// --- Add back selector for hasUnsavedChanges flag ---
export const useHasUnsavedChanges = () => useAppStore((state) => state.hasUnsavedChanges);
// --- End add back ---