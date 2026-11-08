import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { MessageItem } from '../chat/MessageItem';
import { MessageInput } from '../chat/MessageInput';
import { EmptyState } from '../common/EmptyState';
import { Message } from '../../types';
import { Search, Calendar, Phone, Video, Users, Archive, Pin } from 'lucide-react';
import { formatDateHeading, formatRelativeTime, isSameLocalDay, parseAppDate } from '../../utils/time';
import { canModerateCommunity } from '../admin/adminAccess';

const ChatAreaComponent: React.FC = () => {
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
    isContextPanelOpen,
    closeContextPanel,
    openMembersPanel,
    startDirectCall,
    openUserProfile,
    toggleArchiveDm,
    dms,
  } = useApp();

  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [, setClock] = useState(Date.now());

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeChannelKey = isDirectMessages && activeDmId ? activeDmId : currentChannelId;
  const channelMessages = (activeChannelKey && Array.isArray(messages[activeChannelKey])) ? messages[activeChannelKey] : [];
  const pinnedMessages = isDirectMessages ? [] : channelMessages.filter((message) => message && message.pinned && !message.isDeleted);
  const activeCommunity = communities.find((community) => community && community.id === currentCommunityId) || communities[0] || null;
  const canModerate = !!activeCommunity && canModerateCommunity(activeCommunity.id, currentUser, activeCommunity.ownerId || activeCommunity.creatorId);

  const filteredMessages = isSearching && searchQuery.trim()
    ? channelMessages.filter((m) =>
        m &&
        ((m.content || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.sender?.name || '').toLowerCase().includes(searchQuery.toLowerCase()))
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

  const activeDm = activeDmId ? dms.find((d) => d.id === activeDmId) : null;
  const activeChannel = activeCommunity?.channels?.find((c) => c.id === currentChannelId) || null;
  const hasPinnedMessages = !!(activeChannelKey && messages[activeChannelKey]?.some((message) => message && message.pinned && !message.isDeleted));

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg)] min-w-0">
      {/* ========================================
         HEADER: Channel/DM name, status, action icons
         ======================================== */}
      <header className="h-14 px-4 border-b border-[var(--border)] flex items-center justify-between sticky top-0 z-10 bg-[var(--surface)]/80 backdrop-blur-sm">
        {/* Left: Channel / DM Info */}
        <div className="flex items-center gap-3 min-w-0">
          {isDirectMessages ? (
            activeDm && activeDm.user ? (
              <div
                onClick={() => openUserProfile(activeDm.user)}
                className="flex items-center gap-2.5 cursor-pointer group"
              >
                <div className="relative">
                  {activeDm.user.avatar ? (
                    <img
                      src={activeDm.user.avatar}
                      alt={activeDm.user.name || 'Usuário'}
                      className="w-8 h-8 rounded-full object-cover group-hover:ring-2 group-hover:ring-indigo-500 transition-all"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white group-hover:ring-2 group-hover:ring-indigo-500 transition-all">
                      {(activeDm.user.name || '?').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[var(--bg)] ${
                    activeDm.user.status === 'online' ? 'bg-emerald-500' : activeDm.user.status === 'idle' ? 'bg-amber-500' : 'bg-zinc-400'
                  }`} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-white group-hover:text-indigo-400 transition-colors">
                      {activeDm.user.name || 'Membro Koaline'}
                    </span>
                    <span className="text-[11px] text-slate-400">@{activeDm.user.handle || 'usuario'}</span>
                  </div>
                  <div className="text-[11px] text-emerald-400 font-medium">
                    {activeDm.user.status === 'online' ? '● Online' : activeDm.user.status === 'idle' ? '● Ausente' : '○ Offline'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-white truncate">Mensagem Direta</h2>
                <p className="text-[11px] text-slate-400 truncate">Conversa privada</p>
              </div>
            )
          ) : (
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white truncate">
                {activeChannel?.name ? `#${activeChannel.name}` : 'chat-geral'}
              </h2>
              {activeChannel?.topic && (
                <p className="text-[11px] text-slate-400 truncate hidden sm:block max-w-md">
                  {activeChannel.topic}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          {isDirectMessages && activeDm && activeDm.user && (
            <>
              <button
                onClick={() => startDirectCall(activeDm.user, 'voice')}
                title="Chamada de voz"
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
              >
                <Phone className="w-4 h-4" />
              </button>
              <button
                onClick={() => startDirectCall(activeDm.user, 'video')}
                title="Chamada de vídeo"
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-indigo-400 transition-colors"
              >
                <Video className="w-4 h-4" />
              </button>
              <button
                onClick={() => toggleArchiveDm(activeDm.id)}
                title="Arquivar conversa"
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <Archive className="w-4 h-4" />
              </button>
            </>
          )}

          {!isDirectMessages && hasPinnedMessages && (
            <button
              onClick={() => document.querySelector('.pinned-message-bar')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              title="Mensagens fixadas"
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Pin className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => isContextPanelOpen ? closeContextPanel() : openMembersPanel()}
            title="Painel de membros"
            className={`p-2 rounded-lg transition-colors ${
              isContextPanelOpen ? 'bg-indigo-600/20 text-indigo-400' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsSearching(!isSearching)}
            title="Buscar no canal"
            className={`p-2 rounded-lg transition-colors ${
              isSearching ? 'bg-indigo-600/20 text-indigo-400' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* In-channel Search */}
      {isSearching && (
        <div className="px-4 py-2 bg-[var(--surface)] border-b border-[var(--border)] flex items-center gap-2 animate-in slide-in-from-top-2">
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

      {/* ========================================
         MIDDLE: Messages List
         ======================================== */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
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
              <button key={`unpin-${message.id}`} type="button" className="pinned-unpin" title="Desfixar mensagem" aria-label={`Desfixar mensagem de ${message.sender.name}`} onClick={() => { togglePinMessage(message.id); addToast('Mensagem desfixada', 'A mensagem foi removida das fixadas.', 'success'); }}>×</button>
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
            {filteredMessages?.map((msg, index) => {
              if (!msg) return null;
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
                  {startsNewDay && (
                    <div className="flex items-center justify-center mb-4 mt-2">
                      <div className="h-px bg-slate-800 flex-1" />
                      <div className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-indigo-400" />
                        <span>{formatDateHeading(msg.timestamp)}</span>
                      </div>
                      <div className="h-px bg-slate-800 flex-1" />
                    </div>
                  )}
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
          </>
        )}
      </div>

      {/* ========================================
         BOTTOM: Message Input (Floating design)
         ======================================== */}
      <MessageInput
        replyTarget={replyTarget}
        onClearReply={() => setReplyTarget(null)}
      />
    </div>
  );
};

export const ChatArea = React.memo(ChatAreaComponent);