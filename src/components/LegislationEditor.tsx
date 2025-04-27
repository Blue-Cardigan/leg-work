'use client';

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useEditor, EditorContent, NodeViewWrapper, NodeViewProps, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import LegislationToolbar from './LegislationToolbar'; // Import the toolbar
import Link from '@tiptap/extension-link'; // Import Link extension
import { Decoration, DecorationSet } from 'prosemirror-view'; // Import ProseMirror decorations
import { Node as ProseMirrorNode } from 'prosemirror-model'; // Import Node type
import { DOMParser } from 'prosemirror-model'; // Import DOMParser

// --- Import extensions to customize --- 
import Paragraph from '@tiptap/extension-paragraph';
import Heading from '@tiptap/extension-heading';
import { Mark, Command } from '@tiptap/core'; // Import more types and Command
import { useAppStore } from '@/lib/store/useAppStore'; // Import store for actions
import { Editor } from '@tiptap/react'; // Ensure Editor type is imported
// --- End imports ---

// Basic styling for the editor - adjust as needed
import './LegislationEditor.css';

// --- Custom Nodes to Preserve Classes --- 

// Extend Paragraph node to preserve class and id attributes
const CustomParagraph = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(), // Keep existing attributes
      class: {
        default: null,
        parseHTML: element => element.getAttribute('class'),
        renderHTML: attributes => {
          if (!attributes.class) {
            return {};
          }
          return { class: attributes.class };
        },
      },
      id: { // Add ID attribute handling
        default: null,
        parseHTML: element => element.getAttribute('id'),
        renderHTML: attributes => {
          if (!attributes.id) {
            return {};
          }
          return { id: attributes.id };
        },
      },
    };
  },
});

// Extend Heading node similarly
const CustomHeading = Heading.extend({
   addAttributes() {
    return {
      ...this.parent?.(), // Keep existing attributes (like level)
      class: {
        default: null,
        parseHTML: element => element.getAttribute('class'),
        renderHTML: attributes => {
           if (!attributes.class) {
            return {};
          }
          // Combine with existing attributes like level
          return { class: attributes.class }; 
        },
      },
      id: { // Add ID attribute handling
        default: null,
        parseHTML: element => element.getAttribute('id'),
        renderHTML: attributes => {
          if (!attributes.id) {
            return {};
          }
          return { id: attributes.id };
        },
      },
    };
  },
});

// --- End Custom Nodes ---

// --- Custom Mark for Spans ---
const CustomSpan = Mark.create({
  name: 'customSpan',

  // Make it behave like a generic span
  group: 'inline', 
  inline: true,
  // Allow this mark to wrap other inline content if necessary
  // content: 'inline*', // Typically marks don't have content, but let's try without first

  // Allow span tag without specific attributes
  parseHTML() {
    return [
      {
        tag: 'span',
        // Optional: Add priority if needed to override other marks
        // priority: 51, // Default priority is 50
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    // Pass through all attributes collected in addAttributes
    return ['span', HTMLAttributes, 0]; 
  },

  addAttributes() {
    return {
       class: {
        default: null,
        parseHTML: element => element.getAttribute('class'),
        renderHTML: attributes => {
          if (!attributes.class) {
            return {};
          }
          return { class: attributes.class };
        },
      },
      id: {
        default: null,
        parseHTML: element => element.getAttribute('id'),
        renderHTML: attributes => {
          if (!attributes.id) {
            return {};
          }
          return { id: attributes.id };
        },
      },
      // Add other attributes if needed (e.g., title)
    };
  },
});

// --- End Custom Mark ---

// --- React Component for Comment Mark Node View ---
const CommentMarkNodeView: React.FC<NodeViewProps> = ({ node, HTMLAttributes, editor }) => {
  // Get the specific action from the store
  const setFocusedMarkId = useAppStore((state) => state.setFocusedMarkId);
  const markId = node.attrs.markId;

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    console.log(`[CommentMarkNodeView] Clicked markId: ${markId}`);
    // Call the action directly (Zustand ensures it exists if selected)
    setFocusedMarkId(markId); 

    // Optional: Bring editor focus back if needed
    // editor.view.focus();
  };

  return (
    <NodeViewWrapper 
      as="span" 
      onClick={handleClick} 
      className="comment-highlight"
      data-mark-id={markId}
      {...HTMLAttributes}
    >
      {/* This renders the content *inside* the mark */}
      {/* Tiptap handles rendering the actual content here */}
    </NodeViewWrapper>
  );
};

// --- Custom Mark for Comments ---
type CommentMarkOptions = object;

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    commentMark: {
      setCommentMark: (markId: string) => ReturnType;
      toggleCommentMark: (markId: string) => ReturnType;
      unsetCommentMark: () => ReturnType;
    }
  }
}

// Ensure Command type is used for Tiptap command functions
const CommentMark = Mark.create<CommentMarkOptions>({
  name: 'commentMark',
  group: 'inline',
  inline: true,
  inclusive: true,
  excludes: '',

  addAttributes() {
    return {
      markId: {
        default: null,
        parseHTML: element => element.getAttribute('data-mark-id'),
        renderHTML: attributes => ({ 'data-mark-id': attributes.markId }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-mark-id]', getAttrs: node => ({ markId: (node as HTMLElement).getAttribute('data-mark-id') }) }];
  },

  renderHTML({ mark, HTMLAttributes }) {
    // Ensure data-mark-id is part of the attributes object passed to the final span
    const finalAttributes = {
      ...HTMLAttributes, // Include any other attributes Tiptap provides
      'data-mark-id': mark.attrs.markId, // Correct: Access attrs from 'mark'
    };
    // The NodeView will handle the interactive part, but Tiptap needs this basic render.
    return ['span', finalAttributes, 0]; // 0 means render the content inside the span
  },

  addNodeView() {
    return ReactNodeViewRenderer(CommentMarkNodeView);
  },

  addCommands() {
    return {
      setCommentMark: (markId: string): Command => ({ commands }) => {
        return commands.setMark(this.type, { markId });
      },
      unsetCommentMark: (): Command => ({ commands }) => {
        return commands.unsetMark(this.type);
      },
      toggleCommentMark: (markId: string): Command => ({ commands }) => {
        if (!markId) {
            console.error("toggleCommentMark requires a markId");
            return false;
        }
        // Let Tiptap infer the MarkType for toggleMark
        // const type: MarkType = this.type;
        return commands.toggleMark(this.type, { markId });
      },
    };
  },
});
// --- End Custom Mark for Comments ---

// --- Add ProposedChange Type Here (if not globally defined/imported) ---
// Or import it if defined elsewhere
interface ProposedChange {
    id: number;
    created_at: string;
    user_id: string;
    legislation_id: string;
    legislation_title: string;
    section_key: string;
    section_title: string;
    original_html: string | null;
    proposed_html: string | null;
    status: string;
    context_before: string | null;
    context_after: string | null;
}
// ---

interface LegislationEditorProps {
  content: string | null;
  editable?: boolean;
  onChange?: (newContent: string) => void;
  onAddCommentClick?: (markId: string) => void;
  onEditorReady?: (editor: Editor) => void;
  showToolbar?: boolean;
  // --- NEW Prop for all changes ---
  allPendingChanges?: ProposedChange[];
}

// Add type declaration for the window object
declare global {
  interface Window {
    addContextToChat?: (text: string, startLine: number, endLine: number) => void;
  }
}

const LegislationEditor: React.FC<LegislationEditorProps> = ({ 
    content, 
    editable = true, 
    onChange, 
    onAddCommentClick,
    onEditorReady, // Destructure the new prop
    showToolbar = true, // Default to true if not provided
    allPendingChanges   // <-- Destructure new prop
}) => { // Default editable to true
  const focusedMarkId = useAppStore((state) => state.focusedMarkId); // Get focused ID

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable default paragraph and heading to use our custom ones
        paragraph: false,
        heading: false,
        // Link is handled by the separate Link.configure below
        // link: false, // This option doesn't exist here
      }),
      CustomParagraph,  // Use custom paragraph
      CustomHeading,    // Use custom heading
      CustomSpan,       // Use custom span mark
      CommentMark,      // Add the CommentMark extension
      Link.configure({ // Configure the Link extension
        // Keep attributes like href, target, rel - Rely on default parsing + HTMLAttributes below
        // keepAttributes: true, // This option doesn't exist here
        autolink: true, // Autolink URLs typed/pasted
        openOnClick: false, // Don't navigate when clicking links in the editor
        linkOnPaste: true, // Convert pasted URLs to links
        HTMLAttributes: {
           // Add target and rel attributes to ensure external links open safely
           target: '_blank',
           rel: 'noopener noreferrer nofollow',
        },
      }),
      // Add more extensions here as needed (e.g., Table, Image)
    ],
    content: content || '', // Use provided HTML or empty string
    editable: editable, // Set editor editability
    // Call onChange when content updates
    onUpdate: ({ editor }) => {
      if (onChange) {
        const newHtml = editor.getHTML();
        onChange(newHtml);
      }
    },
    // --- Call onEditorReady when the editor is created ---
    onCreate: ({ editor }) => {
      console.log("[LegislationEditor onCreate] Editor created.");
      if (onEditorReady) {
        onEditorReady(editor);
      }
    },
    // Add this line to fix SSR hydration issue
    immediatelyRender: false,
  });

  // --- Effect for Comment Focus Decoration ---
  useEffect(() => {
    if (!editor || !editor.view.dom?.isConnected || !focusedMarkId) return;

    const doc = editor.state.doc;
    const decorations: Decoration[] = [];
    let found = false;

    doc.descendants((node, pos) => {
      if (node.marks) {
        node.marks.forEach(mark => {
          if (mark.type.name === 'commentMark' && mark.attrs.markId === focusedMarkId) {
            // Found the mark, create a decoration for its range
            const from = pos;
            const to = pos + node.nodeSize;
             console.log(`[Comment Focus Effect] Found mark ${focusedMarkId} at pos ${from}-${to}. Creating decoration.`);
            decorations.push(Decoration.inline(from, to, { class: 'focused-comment-highlight' }));
            found = true;
          }
        });
      }
      return !found; // Stop descending if found
    });

     if (!found) {
         console.log(`[Comment Focus Effect] Mark ${focusedMarkId} not found in current doc state.`);
     }

     // Create DecorationSet - even if empty to clear previous decorations
     const decorationSet = DecorationSet.create(doc, decorations);
     const tr = editor.state.tr.setMeta('decorations', decorationSet); // Use setMeta to apply decorations

     // Dispatch transaction to apply decorations
     editor.view.dispatch(tr);

  }, [editor, focusedMarkId]); // Dependencies: editor instance and the focusedMarkId
  // --- END Effect ---

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
    <div className="relative">
      {editor && showToolbar && editable && ( // Only show toolbar if editable
        <LegislationToolbar
          editor={editor}
          onAddCommentClick={onAddCommentClick || (() => console.warn("onAddCommentClick not provided to LegislationEditor"))}
        />
      )}
      <EditorContent editor={editor} />
    </div>
  );
};

export default LegislationEditor; 