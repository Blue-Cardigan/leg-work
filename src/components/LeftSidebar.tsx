'use client'; // Mark as a Client Component

import { useEffect, useState } from 'react';
// Revert to direct import of the main store hook and necessary types
import { 
  useAppStore, 
  LegislationItem, // Ensure LegislationItem is exported from store
  // Import the selector hook
  useFilteredLegislationList, 
  useIsSidebarCollapsed,
  // --- NEW: Import actions/state for right sidebar ---
  useRightSidebarContent,
  useIsRightSidebarOpen, // Import the new selector
  // --- END NEW ---
} from '@/lib/store/useAppStore'; 
// Import Auth components and types
import UserAuth from './UserAuth';
// Correct import for Supabase client from the local factory function
import { createClient } from '@/lib/supabaseClient'; 
// Correct import for User type and other auth types
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js'; 
import { Info, Filter, PanelLeftClose, PanelRightClose, ListTree, MessageSquare, Trash2, Send, Loader2, MessageCircle, PanelLeftOpen, PanelRightOpen, X } from 'lucide-react'; // Icon for the prompt and Filter button, and new icons for toggle and ListTree
import { Button } from '@/components/ui/button'; // Import Button
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu" // Import Dropdown components
import TableOfContents from './TableOfContents';

// --- NEW: Props for LeftSidebar --- 
interface LeftSidebarProps {
  activeTocId: string | null; // Receive active ID from parent
  isTocVisible: boolean; // Receive TOC visibility state
  toggleTocVisibility: () => void; // Receive TOC toggle handler
}
// --- END NEW ---

export default function LeftSidebar({ activeTocId, isTocVisible, toggleTocVisibility }: LeftSidebarProps) { // Accept new props
  // Select necessary state and actions directly from the store
  const isLoadingList = useAppStore((state) => state.isLoadingList);
  const selectedLegislation = useAppStore((state) => state.selectedLegislation);
  const searchTerm = useAppStore((state) => state.searchTerm);
  const error = useAppStore((state) => state.error);
  // Access top-level actions
  const fetchLegislationList = useAppStore((state) => state.fetchLegislationList);
  const setSearchTerm = useAppStore((state) => state.setSearchTerm);
  const setSelectedLegislation = useAppStore((state) => state.setSelectedLegislation);
  const setSelectedTypes = useAppStore((state) => state.setSelectedTypes);
  const availableTypes = useAppStore((state) => state.availableTypes);
  const selectedTypes = useAppStore((state) => state.selectedTypes);
  // --- Get amendment state and action ---
  const showAmendments = useAppStore((state) => state.showAmendments);
  const toggleShowAmendments = useAppStore((state) => state.toggleShowAmendments);
  // ----------------------------------

  // --- Sidebar state --- 
  const isSidebarCollapsed = useIsSidebarCollapsed();
  const toggleSidebar = useAppStore((state) => state.toggleSidebar); // Select function directly
  // ---------------------

  // --- Use the dedicated selector hook for the filtered list --- 
  const filteredLegislationList = useFilteredLegislationList(); 
  // --- Remove the inline calculation --- 
  /*
  const filteredLegislationList = useAppStore((state) => {
    const lowerCaseSearchTerm = state.searchTerm.toLowerCase();
    // Ensure allLegislationList is available before filtering
    if (!state.allLegislationList) return []; 
    return state.allLegislationList.filter(item => {
      // Filter by type (Ensure selectedTypes is available)
      const typeMatch = state.selectedTypes?.includes(item.type);
      if (!typeMatch) return false;
  
      // Filter by search term (if any)
      if (!state.searchTerm) return true; // No search term, so type match is enough
  
      const searchableText = `${item.title} ${item.year} ${item.identifier} ${item.type}`.toLowerCase();
      return searchableText.includes(lowerCaseSearchTerm);
    });
  });
  */

  // Local state for auth status
  const supabase = createClient(); // Use the factory function
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Fetch list on component mount
  useEffect(() => {
    fetchLegislationList();
  }, [fetchLegislationList]);

  // Fetch user state and listen for auth changes
  useEffect(() => {
    setAuthLoading(true);
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setAuthLoading(false);
    };
    fetchUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => { // Add explicit types
        setUser(session?.user ?? null);
        setAuthLoading(false);
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [supabase.auth]);

  // Handler for checkbox changes
  const handleTypeChange = (type: string, checked: boolean) => {
    // Ensure selectedTypes is available
    if (!selectedTypes) return; 
    let newSelectedTypes: string[];
    if (checked) {
      // Add type to selection if not already present
      newSelectedTypes = selectedTypes.includes(type) ? selectedTypes : [...selectedTypes, type];
    } else {
      // Remove type from selection
      newSelectedTypes = selectedTypes.filter((t: string) => t !== type); // Explicit type added
    }
    setSelectedTypes(newSelectedTypes);
  };

  const isLoggedIn = !authLoading && !!user;

  // --- Get state and actions for relocated buttons ---
  const comments = useAppStore((state) => state.comments); // Keep comments for badge

  // --- NEW: Get right sidebar state and action --- 
  const rightSidebarContent = useRightSidebarContent();
  const setRightSidebarContent = useAppStore((state) => state.setRightSidebarContent); 
  const isRightSidebarOpen = useIsRightSidebarOpen(); // Get the state
  const toggleRightSidebar = useAppStore((state) => state.toggleRightSidebar); // Get the action
  // --- END NEW ---

  // --- NEW: Handler for combined right sidebar toggle --- 
  const handleRightSidebarToggle = (contentType?: 'chat' | 'comments') => {
    const currentContent = useAppStore.getState().rightSidebarContent; // Access store directly
    const isOpen = useAppStore.getState().isRightSidebarOpen;

    if (isOpen) {
        // If it's open and we click the same button (or the general toggle)
        if (!contentType || contentType === currentContent) {
           toggleRightSidebar(); // Close it
        } else {
            // If it's open but we click the *other* content type button
            setRightSidebarContent(contentType); // Switch content, remains open
        }
    } else {
        // If it's closed, open it and set the content
        if (contentType) {
            setRightSidebarContent(contentType); // This action now also sets isRightSidebarOpen = true
        } else {
             // If using a general toggle button without specifying content,
             // open it with the *current* content type selected.
             toggleRightSidebar(); 
        }
    }
  };
  // --- END NEW ---

  return (
    <div className={`flex flex-col h-full bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-16' : 'w-80'}`}>
      
      {/* Header Section with Toggle Button */} 
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
         {!isSidebarCollapsed && <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 truncate">Draft Legislation</h2>}
         <Button variant="ghost" size="icon" onClick={toggleSidebar} className="ml-auto">
           {isSidebarCollapsed ? <PanelRightClose className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
         </Button>
      </div>

      {/* Conditional Content: List/Filters or Collapsed View Buttons */}
      <div className="flex-grow overflow-hidden"> {/* Use hidden to prevent scrollbar flash during transition */}
        {isSidebarCollapsed ? (
          // --- Collapsed View: Add TOC Toggle Button --- 
          <div className="h-full flex flex-col items-center pt-4 space-y-2"> 
             {/* Add TOC Toggle Button - only show if legislation is selected */}
             {selectedLegislation && (
               <Button 
                 variant={isTocVisible ? "secondary" : "ghost"} // Highlight if TOC is visible
                 size="icon" 
                 onClick={toggleTocVisibility} 
                 title={isTocVisible ? "Hide Table of Contents" : "Show Table of Contents"}
               >
                 <ListTree className="h-5 w-5" />
               </Button>
             )}
             {/* Collapsed Chat Toggle */}
             {selectedLegislation && (
                 <Button
                   variant={isRightSidebarOpen && rightSidebarContent === 'chat' ? 'secondary' : 'ghost'} // Highlight if chat panel is open
                   size="icon"
                   onClick={() => handleRightSidebarToggle('chat')} // Use specific content toggle
                   title={isRightSidebarOpen && rightSidebarContent === 'chat' ? "Close Chat Panel" : "Show AI Chat"} // Dynamic title
                 >
                   <MessageCircle className="h-5 w-5" /> 
                 </Button>
             )}
             {/* Collapsed Comments Toggle */}
             {selectedLegislation && (
                 <Button
                   variant={isRightSidebarOpen && rightSidebarContent === 'comments' ? 'secondary' : 'ghost'} // Highlight if comments panel is open
                   size="icon"
                   onClick={() => handleRightSidebarToggle('comments')} // Use specific content toggle
                   title={isRightSidebarOpen && rightSidebarContent === 'comments' ? "Close Comments Panel" : "Show Comments"} // Dynamic title
                   className="relative"
                 >
                   <MessageSquare className="h-5 w-5" />
                   {/* Comment count badge */} 
                   {Array.isArray(comments) && comments.length > 0 && (
                     <span className="absolute top-0 right-0 block h-4 w-4 transform translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                       {comments.length}
                     </span>
                   )}
                 </Button>
             )}
          </div>
        ) : (
          // --- Expanded View: Show Search, Filters, List --- 
          <div className="flex flex-col h-full">
            {/* Search and Filter Section */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex gap-1 items-center">
                <input
                  type="text"
                  placeholder="Search by title, year, ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-grow px-3 py-2 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
                  disabled={isLoadingList}
                />
                {/* --- Filter Dropdown --- */} 
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" disabled={isLoadingList} className="flex-shrink-0">
                      <Filter className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Filter Options</DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {/* Show Amendments Toggle */}
                    <DropdownMenuCheckboxItem
                      checked={showAmendments}
                      onCheckedChange={toggleShowAmendments}
                      disabled={isLoadingList}
                    >
                      Show Amendments
                    </DropdownMenuCheckboxItem>

                    {/* Type Filters - only show if availableTypes exist */}
                    {availableTypes && availableTypes.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Document Types</DropdownMenuLabel>
                        {availableTypes.map((type: string) => (
                          <DropdownMenuCheckboxItem
                            key={type}
                            checked={selectedTypes?.includes(type) ?? false}
                            onCheckedChange={(checked) => handleTypeChange(type, !!checked)} // Ensure checked is boolean
                            disabled={isLoadingList}
                          >
                            {type.toUpperCase()}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                {/* ------------------------ */} 
              </div>
            </div>

            {/* --- NEW: Minimal Right Sidebar Toggles (only chat/comment icons) --- */}
            {selectedLegislation && !isSidebarCollapsed && (
                <div className="p-2 px-4 border-b border-gray-200 dark:border-gray-700 flex justify-start items-center space-x-1">
                    <Button
                        variant={isRightSidebarOpen && rightSidebarContent === 'chat' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => handleRightSidebarToggle('chat')}
                        title={isRightSidebarOpen && rightSidebarContent === 'chat' ? "Close Chat Panel" : "Show AI Chat"}
                    >
                        <MessageCircle className="h-4 w-4" />
                    </Button>
                    <Button
                        variant={isRightSidebarOpen && rightSidebarContent === 'comments' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => handleRightSidebarToggle('comments')}
                        title={isRightSidebarOpen && rightSidebarContent === 'comments' ? "Close Comments Panel" : "Show Comments"}
                        className="relative"
                    >
                        <MessageSquare className="h-4 w-4" />
                        {Array.isArray(comments) && comments.length > 0 && (
                           <span className="absolute top-0 right-0 block h-3 w-3 transform translate-x-1 -translate-y-1 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center">
                              {comments.length}
                           </span>
                        )}
                    </Button>
                </div>
            )}
            {/* --- END NEW Minimal Toggles --- */}

            {/* List Area */}
            <div className="flex-grow overflow-y-auto pb-32">
              {isLoadingList && <div className="p-4 text-center text-gray-500 dark:text-gray-400">Loading list...</div>}
              {error && <div className="p-4 text-center text-red-600 dark:text-red-400">Error loading list: {typeof error === 'string' ? error : 'Unknown error'}</div>}
              {/* Check filteredLegislationList availability before accessing length */} 
              {!isLoadingList && !error && (!filteredLegislationList || filteredLegislationList.length === 0) && (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                   {searchTerm || (availableTypes && selectedTypes && selectedTypes.length !== availableTypes.length) 
                     ? `No documents match "${searchTerm}" ${availableTypes && selectedTypes && selectedTypes.length !== availableTypes.length ? 'with selected types' : ''}${!showAmendments ? ' (excluding amendments)' : ''}.` 
                     : 'No draft documents found.'}
                </div>
              )}
              {/* Check filteredLegislationList availability before mapping */} 
              {!isLoadingList && !error && filteredLegislationList && filteredLegislationList.length > 0 && (
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredLegislationList.map((item: LegislationItem) => ( // Add type to item
                    <li key={item.href} > 
                      <button
                        onClick={() => setSelectedLegislation(item)}
                        className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none ${
                          selectedLegislation?.href === item.href
                            ? 'bg-blue-100 dark:bg-blue-900 font-semibold'
                            : ''
                        }`}
                        title={`${item.title} (${item.type.toUpperCase()} ${item.year}) - ${item.identifier}`}
                      >
                        <span className="block font-medium text-gray-800 dark:text-gray-200">{item.title}</span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                          {item.type.toUpperCase()} {item.year} - ID: {item.identifier}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer: Auth Component and Prompt */}
      <div className={`sticky bottom-0 p-2 border-t border-gray-200 dark:border-gray-700 mt-auto bg-gray-50 dark:bg-gray-900/50 ${isSidebarCollapsed ? 'opacity-0 h-0 p-0 border-none' : 'opacity-100'} transition-opacity duration-300`}>
        {/* Login Prompt */} 
        {!authLoading && !isLoggedIn && !isSidebarCollapsed && (
            <div className="flex items-start space-x-2 text-xs text-gray-600 dark:text-gray-400 mb-2 p-2 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                 <Info className="h-4 w-4 mt-0.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                 <span>Log in with your account to propose and track changes to legislation documents.</span>
            </div>
        )}
        {/* Auth Component */} 
        <div className={`flex justify-center ${isSidebarCollapsed ? 'hidden' : ''}`}>
            <UserAuth />
        </div>
      </div>
    </div>
  );
} 