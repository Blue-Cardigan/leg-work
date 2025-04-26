'use client';

import React from 'react';
import { TocItem } from '@/lib/store/useAppStore'; // Import necessary types

// Helper function to generate safe IDs from titles or hrefs (copied from MainContent)
const generateSafeId = (input: string): string => {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ') // Remove invalid chars
        .trim()
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-'); // Replace multiple hyphens with single
};

interface TableOfContentsProps {
  toc: TocItem[];
  activeTocId: string | null;
  // Optional callback if needed in the future
  // onTocItemClick?: (id: string) => void;
}

const TableOfContents: React.FC<TableOfContentsProps> = ({ toc, activeTocId }) => {
  if (!toc || toc.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
        No table of contents available for this document.
      </div>
    );
  }

  return (
    <div className="p-4 h-full overflow-y-auto">
      <h3 className="text-md font-semibold mb-3 text-gray-700 dark:text-gray-300 sticky top-0 bg-gray-100 dark:bg-gray-800 py-2 border-b border-gray-200 dark:border-gray-700">Table of Contents</h3>
      <ul className="space-y-1">
          {toc.map((item: TocItem, index: number) => {
              const sectionId = generateSafeId(item.title || `section-${index}`);
              const isHeading = item.fullHref.includes('#heading-');
              const isActive = activeTocId === sectionId && !isHeading;
              return (
                  <li key={`${item.fullHref}-${index}`} style={{ paddingLeft: `${item.level * 1.5}rem` }} className="mb-1">
                     {isHeading ? (
                        <span
                           className="text-xs text-gray-600 dark:text-gray-400 font-semibold uppercase tracking-wide block truncate"
                           title={item.title}
                        >
                           {item.title}
                        </span>
                     ) : (
                        <a
                            href={`#${sectionId}`}
                            // Add conditional styling for active link
                            className={`text-sm hover:underline block truncate ${isActive ? 'text-blue-700 dark:text-blue-300 font-bold' : 'text-blue-600 dark:text-blue-400'}`}
                            title={`Jump to: ${item.title}`}
                            // onClick={(e) => {
                            //   e.preventDefault(); // Prevent default jump
                            //   document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            //   // if (onTocItemClick) onTocItemClick(sectionId); // Optional callback
                            // }}
                        >
                            {item.title}
                        </a>
                     )}
                  </li>
              );
           })}
      </ul>
    </div>
  );
};

export default TableOfContents; 