'use client';

import React from 'react';
import type { Editor } from '@tiptap/react';

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
} from 'lucide-react'; // Using lucide-react, adjust if using different icons

interface LegislationToolbarProps {
  editor: Editor | null;
}

const LegislationToolbar: React.FC<LegislationToolbarProps> = ({ editor }) => {
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