'use client'; // Mark as a Client Component

import { useEffect } from 'react';
// import { useLegislation, LegislationItem } from '@/context/LegislationContext'; // OLD: Remove context import
import { useAppStore } from '@/lib/store/useAppStore'; // NEW: Import zustand store

export default function LeftSidebar() {
  // NEW: Use state and actions from the zustand store
  const {
    isLoadingList,
    filteredLegislationList,
    selectedLegislation,
    searchTerm,
    error, // Assuming you might add an error state to the store later if needed
    fetchLegislationList,
    setSearchTerm,
    setSelectedLegislation
  } = useAppStore();

  // OLD State - remove these
  // const [allLegislationItems, setAllLegislationItems] = useState<LegislationItem[]>([]);
  // const [loading, setLoading] = useState(true);
  // const [error, setError] = useState<string | null>(null);
  // const [searchTerm, setSearchTerm] = useState(''); // State for search input
  // const { selectedItem, setSelectedItem } = useLegislation(); // Use the context hook

  // Fetch list on component mount
  useEffect(() => {
    fetchLegislationList();
  }, [fetchLegislationList]);

  // OLD fetch logic - remove this useEffect
  // useEffect(() => {
  //   const fetchLegislation = async () => { ... };
  //   fetchLegislation();
  // }, [setSelectedItem]); 

  // OLD handler - remove this, use store action directly
  // const handleItemClick = (item: LegislationItem) => {
  //   setSelectedItem(item);
  // };

  // OLD filter logic - remove this, filtering is done in the store via setSearchTerm
  // const filteredItems = useMemo(() => { ... }, [allLegislationItems, searchTerm]);

  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
      {/* Search Input */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
         <h2 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">Draft Legislation</h2>
        <input
          type="text"
          placeholder="Search by title, year, ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)} // Use store action
          className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoadingList} // Disable while list is loading
        />
      </div>

      {/* List Area */}
      <div className="flex-grow overflow-y-auto">
        {isLoadingList && <div className="p-4 text-center text-gray-500 dark:text-gray-400">Loading list...</div>}
        {error && <div className="p-4 text-center text-red-600 dark:text-red-400">Error loading list: {typeof error === 'string' ? error : 'Unknown error'}</div>} {/* Handle potential error object */} 
        {!isLoadingList && !error && filteredLegislationList.length === 0 && (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
             {searchTerm ? `No documents match "${searchTerm}".` : 'No draft documents found.'}
          </div>
        )}
        {!isLoadingList && !error && filteredLegislationList.length > 0 && (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredLegislationList.map((item) => (
              // --- FIX: Use item.href as the key --- 
              <li key={item.href} > 
                <button
                  onClick={() => setSelectedLegislation(item)} // Use store action
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