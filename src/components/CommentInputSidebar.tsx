'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { X as IconClose } from 'lucide-react';

interface CommentInputSidebarProps {
  markId: string;
  legislationId: string;
  sectionKey: string;
  onSubmit: (commentData: { 
      comment_text: string;
      legislation_id: string;
      section_key: string;
      mark_id: string;
   }) => Promise<void>; // Function to call API
  onClose: () => void; // Function to close the sidebar
}

const CommentInputSidebar: React.FC<CommentInputSidebarProps> = ({ 
    markId, 
    legislationId, 
    sectionKey, 
    onSubmit, 
    onClose 
}) => {
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!commentText.trim()) {
      setError('Comment cannot be empty.');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);

    try {
        await onSubmit({
            comment_text: commentText,
            legislation_id: legislationId,
            section_key: sectionKey,
            mark_id: markId
        });
        setCommentText(''); // Clear text on success
        onClose(); // Close sidebar on success
    } catch (err: any) {
        console.error("Error submitting comment:", err);
        setError(err.message || 'Failed to submit comment. Please try again.');
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed top-0 right-0 h-full w-80 bg-white dark:bg-gray-800 shadow-lg z-30 p-4 border-l border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Add Comment</h3>
        <Button variant="ghost" size="icon" onClick={onClose} title="Close">
          <IconClose className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </Button>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col flex-grow">
        <Textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Enter your comment..."
          className="flex-grow resize-none mb-3 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
          rows={6}
          aria-label="Comment input"
        />
        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        <Button type="submit" disabled={isSubmitting || !commentText.trim()}>
          {isSubmitting ? 'Submitting...' : 'Submit Comment'}
        </Button>
      </form>
    </div>
  );
};

export default CommentInputSidebar; 