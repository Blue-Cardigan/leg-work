'use client';

import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import LegislationToolbar from './LegislationToolbar'; // Import the toolbar

// Basic styling for the editor - adjust as needed
import './LegislationEditor.css'; 

interface LegislationEditorProps {
  content: string | null; // Accept HTML string or null
  editable?: boolean; // Make editable controllable
  onChange?: (newContent: string) => void; // Add onChange prop
}

const LegislationEditor: React.FC<LegislationEditorProps> = ({ content, editable = true, onChange }) => { // Default editable to true
  const editor = useEditor({
    extensions: [
      StarterKit, // Includes common text formatting, paragraphs, headings, etc.
      // Add more extensions here as needed (e.g., Table, Link, Image)
    ],
    content: content || '', // Use provided HTML or empty string
    editable: editable, // Set editor editability
    // Call onChange when content updates
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getHTML()); 
      }
    },
    // Add this line to fix SSR hydration issue
    immediatelyRender: false, 
  });

  // Ensure editor is destroyed on unmount
  React.useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  if (!editor) {
    return null; // Or a loading state
  }

  return (
    <div className="tiptap-editor-wrapper border border-gray-300 dark:border-gray-600 rounded">
      {/* Render toolbar only if editable */} 
      {editable && <LegislationToolbar editor={editor} />} 
      <EditorContent editor={editor} />
    </div>
  );
};

export default LegislationEditor; 