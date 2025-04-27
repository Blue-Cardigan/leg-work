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
    const docText = docTextCache;

    // --- Initial Boundary Checks ---
    if (targetIndex < 0 || targetIndex > docText.length) {
        console.warn(`[mapPmCharIndexToPos] targetIndex ${targetIndex} is out of bounds (docText length: ${docText.length}). Clamping or returning null.`);
        // Option 1: Return null if strictly out of bounds
        // return null;
        // Option 2: Clamp to valid range (might be better for robustness)
        targetIndex = Math.max(0, Math.min(targetIndex, docText.length));
        if (targetIndex === docText.length && assoc === -1) {
            // If targeting *after* the last char, use doc end size
             return doc.content.size;
        }
         if (targetIndex === 0 && assoc === 1) {
             // If targeting *before* the first char, use 0
             return 0;
         }
         // Continue with clamped value for other cases
    }
    // --- End Boundary Checks ---


    let pmPos = 0; // Tracks ProseMirror position (start of current node)
    let textCharCount = 0; // Tracks characters *including* separators counted so far
    const blockSeparator = '\uFFFC'; // Must match separator used in textBetween call
    let foundPos: number | null = null;

    doc.descendants((node, pos) => {
        if (foundPos !== null) return false; // Stop if found

        if (node.isText) {
            const nodeText = node.textContent;
            const nodeSize = nodeText.length;
            // Check if the target index falls *within* this text node's range in the overall docText
            const rangeStart = textCharCount;
            const rangeEnd = textCharCount + nodeSize;

            if (targetIndex >= rangeStart && targetIndex < rangeEnd) {
                // Target is within this text node
                const indexWithinNode = targetIndex - rangeStart;
                // assoc = 1 (forward): position *before* the character at indexWithinNode -> pos + indexWithinNode
                // assoc = -1 (backward): position *after* the character at indexWithinNode -> pos + indexWithinNode + 1
                foundPos = pos + indexWithinNode + (assoc === 1 ? 0 : 1);
                // console.log(`[mapPmCharIndexToPos] Found in text node "${nodeText.substring(0,10)}...". Target ${targetIndex}, range ${rangeStart}-${rangeEnd}, indexInNode ${indexWithinNode}, assoc ${assoc} -> pos ${foundPos}`);
                return false; // Stop traversal
            }
            textCharCount += nodeSize; // Advance count by node's text length

        } else if (node.isBlock) {
             // Check if a block separator exists *after* this block node in the docText stream
             // Note: textBetween adds separators *between* blocks.
             // We only increment textCharCount if a separator *actually exists* at this position in docText.
             // The check needs to happen based on the *start* of the *next* node or the overall structure.
             // Let's refine the separator handling: count separators *between* nodes.

             // More reliable: Check if the *current* position in docText corresponds to a separator
             // that *should* be there based on the structure. textBetween adds ONE separator between adjacent blocks.
            if (pos > 0) { // Don't add separator before the very first node
                // Determine if the *previous* node sibling ended right before this one, implying a separator *should* exist.
                // This gets complex. Let's trust textCharCount increments based on text nodes and separators found in the string.

                // Simpler: If the current character(s) in docText ARE the separator...
                if (docText.startsWith(blockSeparator, textCharCount)) {
                    const separatorStart = textCharCount;
                    const separatorEnd = textCharCount + blockSeparator.length;

                    if (targetIndex >= separatorStart && targetIndex < separatorEnd) {
                        // Target index falls *within* the block separator character itself.
                        // Decide where to place the position: typically at the start or end of the block boundary.
                        // assoc = 1 (forward): position at the start of the *current* block node -> pos
                        // assoc = -1 (backward): position at the end of the *previous* node structure (tricky), often map to 'pos' as well? Or pos-1? Let's try 'pos'.
                        foundPos = pos;
                        // console.log(`[mapPmCharIndexToPos] Found in block separator. Target ${targetIndex}, range ${separatorStart}-${separatorEnd}, assoc ${assoc} -> pos ${foundPos}`);
                        return false;
                    }
                     // If not targeting the separator itself, just advance the count
                     textCharCount += blockSeparator.length;
                }
            }
        }
         // If node is not text and not block, or is a block but separator wasn't targeted,
         // just continue traversal. pmPos updates implicitly via `pos`.

        return true; // Continue descending
    });


    // If targetIndex is the very end of the text after traversal
    if (foundPos === null && targetIndex === textCharCount) {
         // This means the target is immediately after the last character processed.
         // Return the end position of the document content.
         foundPos = doc.content.size;
          // console.log(`[mapPmCharIndexToPos] Target ${targetIndex} is at end of text. Returning doc size ${foundPos}`);
    }


     if (foundPos === null) {
         console.warn(`[mapPmCharIndexToPos] Failed to map targetIndex ${targetIndex}. Max textCharCount reached: ${textCharCount}. Doc size: ${doc.content.size}, Text Length: ${docText.length}`);
         // Fallback: maybe return doc size or 0 depending on target? Or null?
         // Returning null is safer to indicate failure.
         return null;

     } else if (foundPos > doc.nodeSize) {
         console.warn(`[mapPmCharIndexToPos] Calculated position ${foundPos} exceeds document size ${doc.nodeSize}. Clamping. targetIndex: ${targetIndex}`);
         foundPos = doc.nodeSize; // Clamp to max valid position
     } else if (foundPos < 0) {
          console.warn(`[mapPmCharIndexToPos] Calculated position ${foundPos} is negative. Clamping to 0. targetIndex: ${targetIndex}`);
          foundPos = 0; // Clamp to min valid position
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

  // --- NEW: State for debounced HTML for diffing --- 
  const [debouncedCurrentHtml, setDebouncedCurrentHtml] = useState<string | null>(null);
  const DEBOUNCE_DELAY = 500; // milliseconds

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
        const newHtml = editor.getHTML();
        onChange(newHtml);
         // --- Update local state for diffing IMMEDIATELY when editing ---
         // Only do this if we are *in* edit mode. If in 'changes' mode,
         // currentHtmlForDiff should come from the parent (finalProposedHtml).
         if (editable) { // Check if editor is actually editable right now
            // No debounce needed here, as this state is only *read* after debounce effect below
            // We want the diff calculation to eventually use the latest edited state.
            setDebouncedCurrentHtml(newHtml); // Update immediately for potential diff calc
         }
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

  // --- Effect to handle prop changes for currentHtmlForDiff (for non-edit modes) ---
  useEffect(() => {
      // If the editor is NOT editable (e.g., 'view' or 'changes' mode),
      // the `currentHtmlForDiff` prop dictates what should be diffed against.
      if (!editable && currentHtmlForDiff !== debouncedCurrentHtml) {
         console.log("[LegislationEditor Effect] Non-editable mode: Syncing debouncedCurrentHtml from prop.");
         setDebouncedCurrentHtml(currentHtmlForDiff ?? null);
      }
      // If the editor *is* editable, `debouncedCurrentHtml` is updated via `onUpdate`.
      // We don't need a debounce timer here anymore, the diff calculation itself uses the state.
  }, [editable, currentHtmlForDiff, debouncedCurrentHtml]);
  // --- END Effect ---

  // --- Memoize the calculation of insertion ranges ---
  const insertionRanges = useMemo<{ from: number; to: number }[]>(() => {
    console.log('[LegislationEditor useMemo] Recalculating insertion ranges...');
    // Use debouncedCurrentHtml for comparison
    if (!editor || !editor.schema || !baseHtmlForDiff || debouncedCurrentHtml === null || baseHtmlForDiff === debouncedCurrentHtml) {
        console.log('[LegislationEditor useMemo] Skipping calculation (editor/schema/props missing or identical). Base:', !!baseHtmlForDiff, 'Debounced:', debouncedCurrentHtml !== null, 'Identical:', baseHtmlForDiff === debouncedCurrentHtml);
        return []; // No ranges if no diff needed or editor not ready
    }

    // Important: Ensure editor.state.doc reflects the content of debouncedCurrentHtml
    // Since debouncedCurrentHtml is updated immediately in onUpdate (when editable),
    // and synced from props otherwise, editor.state.doc *should* be aligned when this runs.
    const currentDoc = editor.state.doc;
    const schema = editor.schema; // Get schema from the created editor instance
    const ranges: { from: number; to: number }[] = [];

    try {
        const blockSeparator = '\uFFFC'; // Must match separator used in mapPmCharIndexToPos

        // --- Base Text Extraction (Using ProseMirror) ---
        let baseText = '';
        try {
            // Create a temporary element to parse the base HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = baseHtmlForDiff;
            // Use ProseMirror's DOMParser with the editor's schema
            const baseDocNode = DOMParser.fromSchema(schema).parse(tempDiv);
             // Extract text using textBetween, mirroring how currentText is extracted
             baseText = baseDocNode.textBetween(0, baseDocNode.content.size, blockSeparator, blockSeparator);
             console.log(`[LegislationEditor useMemo] Base Text (PM): "${baseText.substring(0,100)}..." (Length: ${baseText.length})`);
        } catch (parseError) {
             console.error("[LegislationEditor useMemo] Error parsing baseHtmlForDiff:", parseError);
             console.warn("[LegislationEditor useMemo] Falling back to basic text conversion for base HTML due to parse error.");
             // Fallback (less accurate)
             const tempBaseDiv = document.createElement('div'); tempBaseDiv.innerHTML = baseHtmlForDiff || ''; baseText = tempBaseDiv.innerText || '';
        }
        // --- End Base Text Extraction ---


        // --- Current Text Extraction (Using ProseMirror) ---
        // Use textBetween on the *current* document state
        const currentText = currentDoc.textBetween(0, currentDoc.content.size, blockSeparator, blockSeparator);
        console.log(`[LegislationEditor useMemo] Current Text (PM): "${currentText.substring(0,100)}..." (Length: ${currentText.length})`);
        // --- End Current Text Extraction ---

        const areTextsDifferent = baseText !== currentText;
        console.log(`[LegislationEditor useMemo] PM-generated texts different: ${areTextsDifferent}`);

        if (areTextsDifferent) {
           console.log("[LegislationEditor useMemo] Calculating diffs with dmp...");
           const diffs = dmp.diff_main(baseText, currentText);
           dmp.diff_cleanupSemantic(diffs);

           let currentTextCharIndex = 0; // Tracks index within the *currentText* string

           diffs.forEach(([op, text]) => {
               if (op === DIFF_INSERT) {
                   const startIndex = currentTextCharIndex;
                   const endIndex = currentTextCharIndex + text.length;
                   // Map indices from currentText back to positions in the currentDoc
                   const from = mapPmCharIndexToPos(currentDoc, startIndex, currentText, 1); // Assoc forward for start
                   const to = mapPmCharIndexToPos(currentDoc, endIndex, currentText, -1);   // Assoc backward for end

                   if (from !== null && to !== null && from <= to) { // Allow from === to for zero-length insert? (unlikely from dmp)
                        // Clamp range to be within document bounds
                        const docSize = currentDoc.content.size;
                        const clampedFrom = Math.max(0, Math.min(from, docSize));
                        const clampedTo = Math.max(0, Math.min(to, docSize));

                        if (clampedFrom < clampedTo) { // Only add if it's a valid range after clamping
                            console.log(`[LegislationEditor useMemo] Mapped INSERT: "${text.substring(0,30)}..." Indices ${startIndex}-${endIndex} -> Pos ${clampedFrom}-${clampedTo}`);
                            ranges.push({ from: clampedFrom, to: clampedTo });
                        } else if (clampedFrom > clampedTo) {
                             console.warn(`[LegislationEditor useMemo] Mapped INSERT range invalid after clamping: From ${clampedFrom} > To ${clampedTo}. Original: ${from}-${to}. Indices: ${startIndex}-${endIndex}`);
                        } // Ignore if from === to
                   } else {
                       console.warn(`[LegislationEditor useMemo] Could not map INSERT indices: ${startIndex}-${endIndex} (text length ${text.length}) to valid positions ${from}-${to} for text: "${text.substring(0, 50)}..."`);
                   }
                   currentTextCharIndex += text.length; // Advance index in currentText
               } else if (op === DIFF_DELETE) {
                   // Deletions refer to the baseText, no index advancement needed for currentTextCharIndex
               } else if (op === DIFF_EQUAL) {
                   currentTextCharIndex += text.length; // Advance index in currentText
               }
           });
        } else {
            console.log("[LegislationEditor useMemo] PM-generated text versions are identical. No diff needed.");
        }
    } catch (error) {
         console.error("[LegislationEditor useMemo] Error during diff calculation:", error);
         return []; // Return empty on error
    }

    console.log(`[LegislationEditor useMemo] Calculated ${ranges.length} insertion ranges.`);
    return ranges;

  }, [editor, baseHtmlForDiff, debouncedCurrentHtml, dmp]); // Dependencies: editor, base HTML, debounced Current HTML, dmp instance
  // --- END Memoize ---

  // --- Effect to update editor props for decorations ---
  useEffect(() => {
    if (!editor || !editor.view.dom?.isConnected) return; // Check if editor view is mounted

    console.log('[LegislationEditor Effect] Updating editor props for decorations...');
    // Get the latest decorations based on memoized ranges
    const doc = editor.state.doc;
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

    console.log(`[Decorations Effect] Creating DecorationSet with ${decorations.length} decorations.`);
    const decorationSet = DecorationSet.create(doc, decorations);

    // Apply decorations using a transaction
    const tr = editor.state.tr.setMeta('decorations', decorationSet);

    // Avoid dispatching if the view isn't ready or if document/selection didn't change.
    // Note: This won't prevent dispatch if *only* decorations change via setMeta,
    // but dispatching in that case is generally fine.
    if (!editor.state.tr.docChanged && editor.state.selection.eq(tr.selection)) {
        // Optional: Could add a check here comparing the new decorationSet to the previous one
        // if performance becomes an issue, perhaps storing the previous set in a ref.
        // For now, let's rely on the doc/selection check.
        // console.log('[Decorations Effect] Skipping dispatch, doc/selection unchanged.');
        // return; // Decide if returning here is desired. Let's allow dispatch for now.
    }

    // Dispatch the transaction to update the view state with new decorations
    editor.view.dispatch(tr);


  }, [editor, insertionRanges, focusedMarkId]); // Update props when editor instance or calculated ranges change
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