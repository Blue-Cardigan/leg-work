import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer'; // Import immer

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
      if (item && item.href === get().selectedLegislation?.href) {
        return;
      }
      set((state) => {
        state.selectedLegislation = item;
        state.selectedLegislationContent = null; 
        state.isLoadingContent = false;
        state.errorContent = null;
      });
      if (item?.href) {
        get().fetchLegislationContent(item.href); // Call the top-level action
      }
    },

    fetchLegislationContent: async (url: string) => {
      if (!url) return;
      if (get().isLoadingContent) return; 

      set((state) => {
        state.isLoadingContent = true;
        state.errorContent = null;
        state.selectedLegislationContent = null; 
      });

      try {
        const apiUrl = `/api/legislation/content?url=${encodeURIComponent(url)}`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: LegislationContent = await response.json(); 

        set((state) => {
          state.selectedLegislationContent = data;
          state.isLoadingContent = false;
        });
      } catch (e) {
         const error = e instanceof Error ? e : new Error(String(e));
        console.error("Failed to fetch legislation content:", error);
        set((state) => {
          state.errorContent = error.message;
          state.isLoadingContent = false;
        });
      }
    },
    
     resetContent: () => {
      set((state) => {
        state.selectedLegislationContent = null;
        state.isLoadingContent = false;
        state.errorContent = null;
      });
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
          state.selectedLegislationContent.introHtml = newHtml;
        }
      });
    },
    updateSectionHtml: (href: string, newHtml: string) => {
      set((state) => {
        if (state.selectedLegislationContent?.sectionsHtml) {
          state.selectedLegislationContent.sectionsHtml[href] = newHtml;
        }
      });
    }
    // --- END NEW ---
  }))
);

// --- Selectors (No changes needed here, but kept for reference) ---

// Selector to get the filtered legislation list based on search term AND selected types
export const useFilteredLegislationList = () => useAppStore((state) => {
  const { allLegislationList, searchTerm, selectedTypes, availableTypes } = state;
  const lowerCaseSearchTerm = searchTerm.toLowerCase();

  if (!searchTerm && selectedTypes.length === availableTypes.length) {
    return allLegislationList;
  }

  return allLegislationList.filter(item => {
    const typeMatch = selectedTypes.includes(item.type);
    if (!typeMatch) return false;

    if (!searchTerm) return true; 

    const searchableText = `${item.title} ${item.year} ${item.identifier} ${item.type}`.toLowerCase();
    return searchableText.includes(lowerCaseSearchTerm);
  });
});

// Selector to get the current app state (can be simplified if not needed elsewhere)
// export const useAppState = () => useAppStore((state) => state);

// Selector to specifically get actions (not needed with top-level actions)
// export const useAppActions = () => useAppStore((state) => state.actions);

// Selector to get the list of available types
export const useAvailableTypes = () => useAppStore((state) => state.availableTypes);

// Selector to get the currently selected types
export const useSelectedTypes = () => useAppStore((state) => state.selectedTypes); 