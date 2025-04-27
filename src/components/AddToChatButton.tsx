'use client';

import { MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AddToChatButtonProps {
  onClick: () => void;
  className?: string;
}

export default function AddToChatButton({ onClick, className = '' }: AddToChatButtonProps) {
  return (
    <Button
      onClick={onClick}
      size="sm"
      className={`bg-blue-500 hover:bg-blue-600 text-white text-xs flex items-center gap-1 ${className}`}
      title="Add to chat"
    >
      <MessageSquarePlus className="h-3 w-3" />
      <span>Add to chat</span>
    </Button>
  );
} 