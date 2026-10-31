import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { MessageItem } from './MessageItem';
import { MessageInput } from './MessageInput';
import { ChatHeader } from './ChatHeader';
import { EmptyState } from '../common/EmptyState';
import { Message } from '../../types';
import { Search, Calendar } from 'lucide-react';
import { formatDateHeading, formatRelativeTime, isSameLocalDay, parseAppDate } from '../../utils/time';
import { canModerateCommunity } from '../admin/adminAccess';

export const ChatView: React.FC = () => {
  const {
    messages,
    currentChannelId,
    isDirectMessages,
    activeDmId,
    isTyping,
    typingUser,
    sendMessage,
    lastReadAtByChannel,
    markChannelRead,
    communities,
    currentCommunityId,
    currentUser,
    togglePinMessage,
    addToast,
  } = useApp();

  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [, setClock] = useState(Date.now());

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeChannelKey = isDirectMessages && activeDmId ? activeDmId : currentChannelId;
  const channelMessages = messages[activeChannelKey] || [];
  const pinnedMessages = isDirectMessages ? [] : channelMessages.filter((message) => message.pinned && !message.isDeleted);
  const activeCommunity = communities.find((community) => community.id === currentCommunityId);
  const canModerate = !!activeCommunity && canModerateCommunity(activeCommunity.id, currentUser, activeCommunity.ownerId || activeCommunity.creatorId);

  const filteredMessages = isSearching && searchQuery.trim()
    ? channelMessages.filter((m) =>
        m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.sender.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : channelMessages;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [channelMessages.length, isTyping]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeChannelKey) markChannelRead(activeChannelKey);
  }, [activeChannelKey]);

  const lastReadAt = lastReadAtByChannel[activeChannelKey];
  const firstUnreadId = channelMessages.find((message) => message.senderId !== currentUser.id && (!lastReadAt || parseAppDate(message.timestamp).getTime() > parseAppDate(lastReadAt).getTime()))?.id;

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-sunken relative min-w-0">
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
        {pinnedMessages.length > 0 && (
          <div className="pinned-message-bar sticky top-0 z-20 mx-2 mb-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="pinned-message-label"><span aria-hidden="true">📌</span> Fixadas</span>
              <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
                {pinnedMessages.map((message) => (
                  <button key={message.id} type="button" className="pinned-message-link" title="Ir para mensagem fixada" onClick={() => document.getElementById(`message-${message.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                    <span className="truncate">{message.sender.name}: {message.content || 'Anexo'}</span>
                  </button>
                ))}
              </div>
            </div>
            {canModerate && pinnedMessages.map((message) => (
              <button key={`unpin-${message.id}`} type="button" className="pinned-unpin" title="Desafixar mensagem" aria-label={`Desafixar mensagem de ${message.sender.name}`} onClick={() => { togglePinMessage(message.id); addToast('Mensagem desafixada', 'A mensagem foi removida das fixadas.', 'success'); }}>×</button>
            ))}
          </div>
        )}
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
            {filteredMessages.map((msg, index) => {
              const previousMessage = filteredMessages[index - 1];
              const startsNewDay = !previousMessage || !isSameLocalDay(previousMessage.timestamp, msg.timestamp);
              const elapsedMinutes = previousMessage
                ? (parseAppDate(msg.timestamp).getTime() - parseAppDate(previousMessage.timestamp).getTime()) / 60_000
                : Number.POSITIVE_INFINITY;
              const isGrouped = !!previousMessage
                && !previousMessage.isDeleted
                && !msg.isDeleted
                && previousMessage.senderId === msg.senderId
                && elapsedMinutes >= 0
                && elapsedMinutes <= 5;
              return (
                <React.Fragment key={msg.id}>
                {startsNewDay && <div className="flex items-center justify-center mb-4 mt-2"><div className="h-px bg-slate-800 flex-1" /><div className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Calendar className="w-3 h-3 text-indigo-400" /><span>{formatDateHeading(msg.timestamp)}</span></div><div className="h-px bg-slate-800 flex-1" /></div>}
                {msg.id === firstUnreadId && <div className="unread-divider"><span>Não lidas</span></div>}
                <MessageItem
                  message={msg}
                  isGrouped={isGrouped}
                  isUnread={!!lastReadAt && msg.senderId !== currentUser.id && parseAppDate(msg.timestamp).getTime() > parseAppDate(lastReadAt).getTime()}
                  timeLabel={new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(parseAppDate(msg.timestamp))}
                  onReply={(target) => setReplyTarget(target)}
                />
                </React.Fragment>
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


