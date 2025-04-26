'use client';

import React from 'react';
import { useAppStore, Comment } from '@/lib/store/useAppStore';
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, MessageSquare, X } from 'lucide-react';
import { Button } from "@/components/ui/button";

interface CommentDisplaySidebarProps {
  onCardClick: (markId: string) => void;
  className?: string;
}

const CommentDisplaySidebar: React.FC<CommentDisplaySidebarProps> = ({ onCardClick, className }) => {
  const comments = useAppStore((state) => state.comments);
  const isLoadingComments = useAppStore((state) => state.isLoadingComments);
  const commentsError = useAppStore((state) => state.commentsError);
  const focusedMarkId = useAppStore((state) => state.focusedMarkId);
  const setFocusedMarkId = useAppStore((state) => state.setFocusedMarkId);
  const toggleCommentSidebar = useAppStore((state) => state.toggleCommentSidebar);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString([], {
        dateStyle: 'short',
        timeStyle: 'short'
    });
  };

  const handleCardClick = (markId: string) => {
    setFocusedMarkId(markId);
    onCardClick(markId);
  };

  return (
    <div className={`w-80 bg-gray-50 dark:bg-gray-900 shadow-lg z-30 border-l border-gray-200 dark:border-gray-700 flex flex-col ${className || ''}`}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-600">
        <div className="flex justify-between items-center mb-4 pb-2">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Comments ({Array.isArray(comments) ? comments.length : 0})</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCommentSidebar}
            title="Close Comments"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-grow p-4">
        {isLoadingComments && (
          <div className="text-center text-gray-500 dark:text-gray-400">Loading comments...</div>
        )}
        {commentsError && (
          <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded text-red-700 dark:text-red-300 flex items-start">
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0"/>
            <span>Error loading comments: {typeof commentsError === 'string' ? commentsError : 'Unknown error'}</span>
          </div>
        )}
        {!isLoadingComments && !commentsError && (!Array.isArray(comments) || comments.length === 0) && (
          <div className="text-center text-gray-500 dark:text-gray-400">No comments yet.</div>
        )}
        {!isLoadingComments && !commentsError && Array.isArray(comments) && comments.length > 0 && (
            <div className="space-y-3">
                {comments.map((comment: Comment) => {
                    const isFocused = focusedMarkId === comment.mark_id;
                    return (
                      <Card 
                        key={comment.id} 
                        className={`bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all duration-150 cursor-pointer ${isFocused ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-800' : ''}`}
                        data-mark-id={comment.mark_id}
                        onClick={() => handleCardClick(comment.mark_id)}
                      >
                        <CardHeader className="p-3">
                            <CardDescription className="text-xs text-gray-500 dark:text-gray-400 flex justify-between items-center">
                                <span>{comment.user_email || 'Anonymous User'}</span>
                                <span>{formatDate(comment.created_at)}</span>
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-3 pt-0 text-sm text-gray-800 dark:text-gray-200">
                            <p>{comment.comment_text}</p>
                        </CardContent>
                        
                      </Card>
                    );
                })}
            </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default CommentDisplaySidebar; 