'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import UserAuth from './UserAuth'; // Import the new auth component
import { createClient } from '@/lib/supabaseClient'; // Import client creator
import type { User } from '@supabase/supabase-js';

export default function Header() {
  const supabase = createClient(); // Create client instance
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // We need to fetch the user state here as well to control the dashboard link
  // Alternatively, this state could be lifted into a context or Zustand store
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };
    fetchUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [supabase.auth]);

  const isLoggedIn = !loading && !!user;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 dark:border-neutral-800">
      <div className="container flex h-14 items-center mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            {/* Add Logo/Icon here if desired */}
             <span className="hidden font-bold sm:inline-block text-lg text-gray-900 dark:text-gray-100">Legislation Editor</span>
          </Link>
          {/* Add main navigation links here if needed */}
          <nav className="flex items-center space-x-6 text-sm font-medium">
            {/* Example Nav Link */}
            {/* <Link href="/about" className="transition-colors hover:text-foreground/80 text-foreground/60">About</Link> */}
          </nav>
        </div>

        {/* Right side: Dashboard Link & Auth */}
        <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-2">
             {/* Show Dashboard link only if logged in */}
             {!loading && isLoggedIn && (
                 <Link 
                     href="/dashboard"
                     className="px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-accent hover:text-accent-foreground text-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                 >
                     My Changes
                 </Link>
             )}
             {/* User Authentication Component */}
             <UserAuth />
          </nav>
        </div>
      </div>
    </header>
  );
} 