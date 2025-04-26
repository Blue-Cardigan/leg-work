-- Drop table if it exists (optional, use with caution in production)
-- DROP TABLE IF EXISTS proposed_changes; 

-- Create the table to store proposed changes
CREATE TABLE proposed_changes (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, -- Link to the user who proposed the change
    legislation_id TEXT NOT NULL, -- Identifier for the legislation document (e.g., the href or URL)
    legislation_title TEXT NOT NULL, -- Title of the legislation for easier display
    section_key TEXT NOT NULL, -- Identifier for the section (e.g., 'intro' or the fullHref)
    section_title TEXT NOT NULL, -- Title of the section being changed
    original_html TEXT, -- The original HTML content of the section before the change
    proposed_html TEXT NOT NULL, -- The new HTML content proposed by the user
    status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')), -- Status of the proposed change
    context_before TEXT, -- Optional: Store preceding section's content for context during review
    context_after TEXT -- Optional: Store succeeding section's content for context during review
);

-- Add comments to columns for clarity (optional)
COMMENT ON COLUMN proposed_changes.legislation_id IS 'Identifier for the legislation document, often the unique URL or href.';
COMMENT ON COLUMN proposed_changes.section_key IS 'Unique key for the section within the legislation, e.g., ''intro'' or fullHref.';
COMMENT ON COLUMN proposed_changes.original_html IS 'The HTML content of the section before the user started editing.';
COMMENT ON COLUMN proposed_changes.proposed_html IS 'The HTML content submitted by the user for review.';
COMMENT ON COLUMN proposed_changes.status IS 'Workflow status: pending, approved, rejected.';
COMMENT ON COLUMN proposed_changes.context_before IS 'HTML snippet of the section immediately preceding the changed section.';
COMMENT ON COLUMN proposed_changes.context_after IS 'HTML snippet of the section immediately following the changed section.';


-- 1. Enable Row Level Security (RLS) for the table
-- MUST be enabled for policies to take effect
ALTER TABLE proposed_changes ENABLE ROW LEVEL SECURITY;

-- 2. Policy: Allow authenticated users to insert their OWN proposed changes
-- The user_id column in the new row MUST match the logged-in user's ID
CREATE POLICY "Allow users to insert their own changes"
ON proposed_changes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 3. Policy: Allow authenticated users to view ONLY their own proposed changes
-- Users can SELECT rows where the user_id column matches their logged-in ID
CREATE POLICY "Allow users to view their own changes"
ON proposed_changes
FOR SELECT
USING (auth.uid() = user_id);

-- 4. Policy: Allow authenticated users to update ONLY their own PENDING changes (Optional)
-- Uncomment if you want users to be able to modify their submissions before approval/rejection
CREATE POLICY "Allow users to update their own pending changes"
ON proposed_changes
FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending')
WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- 5. Policy: Allow authenticated users to delete ONLY their own PENDING changes (Optional)
-- Uncomment if you want users to be able to withdraw their submissions
CREATE POLICY "Allow users to delete their own pending changes"
ON proposed_changes
FOR DELETE
USING (auth.uid() = user_id AND status = 'pending');

-- Recommended Indexes for performance
CREATE INDEX idx_proposed_changes_user_id ON proposed_changes(user_id);
CREATE INDEX idx_proposed_changes_status ON proposed_changes(status);
CREATE INDEX idx_proposed_changes_legislation_id ON proposed_changes(legislation_id);
