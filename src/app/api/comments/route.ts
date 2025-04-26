import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer'; // Correct path for server-side client
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  console.log('[API /comments GET] Received request');
  const searchParams = request.nextUrl.searchParams;
  const legislationId = searchParams.get('legislation_id');
  // Optionally get section_key if needed for filtering later
  // const sectionKey = searchParams.get('section_key'); 

  if (!legislationId) {
    console.error('[API /comments GET] Error: Missing legislation_id parameter');
    return NextResponse.json({ error: 'Missing legislation_id parameter' }, { status: 400 });
  }

  const cookieStore = cookies();
  // Await the async client creation
  const supabase = await createClient(); 

  try {
    console.log(`[API /comments GET] Fetching comments for legislation_id: ${legislationId}`);
    
    // Base query
    let query = supabase
      .from('comments')
      .select('id, created_at, user_id, user_email, comment_text, mark_id, resolved_at, section_key') // Select desired fields
      .eq('legislation_id', legislationId)
      .order('created_at', { ascending: true }); // Order by creation date

    // Optional: Filter by section_key if provided
    // if (sectionKey) {
    //   query = query.eq('section_key', sectionKey);
    // }

    const { data, error } = await query;

    if (error) {
      console.error('[API /comments GET] Supabase error:', error);
      throw error; // Throw error to be caught by the outer try-catch
    }

    console.log(`[API /comments GET] Successfully fetched ${data?.length ?? 0} comments.`);
    return NextResponse.json(data || [], { status: 200 });

  } catch (error: any) {
    console.error('[API /comments GET] Cátch Error:', error);
    return NextResponse.json({ error: 'Failed to fetch comments', details: error.message }, { status: 500 });
  }
}

// --- POST Handler Implementation ---
export async function POST(request: NextRequest) {
  console.log('[API /comments POST] Received request');
  const cookieStore = cookies();
  // Await the async client creation
  const supabase = await createClient(); 

  // 1. Get User Session (Using getUser for server-side)
  // const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error('[API /comments POST] Authentication error:', userError);
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // User is authenticated, proceed using 'user' object
  const userId = user.id;
  const userEmail = user.email; // Assuming email is available

  // 2. Parse Request Body
  let body;
  try {
    body = await request.json();
  } catch (e) {
    console.error('[API /comments POST] Error parsing JSON body:', e);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { comment_text, legislation_id, section_key, mark_id } = body;

  // Basic validation
  if (!comment_text || !legislation_id || !section_key || !mark_id) {
    console.error('[API /comments POST] Missing required fields:', body);
    return NextResponse.json({ error: 'Missing required fields (comment_text, legislation_id, section_key, mark_id)' }, { status: 400 });
  }
  if (typeof comment_text !== 'string' || comment_text.trim().length === 0) {
    return NextResponse.json({ error: 'Comment text cannot be empty' }, { status: 400 });
  }

  // 3. Insert into Supabase
  try {
    console.log(`[API /comments POST] Inserting comment for user: ${userId}, mark_id: ${mark_id}`);
    const { data: newComment, error: insertError } = await supabase
      .from('comments')
      .insert({
        user_id: userId,
        user_email: userEmail, // Store for easy display
        legislation_id: legislation_id,
        section_key: section_key,
        comment_text: comment_text,
        mark_id: mark_id,
      })
      .select() // Return the inserted row
      .single(); // Expect only one row inserted

    if (insertError) {
      console.error('[API /comments POST] Supabase insert error:', insertError);
      // Check for unique constraint violation (mark_id likely)
      if (insertError.code === '23505') { 
          return NextResponse.json({ error: 'A comment with this mark ID already exists.' }, { status: 409 }); // Conflict
      }
      throw insertError; // Re-throw other errors
    }

    console.log(`[API /comments POST] Successfully inserted comment ID: ${newComment.id}`);
    // 4. Return created comment
    return NextResponse.json(newComment, { status: 201 }); // 201 Created

  } catch (error: any) {
    console.error('[API /comments POST] Cátch Error:', error);
    return NextResponse.json({ error: 'Failed to create comment', details: error.message }, { status: 500 });
  }
}

// --- PATCH Handler (Placeholder) ---
// export async function PATCH(request: NextRequest) {
//   // TODO: Implement comment update (e.g., resolve)
//   return NextResponse.json({ message: 'PATCH endpoint not implemented yet' }, { status: 501 });
// }

// --- DELETE Handler (Placeholder) ---
// export async function DELETE(request: NextRequest) {
//   // TODO: Implement comment deletion
//   return NextResponse.json({ message: 'DELETE endpoint not implemented yet' }, { status: 501 });
// } 