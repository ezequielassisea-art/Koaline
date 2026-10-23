import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Send,
  Paperclip,
  Smile,
  AtSign,
  X,
  Reply
} from 'lucide-react';
import { Message, User } from '../../types';

interface MessageInputProps {
  replyTarget: Message | null;
  onClearReply: () => void;
}

const EMOJI_LIST = ['🔥', '⚡', '✨', '🚀', '👍', '❤️', '👀', '🎉', '👏', '💡', '💯', '☕'];

export const MessageInput: React.FC<MessageInputProps> = ({ replyTarget, onClearReply }) => {
  const {
    sendMessage,
    communities,
    currentCommunityId,
    currentChannelId,
    isDirectMessages,
    activeDmId,
    dms,
  } = useApp();

  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMentionAutocomplete, setShowMentionAutocomplete] = useState(false);
  const [attachment, setAttachment] = useState<{ name: string; size: string } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeCommunity = communities.find((c) => c.id === currentCommunityId) || communities[0];
  const activeChannel = activeCommunity.channels.find((c) => c.id === currentChannelId);
  const activeDm = dms.find((d) => d.id === activeDmId);
  const memberSuggestions: User[] = [];

  const placeholderText = isDirectMessages && activeDm
    ? `Conversar com @${activeDm.user.name}...`
    : `Mensagem em #${activeChannel?.name || 'geral'}...`;

  const handleSend = () => {
    if (!text.trim() && !attachment) return;

    const attachmentsList = attachment
      ? [{ type: 'file' as const, url: '', name: attachment.name, size: attachment.size }]
      : undefined;

    const replyData = replyTarget
      ? {
          id: replyTarget.id,
          senderName: replyTarget.sender.name,
          content: replyTarget.content,
        }
      : undefined;

    sendMessage(text, replyData, attachmentsList);

    setText('');
    setAttachment(null);
    onClearReply();
    setShowEmojiPicker(false);
    setShowMentionAutocomplete(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }

    const lastWord = val.split(/\s+/).pop() || '';
    if (lastWord.startsWith('@')) {
      setShowMentionAutocomplete(true);
    } else {
      setShowMentionAutocomplete(false);
    }
  };

  const handleSelectMention = (user: User) => {
    const words = text.split(/\s+/);
    words.pop();
    setText([...words, `@${user.handle} `].join(' '));
    setShowMentionAutocomplete(false);
    if (textareaRef.current) textareaRef.current.focus();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setAttachment({
        name: f.name,
        size: `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
      });
    }
  };

  return (
    <div className="p-3 border-t border-border bg-surface/80 backdrop-blur-md relative select-none">
      {/* Reply Banner */}
      {replyTarget && (
        <div className="mb-2 px-3 py-1.5 rounded-nest-sm bg-slate-900 border border-border flex items-center justify-between text-xs animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2 truncate">
            <Reply className="w-3.5 h-3.5 text-indigo-400 rotate-180" />
            <span className="font-semibold text-slate-200">
              Respondendo a {replyTarget.sender.name}:
            </span>
            <span className="text-slate-400 truncate">{replyTarget.content}</span>
          </div>
          <button
            onClick={onClearReply}
            className="p-1 rounded-full text-slate-400 hover:text-slate-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Attachment Pill */}
      {attachment && (
        <div className="mb-2 px-3 py-1 rounded-nest-pill bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-between text-xs w-fit">
          <span>📎 {attachment.name} ({attachment.size})</span>
          <button onClick={() => setAttachment(null)} className="ml-2 hover:opacity-75">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Mention Autocomplete */}
      {showMentionAutocomplete && (
        <div className="absolute bottom-full left-4 mb-2 w-64 p-2 rounded-nest-sm bg-slate-900 border border-slate-700 shadow-2xl z-30 animate-in fade-in">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
            Mencionar membro
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {memberSuggestions.map((u) => (
              <button
                key={u.id}
                onClick={() => handleSelectMention(u as any)}
                className="w-full flex items-center gap-2 p-1.5 rounded-nest-sm hover:bg-slate-800 text-left text-xs text-slate-200"
              >
                <img src={u.avatar} alt={u.name} className="w-6 h-6 rounded-full object-cover" />
                <div className="truncate">
                  <div className="font-semibold truncate">{u.name}</div>
                  <div className="text-[10px] text-slate-400">@{u.handle}</div>
                </div>
              </button>
            ))}
            {memberSuggestions.length === 0 && <p className="px-2 py-3 text-xs text-slate-500">Nenhum membro para mencionar.</p>}
          </div>
        </div>
      )}

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div className="absolute bottom-full right-4 mb-2 p-2 rounded-nest-sm bg-slate-900 border border-slate-700 shadow-2xl z-30 flex flex-wrap gap-1.5 max-w-xs animate-in zoom-in-95">
          {EMOJI_LIST.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                setText((prev) => prev + emoji);
                setShowEmojiPicker(false);
                if (textareaRef.current) textareaRef.current.focus();
              }}
              className="p-1.5 hover:bg-slate-800 rounded hover:scale-125 transition-all text-base"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Main Input Box */}
      <div className="flex items-end gap-2 p-2 rounded-nest bg-surface-sunken border border-border focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Anexar arquivo"
          className="p-2 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholderText}
          className="flex-1 bg-transparent border-0 resize-none py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none max-h-32"
        />

        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setText((prev) => prev + '@');
              setShowMentionAutocomplete(true);
            }}
            title="Mencionar pessoa"
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <AtSign className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Escolher emoji"
            className="p-1.5 rounded-full text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
          >
            <Smile className="w-4 h-4" />
          </button>

          <button
            onClick={handleSend}
            disabled={!text.trim() && !attachment}
            title="Enviar mensagem"
            className={`p-2 rounded-full transition-all active:scale-95 ${
              text.trim() || attachment
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
