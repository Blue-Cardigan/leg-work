'use client'; // Mark as a Client Component

import { useEffect } from 'react';
// Revert to direct import of the main store hook and necessary types
import { 
  useAppStore, 
  LegislationItem, // Ensure LegislationItem is exported from store
  // Import the selector hook
  useFilteredLegislationList, 
} from '@/lib/store/useAppStore'; 

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

  // Fetch list on component mount
  useEffect(() => {
    fetchLegislationList();
  }, [fetchLegislationList]);

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

  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
      {/* Title & Search Input */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
         <h2 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">Draft Legislation</h2>
        <input
          type="text"
          placeholder="Search by title, year, ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoadingList}
        />
      </div>

      {/* Type Filters Section */}
      {/* Ensure availableTypes is available before mapping */}
      {availableTypes && availableTypes.length > 0 && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium mb-2 text-gray-600 dark:text-gray-400">Filter by Type:</h3>
          <div className="space-y-1">
            {availableTypes.map((type: string) => (
              <label key={type} className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  // Ensure selectedTypes is available before checking includes
                  checked={selectedTypes?.includes(type) ?? false}
                  onChange={(e) => handleTypeChange(type, e.target.checked)}
                  className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 bg-white dark:bg-gray-700"
                  disabled={isLoadingList}
                />
                <span>{type.toUpperCase()}</span> 
              </label>
            ))}
          </div>
        </div>
      )}

      {/* List Area */}
      <div className="flex-grow overflow-y-auto">
        {isLoadingList && <div className="p-4 text-center text-gray-500 dark:text-gray-400">Loading list...</div>}
        {error && <div className="p-4 text-center text-red-600 dark:text-red-400">Error loading list: {typeof error === 'string' ? error : 'Unknown error'}</div>}
        {/* Check filteredLegislationList availability before accessing length */} 
        {!isLoadingList && !error && (!filteredLegislationList || filteredLegislationList.length === 0) && (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
             {searchTerm || (availableTypes && selectedTypes && selectedTypes.length !== availableTypes.length) 
               ? `No documents match "${searchTerm}" ${availableTypes && selectedTypes && selectedTypes.length !== availableTypes.length ? 'with selected types' : ''}.` 
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
  );
} 