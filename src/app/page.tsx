'use client'; // Need this for useState

import { useState, useEffect } from 'react'; // Import useEffect
import LeftSidebar from "@/components/LeftSidebar";
import MainContent from "@/components/MainContent";
import RightSidebar from "@/components/RightSidebar";
import TableOfContents from '@/components/TableOfContents'; // Import TOC component
import CommentDisplaySidebar from '@/components/CommentDisplaySidebar'; // Import Comment Display Sidebar
import { useAppStore, useIsSidebarCollapsed, useIsCommentSidebarOpen, useIsRightSidebarOpen } from '@/lib/store/useAppStore'; // Import store and specific hooks
// Removed LegislationProvider - Assuming Zustand handles context
// import { LegislationProvider } from "@/context/LegislationContext";

export default function Home() {
  // --- State lifted up from components --- 
  const [activeTocId, setActiveTocId] = useState<string | null>(null);
  const [isTocVisible, setIsTocVisible] = useState(false); // NEW: State for TOC column visibility

  // --- Get necessary state from store --- 
  const selectedLegislationContent = useAppStore((state) => state.selectedLegislationContent);
  const selectedLegislation = useAppStore((state) => state.selectedLegislation); // Needed to check if TOC should display
  const isSidebarCollapsed = useIsSidebarCollapsed(); // Get sidebar state
  const isCommentSidebarOpen = useIsCommentSidebarOpen(); // Get comment sidebar state
  const isRightSidebarOpen = useIsRightSidebarOpen(); // <-- Get right sidebar state

  // --- Handlers --- 
  const handleTocItemVisible = (id: string) => {
      setActiveTocId(id);
  };
  const toggleTocVisibility = () => { // NEW: Handler to toggle TOC
      setIsTocVisible(prev => !prev);
  };
  // --------------------------------------

  // --- Effect to hide TOC when sidebar expands --- 
  useEffect(() => {
    if (!isSidebarCollapsed) {
      setIsTocVisible(false);
    }
  }, [isSidebarCollapsed]);
  // ---------------------------------------------

  return (
    // Removed LegislationProvider wrapper
      <div className="flex h-full bg-white dark:bg-gray-900 overflow-hidden">
        {/* Left Sidebar - Container width is handled internally */}
        <div className="flex-shrink-0 h-full border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 z-10">
          <LeftSidebar 
            activeTocId={activeTocId} 
            isTocVisible={isTocVisible} // Pass state down
            toggleTocVisibility={toggleTocVisibility} // Pass handler down
          /> 
        </div>

        {/* Table of Contents Column - Shown if legislation selected AND toggled on */}
        {selectedLegislation && isTocVisible && (
          <div className="w-64 flex-shrink-0 h-full border-r border-gray-200 dark:border-gray-700 overflow-y-auto bg-gray-50 dark:bg-gray-800/50 transition-all duration-300 ease-in-out">
            <TableOfContents 
              toc={selectedLegislationContent?.toc ?? []} 
              activeTocId={activeTocId} 
            />
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-grow overflow-y-auto h-full">
          <MainContent />
        </div>

        {/* Comment Display Sidebar - Shown if legislation selected AND toggled on */}
        {selectedLegislation && isCommentSidebarOpen && (
            <div className="w-80 flex-shrink-0 h-full border-l border-gray-200 dark:border-gray-700 overflow-y-auto bg-gray-50 dark:bg-gray-800/50 transition-all duration-300 ease-in-out">
                <CommentDisplaySidebar onCardClick={handleTocItemVisible} />
            </div>
        )}

        {/* Right Sidebar (Chat/Comments) - Conditionally render */}
        {isRightSidebarOpen && (
          <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto h-full">
            <RightSidebar />
          </div>
        )}
      </div>
    // Removed closing LegislationProvider tag
  );
}
