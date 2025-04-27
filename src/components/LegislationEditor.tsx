'use client';

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
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
  // --- NEW Prop for all changes ---
  allPendingChanges?: ProposedChange[];
}

// --- Helper: Map Plain Text Char Index (from textBetween) to ProseMirror Pos ---
// Revised helper using textBetween - Requires the Doc object
const mapPmCharIndexToPos = (doc: ProseMirrorNode, targetIndex: number, docTextCache: string, assoc: -1 | 1 = 1): number | null => {
    // Use pre-calculated docText from textBetween for efficiency
    const docText = docTextCache;
    // console.log(`mapPmCharIndexToPos: Doc text length: ${docText.length}, targetIndex: ${targetIndex}`);
    // console.log(`mapPmCharIndexToPos: Doc text sample: "${docText.substring(0, 200)}"`);


    if (targetIndex < 0 || targetIndex > docText.length) {
        console.warn(`[mapPmCharIndexToPos] targetIndex ${targetIndex} is out of bounds (docText length: ${docText.length})`);
        return null;
    }
    if (targetIndex === docText.length) {
         // If targeting the very end, return the end position of content
         return doc.content.size;
    }

    let pmPos = 0; // Tracks ProseMirror position
    let textCharCount = 0; // Tracks characters in text nodes corresponding to docText
    const blockSeparator = '\uFFFC'; // Must match separator used in textBetween call

    // We need to correlate docText index with ProseMirror position
    // Iterate through the document nodes
     let foundPos: number | null = null;
     doc.descendants((node, pos) => {
        if (foundPos !== null) return false; // Stop if found

        if (node.isText) {
            const nodeText = node.textContent;
            const nodeSize = nodeText.length; // Use actual text content length
            for (let i = 0; i < nodeSize; i++) {
                 // Check if the current character in the node corresponds to the targetIndex in docText
                 if (textCharCount === targetIndex) {
                      // Found the character. Position is the start of the text node + index within node

                      // Adjust based on association:
                      // A position *before* character `i` is `pos + i`.
                      // A position *after* character `i` is `pos + i + 1`.
                      if (assoc === 1) {
                           foundPos = pos + i; // Position before character
                      } else { // assoc === -1
                           foundPos = pos + i + 1; // Position after character
                      }
                      return false; // Stop descendants traversal
                 }
                 textCharCount++;
            }
        } else if (node.isBlock && pmPos > 0) {
             // Check if the previous node ended at the expected position for a block separator in docText
             // Need to handle potential multiple separators if blocks are adjacent
             let blockSeparatorCount = 0;
             while(docText.startsWith(blockSeparator, textCharCount)) {
                 textCharCount += blockSeparator.length;
                 blockSeparatorCount++;
             }

             if (blockSeparatorCount > 0) {
                 // Check again if the target is now matched right after separator(s)
                 if (textCharCount === targetIndex && assoc === 1) {
                       // Position at the start of the current block node
                       foundPos = pos;
                       return false;
                 }
             }
        }
         pmPos = pos + node.nodeSize; // Update position for next node check
         return true; // Continue
    });


    // If targetIndex is the very end of the text after traversal
    if (foundPos === null && targetIndex === textCharCount) {
         foundPos = doc.content.size;
    }


     if (foundPos === null) {
         console.warn(`[mapPmCharIndexToPos] Failed to map targetIndex ${targetIndex}. Max textCharCount was ${textCharCount}. Doc size: ${doc.content.size}, Text Length: ${docText.length}`);
         // Fallback: Try resolving position directly? (Often inaccurate for text indices)
         // try {
         //     // Resolve position is difficult without knowing the exact text node
         //     // foundPos = doc.resolve(targetIndex).pos; // Very approximate fallback
         //     // console.log(`[mapPmCharIndexToPos] Fallback resolve gives: ${foundPos}`);
         // } catch(e){
         //     console.error("[mapPmCharIndexToPos] Fallback resolve failed", e);
         // }
     } else if (foundPos > doc.nodeSize) {
         console.warn(`[mapPmCharIndexToPos] Calculated position ${foundPos} exceeds document size ${doc.nodeSize}. Clamping. targetIndex: ${targetIndex}`);
         foundPos = doc.nodeSize; // Clamp to max valid position
     }

    return foundPos;
};
// --- End Helper ---

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
    baseHtmlForDiff,    // <-- Destructure new prop
    currentHtmlForDiff, // <-- Destructure new prop
    allPendingChanges   // <-- Destructure new prop
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
  });

  // --- NEW: Memoize the calculation of insertion ranges ---
  const insertionRanges = useMemo<{ from: number; to: number }[]>(() => {
    console.log('[LegislationEditor useMemo] Recalculating insertion ranges...');
    if (!editor || !baseHtmlForDiff || !currentHtmlForDiff || baseHtmlForDiff === currentHtmlForDiff) {
        console.log('[LegislationEditor useMemo] Skipping calculation (editor/props missing or identical).');
        return []; // No ranges if no diff needed or editor not ready
    }

    const doc = editor.state.doc;
    const schema = editor.state.schema; // Get schema from editor state
    const ranges: { from: number; to: number }[] = [];

    try {
        // Use ProseMirror's textBetween for potentially more accurate text representation
        const blockSeparator = '\uFFFC'; // Must match separator used in mapPmCharIndexToPos
        let baseText = '';
        let currentText = '';

        // --- Base Text Extraction (Still using basic approach) ---
        // A robust solution requires parsing baseHtml using the schema into a temp node.
        console.warn("[LegislationEditor useMemo] Using basic text conversion for base HTML. For accuracy, parse base HTML to ProseMirror node first.");
        const tempBaseDiv = document.createElement('div'); tempBaseDiv.innerHTML = baseHtmlForDiff || ''; baseText = tempBaseDiv.innerText || '';
        // --- End Base Text Extraction ---

        // Use textBetween for the *current* document state
        currentText = doc.textBetween(0, doc.content.size, blockSeparator, blockSeparator);
        console.log(`[LegislationEditor useMemo] Current doc text length: ${currentText.length}`);

        console.log(`[LegislationEditor useMemo] Base Text (basic): "${baseText.substring(0,100)}..."`);
        console.log(`[LegislationEditor useMemo] Current Text (PM): "${currentText.substring(0,100)}..."`);

        const areTextsDifferent = baseText !== currentText;
        console.log(`[LegislationEditor useMemo] Plain texts different: ${areTextsDifferent}`);

        if (areTextsDifferent) {
           console.log("[LegislationEditor useMemo] Calculating diffs with dmp...");
           const diffs = dmp.diff_main(baseText, currentText);
           dmp.diff_cleanupSemantic(diffs);

           let currentTextCharIndex = 0;

           diffs.forEach(([op, text]) => {
               if (op === DIFF_INSERT) {
                   const startIndex = currentTextCharIndex;
                   const endIndex = currentTextCharIndex + text.length;
                   // Use the mapping function, passing the cached currentText
                   const from = mapPmCharIndexToPos(doc, startIndex, currentText, 1); // Assoc forward for start
                   const to = mapPmCharIndexToPos(doc, endIndex, currentText, -1);   // Assoc backward for end

                   if (from !== null && to !== null && from < to) {
                        console.log(`[LegislationEditor useMemo] Mapped INSERT: "${text.substring(0,30)}..." from ${from} to ${to}`);
                        ranges.push({ from, to });
                   } else {
                       console.warn(`[LegislationEditor useMemo] Could not map INSERT indices: ${startIndex}-${endIndex} (text length ${text.length}) to positions ${from}-${to} for text: "${text.substring(0, 50)}..."`);
                   }
                   currentTextCharIndex += text.length;
               } else if (op === DIFF_DELETE) {
                   // No change needed to currentTextCharIndex for deletions in the *base* text
               } else if (op === DIFF_EQUAL) {
                   currentTextCharIndex += text.length;
               }
           });
        } else {
            console.log("[LegislationEditor useMemo] Plain text versions are identical. No diff needed.");
        }
    } catch (error) {
         console.error("[LegislationEditor useMemo] Error during diff calculation:", error);
         return []; // Return empty on error
    }

    console.log(`[LegislationEditor useMemo] Calculated ${ranges.length} insertion ranges.`);
    return ranges;

  }, [editor, baseHtmlForDiff, currentHtmlForDiff, dmp]); // Dependencies: Re-run only when these change
  // --- END Memoize ---

  // --- Effect to update editor props when memoized ranges change ---
  // ProseMirror decorations need to be updated via editor props.
  useEffect(() => {
    if (!editor) return;

    console.log('[LegislationEditor Effect] Updating editor props for decorations...');
    editor.setOptions({
        editorProps: {
            attributes: {
                 class: 'prose dark:prose-invert prose-sm sm:prose-base lg:prose-lg xl:prose-xl focus:outline-none max-w-none',
            },
            decorations(state) {
                const doc = state.doc;
                // Use the memoized ranges directly
                const decorations = insertionRanges.map(range =>
                    Decoration.inline(range.from, range.to, { class: 'change-highlight change-insert' })
                );

                // --- Add Comment Focus Decoration logic here if needed ---
                if (focusedMarkId) {
                    // Example: Find mark positions and add decorations
                    // const commentDecorations = findAndCreateCommentDecorations(doc, focusedMarkId);
                    // decorations.push(...commentDecorations);
                }
                // --- End Comment Focus ---

                console.log(`[Decorations Fn using Memo] Creating DecorationSet with ${decorations.length} decorations.`);
                return DecorationSet.create(doc, decorations);
            },
        }
    });
    // Force a view update to apply the new decorations immediately
    // This might be needed if setOptions doesn't trigger it reliably
     if (editor.view.dom?.isConnected) {
         editor.view.dispatch(editor.state.tr);
     }

  }, [editor, insertionRanges, focusedMarkId]); // Update props when editor instance or calculated ranges change
  // --- END Effect ---


  // --- NEW: Effect to update editor content when currentHtmlForDiff prop changes ---
  useEffect(() => {
    if (!editor || currentHtmlForDiff === null) { // Check for null specifically
      return; // Editor not ready or no current HTML
    }

    const editorHtml = editor.getHTML();

    // Only update if the prop is different from the editor's current content
    if (currentHtmlForDiff !== editorHtml) {
      console.log("[LegislationEditor Effect] Updating editor content from currentHtmlForDiff prop.");
      // Use `setContent` to update the editor state.
      // `emitUpdate: false` prevents the `onUpdate` callback from firing unnecessarily,
      // as this change originates from a prop, not a user edit.
      // It also prevents triggering the onUpdate -> onChange -> setFullDocumentHtml loop here.
      editor.commands.setContent(currentHtmlForDiff || '', false);
    }
  }, [currentHtmlForDiff, editor]); // Depend on prop and editor instance
  // --- END NEW EFFECT ---

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
      {editor && showToolbar && (
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