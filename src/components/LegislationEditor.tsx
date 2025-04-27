'use client';

import React, { useEffect, useMemo } from 'react';
import { useEditor, EditorContent, NodeViewWrapper, NodeViewProps, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import LegislationToolbar from './LegislationToolbar'; // Import the toolbar
import Link from '@tiptap/extension-link'; // Import Link extension
import { Decoration, DecorationSet } from 'prosemirror-view'; // Import ProseMirror decorations
import { Node as ProseMirrorNode } from 'prosemirror-model'; // Import Node type

// --- Import extensions to customize --- 
import Paragraph from '@tiptap/extension-paragraph';
import Heading from '@tiptap/extension-heading';
import { Mark, Command } from '@tiptap/core'; // Import more types and Command
import { useAppStore } from '@/lib/store/useAppStore'; // Import store for actions
import { Editor } from '@tiptap/react'; // Ensure Editor type is imported
// --- End imports ---

// --- Diff Match Patch ---
import { diff_match_patch, DIFF_DELETE, DIFF_INSERT, DIFF_EQUAL } from 'diff-match-patch';

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
  // --- NEW Diff Props (Make Optional) ---
  baseHtmlForDiff?: string | null;
  currentHtmlForDiff?: string | null;
}

// --- Helper: Convert HTML to Plain Text (Basic) ---
const convertHtmlToPlainText = (html: string | null): string => {
    if (!html) return '';
    try {
        // Use the browser's DOM parser for simplicity
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        // Add spaces around block elements for better diff alignment
        tempDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div, li').forEach(el => {
            el.before(' ');
            el.after(' ');
        });
        return tempDiv.textContent || tempDiv.innerText || '';
    } catch (e) {
        console.error("Error converting HTML to plain text:", e);
        return '';
    }
};
// --- End Helper ---

// --- Helper: Map Plain Text Char Index to ProseMirror Pos (Simplified Placeholder) ---
// THIS IS A COMPLEX PROBLEM and this implementation is basic.
// It might not handle nested nodes, marks, or complex structures accurately.
const mapCharIndexToPos = (doc: ProseMirrorNode, charIndex: number, assoc: -1 | 1 = 1): number | null => {
    const currentPos = 0; // <-- Changed to const
    let currentCharCount = 0;
    let resultPos: number | null = null;

    // We need to traverse the document and count characters in text nodes.
    doc.descendants((node, pos) => {
        if (resultPos !== null) return false; // Stop searching once found

        if (node.isText) {
            const nodeSize = node.nodeSize;
            const nextCharCount = currentCharCount + nodeSize;

             // Check if the target index falls within this text node
             // assoc = 1 (default) means associate with the character *after* the index
             // assoc = -1 means associate with the character *before* the index
             // This helps determine position at boundaries.

             if (assoc === 1) {
                if (charIndex >= currentCharCount && charIndex < nextCharCount) {
                    resultPos = pos + (charIndex - currentCharCount);
                    return false; // Stop traversal
                }
             } else { // assoc === -1
                 if (charIndex > currentCharCount && charIndex <= nextCharCount) {
                     // Associate with the position *before* the character at charIndex
                     resultPos = pos + (charIndex - currentCharCount);
                     return false; // Stop traversal
                 }
             }
            currentCharCount = nextCharCount;
        } else if (node.isBlock && node.nodeSize > 0 && !node.isTextblock) {
             // Account for potential implicit characters/positions for block nodes?
             // ProseMirror positions exist *between* nodes.
             // This needs more sophisticated handling based on ProseMirror's structure.
             // For simplicity, we can increment char count slightly for blocks to aid mapping,
             // but this is inaccurate. A better way involves tracking ProseMirror pos directly.
            // currentCharCount++; // Example: Add 1 for block boundaries (crude)
        }
        // Update currentPos based on node size? Not reliable for char count.
        // currentPos += node.nodeSize; // Incorrect for character mapping

        return true; // Continue traversal
    });

     // Handle case where index is at the very end
     if (resultPos === null && charIndex === currentCharCount) {
         resultPos = doc.content.size; // Position at the end of the doc content
     }

    return resultPos;
};
// --- End Helper ---

const LegislationEditor: React.FC<LegislationEditorProps> = ({ 
    content, 
    editable = true, 
    onChange, 
    onAddCommentClick,
    onEditorReady, // Destructure the new prop
    showToolbar = true, // Default to true if not provided
    baseHtmlForDiff,    // <-- Destructure new prop
    currentHtmlForDiff // <-- Destructure new prop
}) => { // Default editable to true
  // Initialize diff-match-patch instance
  const dmp = useMemo(() => new diff_match_patch(), []);

  const focusedMarkId = useAppStore((state) => state.focusedMarkId); // Get focused ID

  // --- Add Logging for Props Received ---
  console.log(`[LegislationEditor Render] Props received - Editable: ${editable}, BaseHTML null?: ${baseHtmlForDiff === null}, CurrentHTML null?: ${currentHtmlForDiff === null}, Base === Current?: ${baseHtmlForDiff === currentHtmlForDiff}`);
  // --- End Logging ---

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
        onChange(editor.getHTML()); 
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
    // --- NEW: Add editorProps with decorations ---
    editorProps: {
        attributes: {
            // Add Tailwind prose classes for styling when not using the outer wrapper's prose
            class: 'prose dark:prose-invert prose-sm sm:prose-base lg:prose-lg xl:prose-xl focus:outline-none max-w-none',
        },
        decorations(state) {
            const decorations: Decoration[] = [];
            const doc = state.doc;

            // --- Refined Logging Inside Decorations ---
            const isBaseHtmlPresent = baseHtmlForDiff !== null;
            const isCurrentHtmlPresent = currentHtmlForDiff !== null;
            const areHtmlStringsDifferent = isBaseHtmlPresent && isCurrentHtmlPresent && baseHtmlForDiff !== currentHtmlForDiff;

            console.log(`[Decorations Fn] BasePresent: ${isBaseHtmlPresent}, CurrentPresent: ${isCurrentHtmlPresent}, HTMLs Different: ${areHtmlStringsDifferent}`);
            // Optional: Log snippets for verification
            // console.log(`[Decorations Fn] Base HTML Snippet: ${baseHtmlForDiff?.substring(0, 100)}...`);
            // console.log(`[Decorations Fn] Current HTML Snippet: ${currentHtmlForDiff?.substring(0, 100)}...`);

            // Check if diffing should proceed
            if (areHtmlStringsDifferent) {
                 console.log("[Decorations Fn] HTML strings are different. Proceeding to text conversion.");
                 const baseText = convertHtmlToPlainText(baseHtmlForDiff || null); // Already checks for null inside
                 const currentText = convertHtmlToPlainText(currentHtmlForDiff || null);
                 const areTextsDifferent = baseText !== currentText;

                 console.log(`[Decorations Fn] Base Text: "${baseText.substring(0,100)}..."`);
                 console.log(`[Decorations Fn] Current Text: "${currentText.substring(0,100)}..."`);
                 console.log(`[Decorations Fn] Plain texts different: ${areTextsDifferent}`);

                 if (areTextsDifferent) {
                    console.log("[Decorations Fn] Calculating diffs with dmp...");
                    const diffs = dmp.diff_main(baseText, currentText);
                    dmp.diff_cleanupSemantic(diffs);

                    let currentTextCharIndex = 0;

                    diffs.forEach(([op, text]) => {
                        if (op === DIFF_INSERT) {
                            const startIndex = currentTextCharIndex;
                            const endIndex = currentTextCharIndex + text.length;
                            const from = mapCharIndexToPos(doc, startIndex, 1);
                            const to = mapCharIndexToPos(doc, endIndex, -1);

                            if (from !== null && to !== null && from < to) {
                                 console.log(`[Decorations Fn] INSERT: "${text}" from ${from} to ${to}`);
                                 decorations.push(
                                     Decoration.inline(from, to, { class: 'change-highlight change-insert' })
                                 );
                            } else {
                                console.warn(`[Decorations Fn] Could not map INSERT indices: ${startIndex}-${endIndex} to positions ${from}-${to} for text: "${text}"`);
                            }
                            currentTextCharIndex += text.length;
                        } else if (op === DIFF_DELETE) {
                            // Still skipping deletion highlighting for now
                            console.log(`[Decorations Fn] DELETE: "${text}" (Highlighting not implemented)`);
                        } else if (op === DIFF_EQUAL) {
                            currentTextCharIndex += text.length;
                        }
                    });
                 } else {
                     console.log("[Decorations Fn] Plain text versions are identical. No diff needed.");
                 }
            } else {
                // This log should explain why diffing didn't happen
                 console.log("[Decorations Fn] No diffing needed (base/current missing or HTML strings are identical).");
            }
            // --- End Refined Logging ---

            // --- Comment Focus Decoration (Example) ---
            // This part seems less relevant to the current issue, but ensure it doesn't interfere.
            // Find positions of focused markId if needed for separate decoration.
             if (focusedMarkId) {
                  // This requires iterating through the document to find the mark.
                  // Example: findMarkPositions(doc, focusedMarkId) -> returns { from, to }[]
                  // Then create Decoration.inline(from, to, { class: 'focused-comment-highlight' });
                  // Add these decorations to the `decorations` array.
                  // Note: This might conflict/overlap with diff highlighting. Careful styling needed.
             }
            // --- End Comment Focus ---


            console.log(`[Decorations Fn] Created ${decorations.length} decorations.`);
            return DecorationSet.create(doc, decorations);
        },
    },
    // --- END NEW ---
  });

  // Ensure editor is destroyed on unmount
  React.useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  // --- Effect to potentially force decoration update ---
  // Use sparingly, might cause performance issues. Often React re-renders are enough.
  useEffect(() => {
    if (editor && (baseHtmlForDiff || currentHtmlForDiff)) { // Only run if diff inputs might be relevant
         console.log("[LegislationEditor Effect] Forcing decoration update due to diff inputs change (base/current HTML).");
         if (editor.view.dom?.isConnected) {
             // Force a state update which re-runs decorations
             editor.view.dispatch(editor.state.tr);
         }
    }
  }, [baseHtmlForDiff, currentHtmlForDiff, editor]); // Re-run if editor instance or diff inputs change

  if (!editor) {
    return null; // Or a loading state
  }

  return (
    <div className="tiptap-editor-wrapper">
      {/* Conditionally render the toolbar based on the prop */}
      {editable && showToolbar && onAddCommentClick && <LegislationToolbar editor={editor} onAddCommentClick={onAddCommentClick} />}
      {/* Conditionally render toolbar *without* comment button if callback not provided */}
      {editable && showToolbar && !onAddCommentClick && <LegislationToolbar editor={editor} onAddCommentClick={() => console.warn("onAddCommentClick not provided to LegislationEditor")} />}
      <EditorContent editor={editor} />
    </div>
  );
};

export default LegislationEditor; 