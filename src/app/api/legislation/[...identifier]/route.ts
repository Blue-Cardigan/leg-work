// legislation-editor/src/pages/api/legislation/[identifier]/submit.ts

import { NextRequest, NextResponse } from 'next/server';
// Import the SERVER client creator and alias it
import { createClient as createServerSupabaseClient } from '@/lib/supabaseServer'; 
import { User } from '@supabase/supabase-js';

type ResponseData = {
    message?: string;
    error?: string;
    change_id?: number; // Optionally return the ID of the created change record
  };

export async function POST(
    request: NextRequest,
    { params }: { params: { identifier: string[] } }
): Promise<NextResponse<ResponseData>> {

    const identifierParts = await params.identifier;

    // Check if the last segment indicates the 'submit' action
    if (!identifierParts || identifierParts.length === 0 || identifierParts[identifierParts.length - 1] !== 'submit') {
        // If not 'submit', this endpoint doesn't handle it for POST
        return NextResponse.json({ error: 'Action not supported on this endpoint for POST' }, { status: 404 }); // Or 405 Method Not Allowed? 404 seems better.
    }

    // Reconstruct the actual identifier by removing the '/submit' part
    const actualIdentifierParts = identifierParts.slice(0, -1);
    if (actualIdentifierParts.length === 0) {
         return NextResponse.json({ error: 'Missing legislation identifier before /submit' }, { status: 400 });
    }
    const identifier = actualIdentifierParts.join('/');

    // Use the server client creator
    const supabase = await createServerSupabaseClient();

    // 1. Get User (Now uses server client with cookie access)
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        console.error('Submit API Error: User not authenticated', userError);
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = user.id;

    // 2. Extract Data
    let payload;
    try {
        payload = await request.json(); // Get data from request body
    } catch (e) {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const {
        proposedHtml,
        initialHtml, // The *very first* HTML loaded by the client
        title: legislationTitle // Get title from body
    } = payload;

    // Basic validation
    if (!identifier) {
        return NextResponse.json({ error: 'Missing or invalid legislation identifier' }, { status: 400 });
    }
    if (typeof proposedHtml !== 'string' || !proposedHtml) {
        return NextResponse.json({ error: 'Missing proposed content' }, { status: 400 });
    }
    if (typeof initialHtml !== 'string') {
        console.warn(`[API Submit] initialHtml not received as string for ${identifier}.`);
        // return NextResponse.json({ error: 'Missing initial content state' }, { status: 400 });
    }
    if (typeof legislationTitle !== 'string' || !legislationTitle) {
        console.warn(`[API Submit] legislationTitle not received for ${identifier}. Using default.`);
        // return NextResponse.json({ error: 'Missing legislation title' }, { status: 400 });
    }

    console.log(`[API Submit] Received submission for identifier: ${identifier} by user: ${userId}`);

    try {
        // 3. Determine the correct 'original_html' for *this* new change.
        let originalHtmlForNewChange: string | null;

        const { data: latestPendingChange, error: fetchLastError } = await supabase
            .from('proposed_changes')
            .select('proposed_html')
            .eq('legislation_id', identifier)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (fetchLastError) {
            console.error(`Error fetching latest pending change for ${identifier}:`, fetchLastError);
            return NextResponse.json({ error: 'Could not retrieve previous change state.' }, { status: 500 });
        }

        if (latestPendingChange) {
            originalHtmlForNewChange = latestPendingChange.proposed_html;
            console.log(`[API Submit] Found previous pending change. Using its proposed_html as original_html for new change.`);
        } else {
            originalHtmlForNewChange = initialHtml ?? null;
            console.log(`[API Submit] No previous pending changes found. Using initialHtml from client request as original_html.`);
        }

        if (proposedHtml === originalHtmlForNewChange) {
            console.log(`[API Submit] Proposed content is identical to the determined original state. No change needed.`);
            return NextResponse.json({ message: 'No change detected from the previous state.' }, { status: 200 });
        }

        // 4. Insert into proposed_changes table
        const { data: changeData, error: insertError } = await supabase
            .from('proposed_changes')
            .insert({
                user_id: userId,
                legislation_id: identifier,
                legislation_title: legislationTitle || `Title for ${identifier}`,
                section_key: 'fullDocument',
                section_title: 'Full Document',
                original_html: originalHtmlForNewChange,
                proposed_html: proposedHtml,
                status: 'pending',
            })
            .select('id')
            .single();

        if (insertError) {
            console.error('Error inserting proposed change:', insertError);
            throw insertError;
        }

        console.log(`[API Submit] Successfully inserted proposed change with ID: ${changeData.id}`);

        // 5. Respond with success
        return NextResponse.json({ message: 'Change proposed successfully!', change_id: changeData.id }, { status: 201 });

    } catch (error: any) {
        console.error('[API Submit] Unexpected error:', error);
        return NextResponse.json({ error: error.message || 'An unexpected error occurred.' }, { status: 500 });
    }
}

// Optional: Add handlers for other methods (GET, PUT, DELETE) if needed
// export async function GET(request: NextRequest, { params }: { params: { identifier: string[] } }) {
//    const identifier = params.identifier.join('/');
//    // ... handle GET ...
//    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
// }