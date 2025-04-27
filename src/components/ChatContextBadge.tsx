'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatContextBadgeProps {
  context: {
    text: string;
    startLine: number;
    endLine: number;
  } | null;
  onRemove: () => void;
}

export default function ChatContextBadge({ context, onRemove }: ChatContextBadgeProps) {
  if (!context) return null;

  return (
    <div className="flex items-center justify-between p-2 mb-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md text-sm">
      <div className="flex-1 truncate">
        <span className="font-medium">Context:</span> {context.text} 
        <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
          (lines {context.startLine}-{context.endLine})
        </span>
      </div>
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-6 w-6 ml-2" 
        onClick={onRemove}
        aria-label="Remove context"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
} 