import React, { useEffect, useRef } from 'react';
import { Picker as EmojiMartPicker } from 'emoji-mart';
import emojiData from '@emoji-mart/data';

interface EmojiPickerPopoverProps {
  theme: 'light' | 'dark';
  onSelect: (emoji: string) => void;
  onClose: () => void;
  className?: string;
}

export const EmojiPickerPopover: React.FC<EmojiPickerPopoverProps> = ({ theme, onSelect, onClose, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const picker = new EmojiMartPicker({
      data: emojiData,
      theme,
      onEmojiSelect: (emoji: { native: string }) => onSelect(emoji.native),
    });
    const pickerNode = picker as unknown as Node;
    container.appendChild(pickerNode);
    return () => { if (pickerNode.parentNode === container) container.removeChild(pickerNode); };
  }, [theme, onSelect]);

  return <div ref={containerRef} className={`rounded-2xl border p-2 shadow-2xl ${theme === 'dark' ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'} ${className}`} />;
};