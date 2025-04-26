-- Drop table if it exists (optional, use with caution in production)
-- DROP TABLE IF EXISTS comments;

-- Create the table to store comments
CREATE TABLE comments (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Keep comment even if user deleted, but lose link
    user_email TEXT, -- Store email/display name at time of comment for simpler display
    legislation_id TEXT NOT NULL,      -- Identifier for the legislation document (e.g., the href)
    section_key TEXT NOT NULL,         -- Identifier for the section (e.g., 'intro' or fullHref)
    comment_text TEXT NOT NULL CHECK (char_length(comment_text) > 0),
    mark_id TEXT NOT NULL UNIQUE,       -- Unique ID linking to the mark in Tiptap content
    resolved_at TIMESTAMPTZ DEFAULT NULL -- Timestamp when the comment was marked as resolved
);

-- Add comments to columns for clarity
COMMENT ON COLUMN comments.user_id IS 'The user who created the comment.';
COMMENT ON COLUMN comments.user_email IS 'Denormalized user email/name for display.';
COMMENT ON COLUMN comments.legislation_id IS 'Identifier for the legislation document (href).';
COMMENT ON COLUMN comments.section_key IS 'Key for the specific section (intro or fullHref).';
COMMENT ON COLUMN comments.comment_text IS 'The content of the user's comment.';
COMMENT ON COLUMN comments.mark_id IS 'Unique ID corresponding to the data-comment-id attribute on the mark in the editor.';
COMMENT ON COLUMN comments.resolved_at IS 'Timestamp indicating when the comment thread was resolved.';

-- Enable Row Level Security (RLS)
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies --

-- Policy: Allow authenticated users to insert comments
-- Note: We capture user_id and email via function/trigger or API logic usually
CREATE POLICY "Allow authenticated users to insert comments" 
ON comments 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Policy: Allow ALL users (authenticated or anon) to view comments
-- Public comments are generally viewable by anyone looking at the legislation
CREATE POLICY "Allow all users to view comments" 
ON comments 
FOR SELECT 
USING (true);

-- Policy: Allow users to update ONLY their own comments (e.g., edit text, resolve)
-- Optional: Might restrict resolving to specific roles later
CREATE POLICY "Allow users to update their own comments" 
ON comments 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Allow users to delete ONLY their own comments
-- Optional: Might prevent deletion after replies or based on status
CREATE POLICY "Allow users to delete their own comments" 
ON comments 
FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- Recommended Indexes
CREATE INDEX idx_comments_legislation_section ON comments(legislation_id, section_key);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_mark_id ON comments(mark_id); 