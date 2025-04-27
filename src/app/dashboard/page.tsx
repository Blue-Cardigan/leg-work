'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient'; // Use the client factory
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import DiffViewer from '@/components/ui/DiffViewer'; // Import the new DiffViewer component
import type { User } from '@supabase/supabase-js'; // Import User type
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion" // Import Accordion components
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'; // Import specific types

// Mirror the type definition from the store or define globally
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

export default function DashboardPage() {
    // Add console log here to see when the component renders/re-renders
    console.log('[DashboardPage] Component rendering/re-rendering.');
    const [supabase] = useState(() => {
        console.log('[DashboardPage] Creating Supabase client instance...');
        return createClient(); // Create client instance ONCE per component lifecycle
    });
    const [proposedChanges, setProposedChanges] = useState<ProposedChange[]>([]);
    const [isLoading, setIsLoading] = useState(true); // Start loading true initially
    const [error, setError] = useState<string | null>(null);
    const [user, setUser] = useState<User | null>(null); // Use specific User type

    useEffect(() => {
        console.log('[DashboardPage] useEffect running. Supabase client defined:', !!supabase);

        // Function to fetch changes
        const fetchChanges = async (currentUser: User) => {
            setIsLoading(true);
            setError(null);
            setProposedChanges([]); // Clear previous changes
            try {
                console.log(`[DashboardPage] Fetching proposed changes for user: ${currentUser.id}`);
                console.log('[DashboardPage] Preparing to call supabase.from...'); // <-- Added log
                const { data, error: changesError } = await supabase
                    .from('proposed_changes')
                    .select('*')
                    .eq('user_id', currentUser.id)
                    .order('created_at', { ascending: false });
                
                console.log('[DashboardPage] Supabase call returned.'); // <-- Added log

                if (changesError) {
                    console.error("[DashboardPage] Supabase query error object:", changesError); // <-- Log the specific error object
                    throw changesError;
                }

                console.log(`[DashboardPage] Fetched ${data?.length ?? 0} changes.`);
                setProposedChanges(data || []);
            } catch (err: any) {
                console.error("[DashboardPage] Error caught fetching proposed changes:", err);
                setError(err.message || "Failed to load your proposed changes.");
                setProposedChanges([]); // Ensure changes are cleared on error
            } finally {
                console.log("[DashboardPage] Fetch finished, setting loading to false.");
                setIsLoading(false);
            }
        };

        // Check initial auth state synchronously IF POSSIBLE (might still need listener)
        // This helps avoid flashing the "Loading..." state if user is already known
        supabase.auth.getUser().then(({ data: { user: initialUser } }: { data: { user: User | null } }) => {
             console.log("[DashboardPage] Initial auth check completed.", initialUser);
             if (initialUser) {
                 setUser(initialUser);
                 fetchChanges(initialUser); // Fetch immediately if user exists
             } else {
                 setIsLoading(false); // No user, stop loading (will be updated by listener if needed)
             }
        });


        // Combined listener for auth changes
        const { data: authListener } = supabase.auth.onAuthStateChange(
            (event: AuthChangeEvent, session: Session | null) => {
                console.log(`[DashboardPage] Auth event: ${event}`, session);
                const currentUser = session?.user ?? null;
                setUser(currentUser); // Update user state

                if (currentUser) {
                    // User is logged in or session restored, fetch their changes
                    // Avoid fetching if data is already loading from initial check
                    if (!isLoading) { 
                         fetchChanges(currentUser);
                    } else {
                        console.log("[DashboardPage] Auth event occurred while initial fetch might be loading, deferring to initial fetch.");
                    }
                } else {
                    // User is logged out
                    console.log("[DashboardPage] User logged out or session expired.");
                    setError(null); // Clear potential previous errors
                    setProposedChanges([]);
                    setIsLoading(false); // Not loading if logged out
                }
            }
        );

        // Cleanup listener on component unmount
        return () => {
            console.log("[DashboardPage] Cleaning up useEffect, unsubscribing auth listener.");
            authListener?.subscription.unsubscribe();
        };
        // We only want this effect to run once on mount to set up the listener.
        // Supabase client instance is stable due to useState initializer.
    }, [supabase]); // Dependency array ensures effect runs if supabase instance were to change (it won't here)


    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'pending': return 'bg-yellow-500 hover:bg-yellow-600';
            case 'approved': return 'bg-green-500 hover:bg-green-600';
            case 'rejected': return 'bg-red-500 hover:bg-red-600';
            default: return 'bg-gray-500 hover:bg-gray-600';
        }
    };

    // --- Grouping Logic ---
    const groupChanges = (changes: ProposedChange[]) => {
        // New structure: Record<legislationTitle, Record<sectionKey, ProposedChange[]>>
        const grouped: Record<string, Record<string, ProposedChange[]>> = {};
        changes.forEach(change => {
            if (!grouped[change.legislation_title]) {
                grouped[change.legislation_title] = {};
            }
            if (!grouped[change.legislation_title][change.section_key]) {
                grouped[change.legislation_title][change.section_key] = [];
            }
            // Add the change to the array for this section key
            grouped[change.legislation_title][change.section_key].push(change);
        });

        // Optional: Sort changes within each section key array by date (newest first)
        // The initial fetch already sorts globally, but this ensures order within the group
        Object.values(grouped).forEach(sections => {
            Object.values(sections).forEach(changeArray => {
                changeArray.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            });
        });

        return grouped;
    };

    const groupedChanges = groupChanges(proposedChanges);
    // --- End Grouping Logic ---

    // Simplified Loading state UI - show only when actively loading
    if (isLoading) {
         return (
            <div className="container mx-auto p-6 flex items-center justify-center min-h-[200px]"> {/* Added min-height */}
                <div className="text-center text-gray-500 dark:text-gray-400">
                     <svg className="animate-spin h-8 w-8 text-blue-500 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                         <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                         <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                     </svg>
                     Loading your proposed changes...
                 </div>
             </div>
         );
    }
    
    // Error state UI
    if (error) {
        return (
            <div className="container mx-auto p-6">
                 <Alert variant="destructive">
                    {/* <Terminal className="h-4 w-4" /> */}
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            </div>
        );
    }

    // Not logged in state UI (handled after loading and error checks)
    if (!user) {
         return (
             <div className="container mx-auto p-6">
                 <Alert>
                     <AlertTitle>Not Logged In</AlertTitle>
                     <AlertDescription>
                         Please log in using the sidebar to view your proposed changes.
                     </AlertDescription>
                 </Alert>
             </div>
         );
    }
    
    // Main content UI (when logged in, not loading, no error)
    return (
        <div className="container mx-auto p-6">
            {/* Add link back to home/editor */}
            <div className="mb-4"> 
              <Link href="/" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
                 &larr; Back to Editor
              </Link>
            </div>

            <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">Your Proposed Changes</h1>

             {proposedChanges.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400">You haven&apos;t proposed any changes yet.</p>
            ) : (
                <Accordion type="multiple" className="w-full space-y-4">
                    {Object.entries(groupedChanges).map(([legislationTitle, sections]) => (
                        <AccordionItem value={legislationTitle} key={legislationTitle} className="border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
                            <AccordionTrigger className="px-4 py-3 hover:no-underline">
                                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 truncate" title={legislationTitle}>{legislationTitle}</h2>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
                                <Accordion type="multiple" className="w-full space-y-2 mt-3">
                                     {/* Iterate through sections within the legislation */}
                                     {Object.entries(sections).map(([sectionKey, changesArray]) => {
                                        // Check if there are multiple changes for this section key
                                        const hasMultipleChanges = changesArray.length > 1;
                                        // Use the first change to determine the base title (they should be the same for the same sectionKey)
                                        const firstChange = changesArray[0];
                                        const sectionBaseTitle = `${firstChange.section_title}${sectionKey !== 'intro' ? ` (${sectionKey.split('#')[1] || sectionKey})` : ' (Introduction)'}`;

                                        return (
                                            // Now iterate through each change within the section's array
                                            <div key={sectionKey} className="space-y-2">
                                                {changesArray.map((change, index) => {
                                                    // Create a unique key for each individual change accordion item
                                                    const itemKey = `${sectionKey}-${change.id || index}`;
                                                    // Format the date for display if needed
                                                    const changeDate = new Date(change.created_at).toLocaleDateString();
                                                    // Append date to title only if there are multiple changes for this section
                                                    const sectionDisplayTitle = hasMultipleChanges
                                                        ? `${sectionBaseTitle} - Submitted: ${changeDate}`
                                                        : sectionBaseTitle;

                                                    return (
                                                        <AccordionItem value={itemKey} key={itemKey} className="border rounded bg-gray-50 dark:bg-gray-700">
                                                            <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">
                                                                <div className="flex justify-between items-center w-full">
                                                                    {/* Display title (with date if multiple) */}
                                                                    <span className="truncate mr-4" title={sectionDisplayTitle}>
                                                                        {sectionDisplayTitle}
                                                                    </span>
                                                                    <Badge className={`text-white text-xs ${getStatusColor(change.status)}`}>{change.status}</Badge>
                                                                </div>
                                                            </AccordionTrigger>
                                                            <AccordionContent className="px-3 pb-3 border-t border-gray-200 dark:border-gray-600">
                                                                <div className="mt-2">
                                                                    {/* Date is now conditionally in the title, or can be added here if preferred */}
                                                                    {/* <h4 className="text-xs font-semibold mb-1 text-gray-600 dark:text-gray-400">
                                                                        Change Details (Submitted: {changeDate}):
                                                                    </h4> */}
                                                                    <DiffViewer
                                                                        oldString={change.original_html}
                                                                        newString={change.proposed_html}
                                                                    />
                                                                </div>
                                                            </AccordionContent>
                                                        </AccordionItem>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </Accordion>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            )}
        </div>
    );
} 