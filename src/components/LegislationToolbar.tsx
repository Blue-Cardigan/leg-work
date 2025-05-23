'use client';

import React, { useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { v4 as uuidv4 } from 'uuid'; // Import uuid

// Import icons (you might need to install react-icons: npm install react-icons)
import {
  Bold as IconBold, 
  Italic as IconItalic, 
  List as IconList, 
  ListOrdered as IconListOrdered,
  Heading1 as IconH1,
  Heading2 as IconH2,
  Heading3 as IconH3,
  Undo as IconUndo,
  Redo as IconRedo,
  MessageSquarePlus as IconCommentAdd,
  MessageSquareShare as IconAddToChat
} from 'lucide-react'; // Using lucide-react, adjust if using different icons

interface LegislationToolbarProps {
  editor: Editor | null;
  // Add callback prop to signal comment initiation
  onAddCommentClick: (markId: string) => void; 
}

const LegislationToolbar: React.FC<LegislationToolbarProps> = ({ editor, onAddCommentClick }) => {

  // --- Moved: Function to handle adding text to chat ---
  const handleAddToChat = useCallback(() => {
    if (!editor) return; // Still need check inside the function

    const { state } = editor;
    const { from, to } = state.selection;

    if (from === to) return; // No selection

    const selectedText = state.doc.textBetween(from, to);

    // Calculate line numbers (approximate)
    let startLine = 1;
    let endLine = 1;
    let lineCount = 1;
    
    state.doc.nodesBetween(0, from, (node, pos) => {
      // Check if it's the start of a block node that isn't the first node
      if (pos > 0 && (node.type.name === 'paragraph' || node.type.name === 'heading')) {
        lineCount++;
      }
      return true; // Continue traversal
    });
    
    startLine = lineCount;
    
    state.doc.nodesBetween(from, to, (node, pos) => {
      // Count line breaks within the selection
      if (node.type.name === 'paragraph' || node.type.name === 'heading') {
         // Only count if it's not the very start of the selection unless it's the only block
         if (pos > from || from === to) { 
            lineCount++;
         }
      }
      return true; // Continue traversal
    });
    
    // Adjust end line calculation: lineCount now represents the *next* line number after the selection
    endLine = lineCount > startLine ? lineCount -1 : startLine; 

    // Call the global function exposed by ChatSidebar
    if (window.addContextToChat) {
      window.addContextToChat(
        selectedText,
        startLine,
        endLine
      );
      console.log(`[Toolbar] Added to chat context: "${selectedText.substring(0,30)}..." (Lines ${startLine}-${endLine})`);
      // Optional: Clear editor selection after adding to chat
      // editor.chain().focus().setTextSelection({ from: to, to: to }).run();
    } else {
      console.warn("[Toolbar] window.addContextToChat function not found.");
    }
  }, [editor]);
  // --- End Moved Function ---

  if (!editor) {
    return null;
  }

  // Button component for consistency
  const ToolbarButton: React.FC<{
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
    title: string;
  }> = ({ onClick, isActive, disabled, children, title }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded mx-0.5 transition-colors 
        ${isActive ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300' 
                   : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );

  // Function to handle adding a comment
  const handleAddComment = () => {
    // Removed editor check as it's handled by the early return now
    // 1. Generate unique ID for the mark
    const newMarkId = uuidv4();
    
    // 2. Apply the mark with the specific ID
    const applied = editor.chain().focus().setCommentMark(newMarkId).run(); 

    // 3. If mark was successfully applied, trigger the callback to show input UI
    if (applied) {
      console.log(`[Toolbar] Applied comment mark with ID: ${newMarkId}`);
      onAddCommentClick(newMarkId); // Pass the ID to the parent
    } else {
        // Handle cases where applying the mark might fail (e.g., no selection)
        console.warn("[Toolbar] Could not apply comment mark.");
        // Optionally provide user feedback here
    }
  };

  return (
    <div className="toolbar-wrapper sticky top-0 z-20 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-t p-1 mb-1 flex flex-wrap items-center">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        title="Bold"
      >
        <IconBold size={18} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        title="Italic"
      >
        <IconItalic size={18} />
      </ToolbarButton>
      
      <span className="border-l border-gray-300 dark:border-gray-600 h-5 mx-1.5"></span>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
        disabled={!editor.can().chain().focus().toggleHeading({ level: 1 }).run()}
        title="Heading 1"
      >
        <IconH1 size={18} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        disabled={!editor.can().chain().focus().toggleHeading({ level: 2 }).run()}
        title="Heading 2"
      >
        <IconH2 size={18} />
      </ToolbarButton>
       <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        disabled={!editor.can().chain().focus().toggleHeading({ level: 3 }).run()}
        title="Heading 3"
      >
        <IconH3 size={18} />
      </ToolbarButton>

       <span className="border-l border-gray-300 dark:border-gray-600 h-5 mx-1.5"></span>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        disabled={!editor.can().chain().focus().toggleBulletList().run()}
        title="Bullet List"
      >
        <IconList size={18} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        disabled={!editor.can().chain().focus().toggleOrderedList().run()}
        title="Ordered List"
      >
        <IconListOrdered size={18} />
      </ToolbarButton>
      
       <span className="border-l border-gray-300 dark:border-gray-600 h-5 mx-1.5"></span>
       
      <ToolbarButton
        onClick={handleAddComment}
        isActive={editor.isActive('commentMark')}
        title="Add Comment"
      >
        <IconCommentAdd size={18} />
      </ToolbarButton>
      
      <ToolbarButton
        onClick={handleAddToChat}
        title="Add Selection to Chat Context"
      >
        <IconAddToChat size={18} />
      </ToolbarButton>
       
       <span className="border-l border-gray-300 dark:border-gray-600 h-5 mx-1.5"></span>
       
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().chain().focus().undo().run()}
        title="Undo"
      >
        <IconUndo size={18} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().chain().focus().redo().run()}
        title="Redo"
      >
        <IconRedo size={18} />
      </ToolbarButton>
    </div>
  );
};

export default LegislationToolbar; 