'use client';

import { useState, useRef, useEffect } from 'react';
import { useAppStore, ChatMessagePart } from '@/lib/store/useAppStore'; // Import zustand store and ChatMessagePart

// Remove local ChatMessage type if defined here, use the one from the store implicitly

export default function RightSidebar() {
  // --- Zustand Store State & Actions ---
  const {
    chatMessages, 
    isChatLoading, 
    chatError, // Although error is displayed via messages now, keep selector if needed elsewhere
    sendChatMessage
  } = useAppStore();

  // --- Local State for Input only ---
  const [input, setInput] = useState(''); 
  
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages update (using store messages)
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]); // Depend on chatMessages from the store

  const handleSend = async () => {
    if (!input.trim() || isChatLoading) return; // Check store's loading state
    
    const messageToSend = input; // Store input before clearing
    setInput(''); // Clear input immediately
    
    await sendChatMessage(messageToSend); // Call store action
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); 
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700">
      <h2 className="p-4 text-lg font-semibold border-b border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200">AI Assistant</h2>
      <div ref={chatContainerRef} className="flex-grow bg-white dark:bg-gray-800 mb-2 overflow-y-auto p-3 space-y-3">
        {/* Use chatMessages from store, ensuring it's an array */} 
        {Array.isArray(chatMessages) && chatMessages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] p-2 px-3 rounded-lg text-sm shadow-sm ${msg.role === 'user' ? 'bg-blue-500 dark:bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
            >
              {/* Simple rendering, consider markdown later */}
              {/* --- More robust check: ensure msg.parts is an array before mapping --- */}
              {Array.isArray(msg.parts) && msg.parts.length > 0 ? (
                 // Add explicit types for map parameters
                 msg.parts.map((part: ChatMessagePart, i: number) => (
                   <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{part?.text ?? ''}</span> // Also handle potentially null/undefined part.text
                 ))
               ) : (
                 // Handle cases where parts might be missing, empty, or not an array
                 <span className="italic text-gray-400">...</span>
               )}
            </div>
          </div>
        ))}
        {/* Use isChatLoading from store */}
        {isChatLoading && Array.isArray(chatMessages) && chatMessages.length > 0 && chatMessages[chatMessages.length - 1]?.role === 'user' && (
            // Show thinking indicator only if the last message was from user (i.e. model hasn't started responding)
            <div className="flex justify-start">
                 <div className="max-w-[80%] p-2 px-3 rounded-lg text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 italic shadow-sm">
                    Thinking...
                </div>
            </div>
        )}
        {/* Error messages are now added directly to chatMessages by the store action */}
      </div>
      <div className="flex items-center border-t border-gray-200 dark:border-gray-700 p-3">
        <input
          type="text"
          placeholder={isChatLoading ? "Waiting for response..." : "Ask Gemini..."} // Use store loading state
          value={input} // Local input state
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isChatLoading} // Use store loading state
          className="flex-grow border border-gray-300 dark:border-gray-600 rounded-l p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:bg-gray-200 dark:disabled:bg-gray-600"
        />
        <button 
          onClick={handleSend}
          disabled={isChatLoading || !input.trim()} // Use store loading state
          className="bg-blue-500 text-white px-4 h-full py-2 rounded-r text-sm font-medium hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-600 dark:hover:bg-blue-700"
        >
          Send
        </button>
      </div>
    </div>
  );
} 