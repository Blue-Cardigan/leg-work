import { createBrowserClient } from '@supabase/ssr'

// Ensure your environment variables are set in .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL")
}
if (!supabaseAnonKey) {
  throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY")
}

// Export a function that creates a client-side Supabase client
// This ensures a new client is created for each component instance if needed,
// though often it's used like a singleton within the browser context.
export function createClient() {
  console.log('[supabaseClient] createClient called. URL/Key presence:', !!supabaseUrl, !!supabaseAnonKey); // Log inside the factory too
  return createBrowserClient(supabaseUrl!, supabaseAnonKey!)
}

// You might also export a singleton instance if preferred for simplicity in client components,
// but the function approach is generally safer for avoiding shared state issues.
// export const supabase = createBrowserClient(supabaseUrl!, supabaseAnonKey!); 