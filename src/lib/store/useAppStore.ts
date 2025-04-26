import { create } from 'zustand';

// Assuming the ParsedLegislationItem is exported from the list route
// Adjust the import path based on your actual project structure
interface ParsedLegislationItem {
  title: string;
  href: string; // Full URL
  identifier: string;
  type: string;
  year: string;
}

interface TocItem {
  title: string;
  fullHref: string;
  level: number;
}

interface LegislationContent {
  introHtml: string | null;
  toc: TocItem[];
}

interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

interface AppState {
  legislationList: ParsedLegislationItem[];
  filteredLegislationList: ParsedLegislationItem[];
  selectedLegislation: ParsedLegislationItem | null;
  selectedLegislationContent: LegislationContent | null;
  isLoadingList: boolean; // Added for list loading state
  isLoadingContent: boolean;
  searchTerm: string;
  error: string | null; // Added error state
  chatMessages: ChatMessage[];
  isChatLoading: boolean;
  chatError: string | null;
  setLegislationList: (list: ParsedLegislationItem[]) => void;
  setSearchTerm: (term: string) => void;
  setSelectedLegislation: (item: ParsedLegislationItem | null) => void;
  fetchLegislationList: () => Promise<void>; // Added for fetching the list
  fetchLegislationContent: (href: string) => Promise<void>;
  sendChatMessage: (messageText: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  legislationList: [],
  filteredLegislationList: [],
  selectedLegislation: null,
  selectedLegislationContent: null,
  isLoadingList: false,
  isLoadingContent: false,
  searchTerm: '',
  error: null, // Initial error state
  chatMessages: [],
  isChatLoading: false,
  chatError: null,

  setLegislationList: (list) => {
    const uniqueList = list.reduce((acc, current) => {
      const x = acc.find(item => item.href === current.href);
      if (!x) {
        return acc.concat([current]);
      } else {
        return acc;
      }
    }, [] as ParsedLegislationItem[]);

    set({
      legislationList: uniqueList,
      filteredLegislationList: uniqueList,
      searchTerm: '',
      isLoadingList: false,
      error: null,
    });
  },

  fetchLegislationList: async () => {
    if (get().isLoadingList) return; // Prevent concurrent fetches
    set({ isLoadingList: true, legislationList: [], filteredLegislationList: [], error: null }); // Clear error on new fetch
    try {
      const response = await fetch('/api/legislation/list');
      if (!response.ok) {
        throw new Error(`Failed to fetch legislation list: ${response.statusText}`);
      }
      const data: ParsedLegislationItem[] = await response.json();
      get().setLegislationList(data); // Use the existing setter
    } catch (error: any) { // Catch error
      console.error("Error fetching legislation list:", error);
      set({ isLoadingList: false, error: error.message ?? 'Failed to fetch list' }); // Set error state
    }
  },

  setSearchTerm: (term) => {
    set({ searchTerm: term });
    const filtered = get().legislationList.filter((item) =>
      item.title.toLowerCase().includes(term.toLowerCase())
    );
    set({ filteredLegislationList: filtered });
  },

  setSelectedLegislation: (item) => {
    const currentSelection = get().selectedLegislation;
    console.log(`[API /legislation/content] Setting selected legislation: ${item?.href}`);
    // Only proceed if the selection actually changes or if forcing a refresh (e.g., item is not null and same as current)
    if (item?.href !== currentSelection?.href || (item && !get().selectedLegislationContent && !get().isLoadingContent)) {
        set({ selectedLegislation: item, selectedLegislationContent: null, isLoadingContent: false, error: null }); // Clear error on new selection
        console.log(`[API /legislation/content] Setting selected legislation: ${item?.href}`);
        if (item) {
          get().fetchLegislationContent(item.href); // Trigger content fetch for the new item
        } 
    } else if (!item) {
         set({ selectedLegislation: null, selectedLegislationContent: null, isLoadingContent: false, error: null }); // Clear error on deselect
    }
  },

  fetchLegislationContent: async (href) => {
    console.log(`[API /legislation/content] Fetching content for href: ${href}`);
    set({ isLoadingContent: true, error: null }); // Clear error on new content fetch
    try {
      const response = await fetch(`/api/legislation/content?href=${encodeURIComponent(href)}`);
      console.log(`[API /legislation/content] Fetching content for href: ${href}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch content: ${response.statusText}`);
      }
      const data: LegislationContent = await response.json();
      // Ensure the fetched content still matches the currently selected item
      if (get().selectedLegislation?.href === href) {
          set({ selectedLegislationContent: data, isLoadingContent: false });
      }
    } catch (error: any) { // Catch error
      console.error("Error fetching legislation content:", error);
       // Ensure the error state is set for the currently selected item
      if (get().selectedLegislation?.href === href) {
          set({ isLoadingContent: false, selectedLegislationContent: null, error: error.message ?? 'Failed to fetch content' }); // Set error state
      }
    }
  },

  sendChatMessage: async (messageText) => {
    if (!messageText.trim() || get().isChatLoading) return;

    const newUserMessage: ChatMessage = { role: 'user', parts: [{ text: messageText }] };
    // Add user message immediately
    set(state => ({ 
        chatMessages: [...state.chatMessages, newUserMessage],
        isChatLoading: true, 
        chatError: null 
    }));

    try {
      const currentHistory = get().chatMessages.slice(0,-1); // History excludes the latest user message
      const response = await fetch('/api/chat', {
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
      let modelMessageAdded = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        modelResponseText += chunk;

        // Update the last message (model's response) incrementally
        set(state => {
            if (!modelMessageAdded) {
                // Add the initial model message placeholder if it doesn't exist
                modelMessageAdded = true;
                return { chatMessages: [...state.chatMessages, { role: 'model', parts: [{ text: modelResponseText }] }] };
            } else {
                 // Update the text of the last message (which should be the model's)
                const updatedMessages = [...state.chatMessages];
                if (updatedMessages.length > 0 && updatedMessages[updatedMessages.length - 1].role === 'model') {
                    updatedMessages[updatedMessages.length - 1] = { role: 'model', parts: [{ text: modelResponseText }] };
                    return { chatMessages: updatedMessages };
                }
                return {}; // Should not happen, return no change
            }
        });
      }
      
      // Handle potential final chunk
      const finalChunk = decoder.decode();
       if (finalChunk) {
          modelResponseText += finalChunk;
           set(state => { 
                 const updatedMessages = [...state.chatMessages];
                if (updatedMessages.length > 0 && updatedMessages[updatedMessages.length - 1].role === 'model') {
                    updatedMessages[updatedMessages.length - 1] = { role: 'model', parts: [{ text: modelResponseText }] };
                    return { chatMessages: updatedMessages };
                }
                return {}; // Should not happen
           });
      }

      set({ isChatLoading: false }); // Finish loading successfully

    } catch (error: any) {
      console.error("Chat request failed:", error);
      const errorMsg = error.message ?? 'An unknown chat error occurred';
      // Add an error message placeholder to the chat
      set(state => ({ 
        chatMessages: [...state.chatMessages, { role: 'model', parts: [{ text: `Error: ${errorMsg}` }] }],
        isChatLoading: false, 
        chatError: errorMsg 
      }));
    }
  },
})); 