'use client';

import { useState, useRef, useEffect } from 'react';
import { useAppStore, ChatMessagePart } from '@/lib/store/useAppStore';
import { Button } from '@/components/ui/button';
import { Send, Check } from 'lucide-react';
import ChatContextBadge from './ChatContextBadge';

export default function ChatSidebar() {
  // --- Store State & Actions --- 
  // Select state and actions individually to prevent infinite loops
  const chatMessages = useAppStore(state => state.chatMessages);
  const isChatLoading = useAppStore(state => state.isChatLoading);
  const sendChatMessage = useAppStore(state => state.sendChatMessage);
  const applySuggestion = useAppStore(state => state.applySuggestion);

  // Local state for chat input
  const [chatInput, setChatInput] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Context state
  const [context, setContext] = useState<{
    text: string;
    startLine: number;
    endLine: number;
  } | null>(null);

  // Scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // --- Chat Handlers --- 
  const handleChatSend = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    
    // Include context in the message if available
    let messageToSend = chatInput;
    if (context) {
      messageToSend = `Context (lines ${context.startLine}-${context.endLine}):\n${context.text}\n\nQuestion: ${chatInput}`;
    }
    
    setChatInput('');
    await sendChatMessage(messageToSend);
    
    // Clear context *input* after sending
    setContext(null);
  };

  const handleChatKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  };

  // Context handlers
  const handleRemoveContext = () => {
    setContext(null);
  };

  // This function will be called from the LegislationEditor
  const addContext = (text: string, startLine: number, endLine: number) => {
    setContext({
      text,
      startLine,
      endLine
    });
  };

  // --- Suggestion Handling --- 
  const handleApplySuggestion = (originalContext: string, suggestedChange: string) => {
    if (originalContext) {
      console.log("Applying suggestion:", { original: originalContext, suggested: suggestedChange });
      applySuggestion(originalContext, suggestedChange);
    } else {
      console.warn("Cannot apply suggestion: No context was associated with the last message.");
      // TODO: Maybe show a user-facing warning?
    }
  };

  // Expose the addContext function to the window object so it can be called from LegislationEditor
  useEffect(() => {
    // @ts-ignore - Adding to window object
    window.addContextToChat = addContext;
    
    return () => {
      // @ts-ignore - Cleanup
      delete window.addContextToChat;
    };
  }, []);

  return (
    <>
      <div ref={chatContainerRef} className="flex-grow bg-white dark:bg-gray-800 mb-2 overflow-y-auto p-3 space-y-3">
        {Array.isArray(chatMessages) && chatMessages.map((msg, index) => {
          // Regex to detect the suggestion block
          const suggestionRegex = /```suggestion\n([\s\S]*?)\n```/;
          const messageText = msg.parts?.[0]?.text ?? '';
          const suggestionMatch = messageText.match(suggestionRegex);

          return (
            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-2 px-3 rounded-lg text-sm shadow-sm ${msg.role === 'user' ? 'bg-blue-500 dark:bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`}>
                {suggestionMatch ? (
                  // Render suggestion block
                  <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded p-2 my-1">
                    <p className="text-xs font-semibold mb-1 text-yellow-800 dark:text-yellow-200">Suggested Change:</p>
                    <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-700 p-1.5 rounded font-mono text-xs">{suggestionMatch[1]}</pre>
                    {msg.contextUsed ? (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApplySuggestion(msg.contextUsed!, suggestionMatch[1])}
                            className="mt-2 border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700 dark:border-green-600 dark:text-green-400 dark:hover:bg-green-900/50 dark:hover:text-green-300"
                        >
                            <Check className="h-4 w-4 mr-1" /> Apply Suggestion
                        </Button>
                    ) : (
                         <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 italic">Cannot apply: Suggestion provided without associated context.</p>
                    )}
                  </div>
                ) : (
                  // Render normal message part
                  Array.isArray(msg.parts) && msg.parts.length > 0 ? (
                    <span style={{ whiteSpace: 'pre-wrap' }}>{messageText}</span>
                  ) : (
                    <span className="italic text-gray-400">...</span>
                  )
                )}
              </div>
            </div>
          )
        })}
        {isChatLoading && Array.isArray(chatMessages) && chatMessages.length > 0 && chatMessages[chatMessages.length - 1]?.role === 'user' && (
          <div className="flex justify-start">
            <div className="max-w-[80%] p-2 px-3 rounded-lg text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 italic shadow-sm">
              Thinking...
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-col border-t border-gray-200 dark:border-gray-700 p-3">
        {/* Context Badge */}
        <ChatContextBadge context={context} onRemove={handleRemoveContext} />
        
        {/* Chat Input */}
        <div className="flex items-center">
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
      </div>
    </>
  );
} 