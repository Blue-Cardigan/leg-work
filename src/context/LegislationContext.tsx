'use client';

import React, { createContext, useState, useContext, ReactNode } from 'react';

// Define the shape of a legislation item based on the list API response
export interface LegislationItem {
  title: string;
  href: string; // Full URL to the content page
  identifier: string;
  type: string;
  year: string;
}

interface LegislationContextType {
  selectedItem: LegislationItem | null;
  setSelectedItem: (item: LegislationItem | null) => void;
}

const LegislationContext = createContext<LegislationContextType | undefined>(undefined);

export const LegislationProvider = ({ children }: { children: ReactNode }) => {
  const [selectedItem, setSelectedItem] = useState<LegislationItem | null>(null);

  return (
    <LegislationContext.Provider value={{ selectedItem, setSelectedItem }}>
      {children}
    </LegislationContext.Provider>
  );
};

export const useLegislation = () => {
  const context = useContext(LegislationContext);
  if (context === undefined) {
    throw new Error('useLegislation must be used within a LegislationProvider');
  }
  return context;
}; 