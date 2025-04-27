'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
// --- Updated Store Imports --- 
import { 
  useAppStore, 
  ChatMessagePart, 
  Comment,
  useRightSidebarContent, // What content to show
  useIsRightSidebarOpen, // <-- NEW: Get visibility state
  useActiveCommentInputMarkId, // Is comment input active?
  useCommentActions, // Actions for comments
  useComments, // Comment data
  useIsLoadingComments, // Loading state for comments
  useIsSubmittingComment, // Loading state for submitting
  useCommentSubmitError, // Error state for submitting
  useFocusedCommentId, // For highlighting active comment
  useFocusedMarkId // For highlighting active mark
} from '@/lib/store/useAppStore'; 
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, X, AlertCircle } from 'lucide-react'; // Icons
import { formatDistanceToNow } from 'date-fns'; // For relative timestamps
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// --- Comment Card Component --- 
interface CommentCardProps {
  comment: Comment;
  isFocused: boolean;
  onFocus: () => void; // Callback to set focus in store
}

const CommentCard: React.FC<CommentCardProps> = ({ comment, isFocused, onFocus }) => {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isFocused && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isFocused]);

  const handleCardClick = () => {
    console.log(`Comment card ${comment.id} clicked, calling onFocus.`);
    onFocus(); // Trigger focus update in the parent/store
  };

  let timeAgo = 'invalid date';
  try {
      timeAgo = formatDistanceToNow(new Date(comment.created_at), { addSuffix: true });
  } catch (e) {
      console.error("Error formatting date:", e, "Date:", comment.created_at);
  }

  return (
    <div
      ref={cardRef}
      onClick={handleCardClick}
      className={`p-3 rounded-lg border transition-colors duration-150 cursor-pointer ${isFocused ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
    >
      <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{comment.comment_text}</p>
      <div className="flex justify-between items-center mt-2 pt-1 border-t border-gray-200 dark:border-gray-600">
        <span className="text-xs text-gray-500 dark:text-gray-400" title={comment.user_email || comment.user_id}>
          {comment.user_email?.split('@')[0] || 'User'} {/* Show username part of email or fallback */}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500" title={new Date(comment.created_at).toLocaleString()}>
          {timeAgo}
        </span>
      </div>
      {/* Add resolve/reply buttons later */} 
    </div>
  );
};

// --- Comment Input Component --- 
interface CommentInputProps {
  markId: string;
  legislationId: string;
  onSubmit: (text: string) => Promise<void>; // Parent handles API call
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
}

const CommentInput: React.FC<CommentInputProps> = ({ markId, legislationId, onSubmit, onCancel, isLoading, error }) => {
  const [commentText, setCommentText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
      textareaRef.current?.focus();
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!commentText.trim() || isLoading) return;
    await onSubmit(commentText);
    // Parent should clear state on success/error
    // setCommentText(''); // Don't clear here, let parent decide based on submit outcome
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 border border-blue-300 dark:border-blue-700 rounded-lg bg-blue-50 dark:bg-gray-800 shadow-md">
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Adding comment for highlighted text (ID: <code className='text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded'>{markId.substring(0, 8)}...</code>)</p>
      <Textarea
        ref={textareaRef}
        placeholder="Add your comment..."
        value={commentText}
        onChange={(e) => setCommentText(e.target.value)}
        disabled={isLoading}
        rows={3}
        className="w-full text-sm rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
      />
      {error && (
          <Alert variant="destructive" className="mt-2">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
          </Alert>
      )}
      <div className="flex justify-end space-x-2 mt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading} size="sm">
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading || !commentText.trim()} size="sm">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
        </Button>
      </div>
    </form>
  );
};

// --- Main RightSidebar Component --- 
export default function RightSidebar() {
  // --- Store State & Actions --- 
  const {
    chatMessages,
    isChatLoading,
    sendChatMessage,
    selectedLegislation // Needed for comment submission
  } = useAppStore();
  // Get state for content switching
  const rightSidebarContent = useRightSidebarContent();
  const isRightSidebarOpen = useIsRightSidebarOpen(); // <-- NEW: Get visibility
  const toggleRightSidebar = useAppStore(state => state.toggleRightSidebar); // <-- NEW: Get toggle action
  // Get comment-related state and actions
  const comments = useComments();
  const isLoadingComments = useIsLoadingComments();
  const activeCommentInputMarkId = useActiveCommentInputMarkId();
  const isSubmittingComment = useIsSubmittingComment();
  const commentSubmitError = useCommentSubmitError();
  const focusedCommentId = useFocusedCommentId(); // For highlighting comment card
  const { 
      setActiveCommentInputMarkId, 
      submitComment, 
      setFocusedCommentId, 
      setFocusedMarkId 
  } = useCommentActions();

  // Local state for chat input
  const [chatInput, setChatInput] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const commentsContainerRef = useRef<HTMLDivElement>(null);

  // Scroll chat to bottom
  useEffect(() => {
    if (rightSidebarContent === 'chat' && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, rightSidebarContent]);

  // Scroll comments to focused comment
  // (CommentCard handles scrolling itself into view when focused)

  // --- Chat Handlers --- 
  const handleChatSend = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const messageToSend = chatInput;
    setChatInput('');
    await sendChatMessage(messageToSend);
  };

  const handleChatKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  };

  // --- Comment Handlers --- 
  const handleCommentSubmit = useCallback(async (text: string) => {
      if (!activeCommentInputMarkId || !selectedLegislation) return;
      
      const commentData = {
          comment_text: text,
          legislation_id: selectedLegislation.identifier,
          mark_id: activeCommentInputMarkId,
          section_key: 'fullDocument' // Or derive if needed
      };
      await submitComment(commentData); 
      // Store action handles clearing activeCommentInputMarkId on success
  }, [activeCommentInputMarkId, selectedLegislation, submitComment]);

  const handleCommentCancel = () => {
      setActiveCommentInputMarkId(null);
  };

  const handleCommentFocus = (commentId: string, markId: string) => {
      console.log(`Setting focus via sidebar: comment=${commentId}, mark=${markId}`);
      setFocusedCommentId(commentId); // Focus the comment card
      setFocusedMarkId(markId); // Focus the mark in the editor
  };

  // --- Render Logic --- 

  // If the sidebar is closed, render nothing (or a collapsed placeholder if needed)
  if (!isRightSidebarOpen) {
    return null; 
  }

  // If open, render the sidebar content
  return (
    <div className="flex flex-col h-full w-80 bg-gray-100 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-lg"> {/* Added shadow for visibility */}
      {/* Header: Includes Title and Close Button */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 capitalize">
              {rightSidebarContent === 'chat' ? 'AI Assistant' : 'Comments'}
          </h2>
          <Button variant="ghost" size="icon" onClick={toggleRightSidebar} title="Close Panel">
              <X className="h-5 w-5" />
          </Button>
      </div>

      {/* Conditional Content Area */} 
      {rightSidebarContent === 'chat' ? (
          // --- Chat UI --- 
          <>
              <div ref={chatContainerRef} className="flex-grow bg-white dark:bg-gray-800 mb-2 overflow-y-auto p-3 space-y-3">
                  {Array.isArray(chatMessages) && chatMessages.map((msg, index) => (
                      <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] p-2 px-3 rounded-lg text-sm shadow-sm ${msg.role === 'user' ? 'bg-blue-500 dark:bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`}>
                              {Array.isArray(msg.parts) && msg.parts.length > 0 ? (
                                  msg.parts.map((part: ChatMessagePart, i: number) => (
                                      <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{part?.text ?? ''}</span>
                                  ))
                              ) : (
                                  <span className="italic text-gray-400">...</span>
                              )}
                          </div>
                      </div>
                  ))}
                  {isChatLoading && Array.isArray(chatMessages) && chatMessages.length > 0 && chatMessages[chatMessages.length - 1]?.role === 'user' && (
                      <div className="flex justify-start">
                          <div className="max-w-[80%] p-2 px-3 rounded-lg text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 italic shadow-sm">
                              Thinking...
                          </div>
                      </div>
                  )}
              </div>
              <div className="flex items-center border-t border-gray-200 dark:border-gray-700 p-3">
                  <input
                      type="text"
                      placeholder={isChatLoading ? "Waiting for response..." : "Ask Gemini..."}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={handleChatKeyPress}
                      disabled={isChatLoading}
                      className="flex-grow border border-gray-300 dark:border-gray-600 rounded-l p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:bg-gray-200 dark:disabled:bg-gray-600"
                  />
                  <Button
                      onClick={handleChatSend}
                      disabled={isChatLoading || !chatInput.trim()}
                      className="bg-blue-500 text-white px-4 h-[40px] py-2 rounded-r text-sm font-medium hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-600 dark:hover:bg-blue-700"
                  >
                      <Send className="h-4 w-4" />
                  </Button>
              </div>
          </>
      ) : (
          // --- Comments UI --- 
          <div ref={commentsContainerRef} className="flex-grow bg-white dark:bg-gray-800 overflow-y-auto p-3 space-y-3">
              {/* Comment Input Form (if active) */} 
              {activeCommentInputMarkId && selectedLegislation && (
                  <CommentInput 
                      markId={activeCommentInputMarkId}
                      legislationId={selectedLegislation.identifier}
                      onSubmit={handleCommentSubmit}
                      onCancel={handleCommentCancel}
                      isLoading={isSubmittingComment}
                      error={commentSubmitError}
                  />
              )}

              {/* Loading State */}
              {isLoadingComments && <div className="text-center py-4 text-gray-500 dark:text-gray-400">Loading comments...</div>}

              {/* Comment List */}
              {!isLoadingComments && comments.length === 0 && !activeCommentInputMarkId && (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400">No comments yet. Select text in the editor and click the comment icon in the toolbar to add one.</div>
              )}
              {!isLoadingComments && comments.length > 0 && (
                  comments
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) // Sort newest first
                    .map((comment) => (
                      <CommentCard 
                          key={comment.id} 
                          comment={comment} 
                          isFocused={comment.id === focusedCommentId} 
                          onFocus={() => handleCommentFocus(comment.id, comment.mark_id)} 
                      />
                  ))
              )}

              {/* TODO: Add error display for fetching comments */} 
          </div>
      )}
    </div>
  );
} 