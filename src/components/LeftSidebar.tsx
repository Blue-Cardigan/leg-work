'use client'; // Mark as a Client Component

import { useEffect, useState } from 'react';
// Revert to direct import of the main store hook and necessary types
import { 
  useAppStore, 
  LegislationItem, // Ensure LegislationItem is exported from store
  // Import the selector hook
  useFilteredLegislationList, 
} from '@/lib/store/useAppStore'; 
// Import Auth components and types
import UserAuth from './UserAuth';
import { createClient } from '@/lib/supabaseClient';
// Correct import for User type
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js'; 
import { Info, Filter } from 'lucide-react'; // Icon for the prompt and Filter button
import { Button } from '@/components/ui/button'; // Import Button
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu" // Import Dropdown components

export default function LeftSidebar() {
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
  const supabase = createClient();
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

  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
      {/* Title, Search Input & Filter Dropdown */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">Draft Legislation</h2>
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

      {/* List Area */}
      <div className="flex-grow overflow-y-auto">
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

      {/* Footer: Auth Component and Prompt */}
      <div className="p-2 border-t border-gray-200 dark:border-gray-700 mt-auto bg-gray-50 dark:bg-gray-900/50">
        {/* Login Prompt */} 
        {!authLoading && !isLoggedIn && (
            <div className="flex items-start space-x-2 text-xs text-gray-600 dark:text-gray-400 mb-2 p-2 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                 <Info className="h-4 w-4 mt-0.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                 <span>Log in with your account to propose and track changes to legislation documents.</span>
            </div>
        )}
        {/* Auth Component */} 
        <div className="flex justify-center">
            <UserAuth />
        </div>
      </div>
    </div>
  );
} 