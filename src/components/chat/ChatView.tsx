import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { MessageItem } from './MessageItem';
import { MessageInput } from './MessageInput';
import { ChatHeader } from './ChatHeader';
import { EmptyState } from '../common/EmptyState';
import { Message } from '../../types';
import { Search, Calendar } from 'lucide-react';

export const ChatView: React.FC = () => {
  const {
    messages,
    currentChannelId,
    isDirectMessages,
    activeDmId,
    isTyping,
    typingUser,
    sendMessage
  } = useApp();

  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeChannelKey = isDirectMessages && activeDmId ? activeDmId : currentChannelId;
  const channelMessages = messages[activeChannelKey] || [];

  const filteredMessages = isSearching && searchQuery.trim()
    ? channelMessages.filter((m) =>
        m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.sender.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : channelMessages;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [channelMessages.length, isTyping]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950/30 relative min-w-0">
      {/* Header */}
      <ChatHeader
        onToggleSearch={() => setIsSearching(!isSearching)}
        isSearching={isSearching}
      />

      {/* In-channel Search */}
      {isSearching && (
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800/60 flex items-center gap-2 animate-in slide-in-from-top-2">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Pesquisar neste canal..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-slate-400 hover:text-white"
            >
              Limpar
            </button>
          )}
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-2 py-4">
        {filteredMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState
              type={isDirectMessages ? 'dms' : 'messages'}
              onAction={() => sendMessage('Olá a todos! 👋')}
              actionText="Enviar primeira mensagem"
            />
          </div>
        ) : (
          <>
            {/* Date Separator */}
            <div className="flex items-center justify-center mb-4">
              <div className="h-px bg-slate-800 flex-1" />
              <div className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3 h-3 text-indigo-400" />
                <span>Hoje</span>
              </div>
              <div className="h-px bg-slate-800 flex-1" />
            </div>

            {filteredMessages.map((msg, index) => {
              const previousMessage = filteredMessages[index - 1];
              const isGrouped = !!previousMessage
                && !previousMessage.isDeleted
                && previousMessage.senderId === msg.senderId;
              return (
                <MessageItem
                  key={msg.id}
                  message={msg}
                  isGrouped={isGrouped}
                  onReply={(target) => setReplyTarget(target)}
                />
              );
            })}
          </>
        )}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex items-center gap-2 px-4 py-2 text-xs text-slate-400 animate-in fade-in">
            <span className="font-semibold text-indigo-400">{typingUser || 'Alguém'}</span>
            <span>está digitando</span>
            <span className="flex gap-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" />
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput
        replyTarget={replyTarget}
        onClearReply={() => setReplyTarget(null)}
      />
    </div>
  );
};
