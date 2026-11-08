import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { Message } from '../../types';
import {
  Search,
  Calendar,
  Phone,
  Video,
  Users,
  Archive,
  Pin,
  X,
  MoreHorizontal,
  Smile,
  Paperclip,
  Mic,
  Send,
  Edit3,
  Trash2,
  Flag,
  Copy,
  Reply,
  Hash,
  MessageSquare,
  Volume2,
} from 'lucide-react';
import { formatDateHeading, formatRelativeTime, isSameLocalDay, parseAppDate } from '../../utils/time';
import { canModerateCommunity } from '../admin/adminAccess';

const ChatArea: React.FC = () => {
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
    deleteMessage,
    editMessage,
  } = useApp();

  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [, setClock] = useState(Date.now());
  const [showEmojiPicker, setShowEmojiPicker] = useState<{ messageId: string; x: number; y: number } | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  const activeDm = activeDmId ? dms.find((d) => d.id === activeDmId) : null;
  const activeChannel = activeCommunity?.channels?.find((c) => c.id === currentChannelId) || null;
  const hasPinnedMessages = !!(activeChannelKey && messages[activeChannelKey]?.some((message) => message && message.pinned && !message.isDeleted));

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [channelMessages.length, isTyping]);

  // Update clock for relative time
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // Mark channel as read
  useEffect(() => {
    if (activeChannelKey) markChannelRead(activeChannelKey);
  }, [activeChannelKey]);

  const lastReadAt = lastReadAtByChannel[activeChannelKey];
  const firstUnreadId = channelMessages.find((message) => message.senderId !== currentUser.id && (!lastReadAt || parseAppDate(message.timestamp).getTime() > parseAppDate(lastReadAt).getTime()))?.id;

  // Handle emoji pick
  const handleEmojiPick = (emoji: string) => {
    if (messageInputRef.current) {
      const start = messageInputRef.current.selectionStart;
      const end = messageInputRef.current.selectionEnd;
      const newValue = messageInputRef.current.value.slice(0, start) + emoji + messageInputRef.current.value.slice(end);
      messageInputRef.current.value = newValue;
      messageInputRef.current.focus();
      messageInputRef.current.setSelectionRange(start + emoji.length, start + emoji.length);
      // Trigger onChange
      const event = new Event('input', { bubbles: true });
      messageInputRef.current.dispatchEvent(event);
    }
    setShowEmojiPicker(null);
  };

  // Handle message send
  const handleSendMessage = useCallback(() => {
    if (messageInputRef.current && messageInputRef.current.value.trim()) {
      const content = messageInputRef.current.value.trim();
      if (editingMessageId) {
        editMessage(editingMessageId, content);
        setEditingMessageId(null);
        setEditContent('');
      } else {
        const replyTo = replyTarget ? {
          id: replyTarget.id,
          senderName: replyTarget.sender.name,
          content: replyTarget.content || '',
        } : undefined;
        sendMessage(content, replyTo);
      }
      messageInputRef.current.value = '';
      messageInputRef.current.style.height = 'auto';
      setReplyTarget(null);
    }
  }, [sendMessage, replyTarget, editingMessageId, editMessage]);

  // Handle key down in message input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 180) + 'px';
  };

  // Handle reply
  const handleReply = useCallback((target: Message) => {
    setReplyTarget(target);
    messageInputRef.current?.focus();
  }, []);

  // Handle edit message
  const handleStartEdit = (message: Message) => {
    setEditingMessageId(message.id);
    setEditContent(message.content || '');
    setReplyTarget(null);
    setTimeout(() => messageInputRef.current?.focus(), 0);
  };

  // Handle delete message
  const handleDeleteMessage = async (messageId: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta mensagem?')) {
      await deleteMessage(messageId);
      addToast('Mensagem excluída', 'A mensagem foi removida.', 'success');
    }
  };

  // Handle pin/unpin
  const handleTogglePin = (messageId: string) => {
    togglePinMessage(messageId);
    addToast('Mensagem fixada', 'A mensagem foi adicionada às fixadas.', 'success');
  };

  // Handle copy message
  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    addToast('Copiado', 'Mensagem copiada para a área de transferência.', 'success');
  };

  // Handle flag message
  const handleFlagMessage = () => {
    addToast('Denunciado', 'A mensagem foi denunciada para moderação.', 'warning');
  };

  // Close emoji picker on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showEmojiPicker && e.target instanceof Element && !e.target.closest('.message-hover-actions')) {
        setShowEmojiPicker(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  // Focus search input when opened
  useEffect(() => {
    if (isSearching) {
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [isSearching]);

  // Render empty state
  if (!activeChannelKey && !isDirectMessages) {
    return (
      <div className="flex flex-col h-full">
        <header className="h-14 px-4 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
              <Hash className="w-5 h-5 text-gray-500" />
            </div>
            <span className="font-semibold text-gray-900">Selecione um canal</span>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <div className="max-w-md">
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-gray-200 bg-gray-100 text-2xl">
              <Hash className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Nenhum canal selecionado</h3>
            <p className="text-sm text-gray-500">Selecione um canal na barra lateral ou crie um novo para começar a conversar.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isDirectMessages && !activeDmId) {
    return (
      <div className="flex flex-col h-full">
        <header className="h-14 px-4 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-gray-500" />
            </div>
            <span className="font-semibold text-gray-900">Mensagens Diretas</span>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <div className="max-w-md">
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-gray-200 bg-gray-100 text-2xl">
              <MessageSquare className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Mensagens Diretas</h3>
            <p className="text-sm text-gray-500">Selecione uma conversa na barra lateral ou inicie uma nova clicando no botão +.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* ========================================
         HEADER: Channel/DM name, status, action icons
         ======================================== */}
      <header className="h-14 px-4 border-b border-gray-100 flex items-center justify-between bg-white">
        {/* Left: Channel / DM Info */}
        <div className="flex items-center gap-3 min-w-0">
          {isDirectMessages ? (
            activeDm && activeDm.user ? (
              <div
                onClick={() => openUserProfile(activeDm.user)}
                className="flex items-center gap-3 min-w-0 cursor-pointer group"
              >
                <div className="relative w-9 h-9 flex-shrink-0">
                  {activeDm.user.avatar ? (
                    <img
                      src={activeDm.user.avatar}
                      alt={activeDm.user.name || 'Usuário'}
                      className="w-full h-full rounded-full object-cover group-hover:ring-2 group-hover:ring-[#00BFFF] transition-all"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600 group-hover:ring-2 group-hover:ring-[#00BFFF] transition-all">
                      {(activeDm.user.name || '?').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                    activeDm.user.status === 'online' ? 'bg-emerald-500' : activeDm.user.status === 'idle' ? 'bg-amber-500' : 'bg-gray-400'
                  }`} />
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 truncate group-hover:text-[#00BFFF] transition-colors">
                      {activeDm.user.name || 'Membro Koaline'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {activeDm.user.status === 'online' ? '● Online' : activeDm.user.status === 'idle' ? '● Ausente' : '○ Offline'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-gray-500" />
                </div>
                <span className="font-semibold text-gray-900 truncate">Mensagem Direta</span>
              </div>
            )
          ) : (
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                {activeChannel?.type === 'voice' ? <Volume2 className="w-5 h-5 text-gray-500" /> : <Hash className="w-5 h-5 text-gray-500" />}
              </div>
              <span className="font-semibold text-gray-900 truncate">
                {activeChannel?.name ? `#${activeChannel.name}` : 'chat-geral'}
              </span>
              {activeChannel?.topic && (
                <span className="text-xs text-gray-500 truncate hidden md:inline-block max-w-xs">
                  {activeChannel.topic}
                </span>
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
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <Phone className="w-4 h-4" />
              </button>
              <button
                onClick={() => startDirectCall(activeDm.user, 'video')}
                title="Chamada de vídeo"
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <Video className="w-4 h-4" />
              </button>
              <button
                onClick={() => toggleArchiveDm(activeDm.id)}
                title="Arquivar conversa"
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <Archive className="w-4 h-4" />
              </button>
            </>
          )}

          {!isDirectMessages && hasPinnedMessages && (
            <button
              onClick={() => document.querySelector('.chat-area-pinned-bar')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              title="Mensagens fixadas"
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <Pin className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => isContextPanelOpen ? closeContextPanel() : openMembersPanel()}
            title="Painel de membros"
            className={`p-2 rounded-lg transition-colors ${isContextPanelOpen ? 'text-[#00BFFF] bg-[#00BFFF]/10' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
          >
            <Users className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsSearching(!isSearching)}
            title="Buscar no canal"
            className={`p-2 rounded-lg transition-colors ${isSearching ? 'text-[#00BFFF] bg-[#00BFFF]/10' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            onClick={() => {}}
            title="Mais opções"
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* In-channel Search */}
      {isSearching && (
        <div className="px-4 py-3 border-b border-gray-100 bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Pesquisar neste canal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-full bg-gray-100 text-gray-900 placeholder-gray-500 text-sm border-0 focus:outline-none focus:ring-2 focus:ring-[#00BFFF]/20"
            />
          </div>
        </div>
      )}

      {/* Pinned Messages Bar */}
      {pinnedMessages.length > 0 && (
        <div className="chat-area-pinned-bar px-4 py-2 border-b border-gray-100 bg-white">
          <div className="chat-area-pinned-header flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            <Pin className="w-3.5 h-3.5 text-[#00BFFF]" />
            Fixadas
          </div>
          <div className="chat-area-pinned-list flex flex-wrap gap-2">
            {pinnedMessages.map((message) => (
              <button
                key={message.id}
                type="button"
                className="chat-area-pinned-item flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm cursor-pointer hover:border-[#00BFFF] transition-colors"
                title="Ir para mensagem fixada"
                onClick={() => document.getElementById(`message-${message.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              >
                <span className="truncate">{message.sender.name}: {message.content || 'Anexo'}</span>
              </button>
            ))}
            {canModerate && pinnedMessages.map((message) => (
              <button
                key={`unpin-${message.id}`}
                type="button"
                className="chat-area-pinned-item flex items-center gap-2 px-3 py-1.5 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                onClick={() => { togglePinMessage(message.id); addToast('Mensagem desfixada', 'A mensagem foi removida das fixadas.', 'success'); }}
              >
                <X className="w-3.5 h-3.5" />
                Desfixar {message.sender.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reply Preview */}
      {replyTarget && (
        <div className="chat-area-reply-preview px-4 py-2 border-b border-gray-100 bg-[#00BFFF]/5 flex items-center justify-between gap-4">
          <div className="chat-area-reply-content flex items-center gap-3 flex-1 min-w-0">
            <div className="chat-area-reply-text flex-1 min-w-0">
              <div className="text-xs font-semibold text-[#00BFFF]">Respondendo a {replyTarget.sender.name}</div>
              <div className="text-sm text-gray-700 truncate">{replyTarget.content || 'Anexo'}</div>
            </div>
            <button
              onClick={() => setReplyTarget(null)}
              className="chat-area-reply-close p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-colors flex-shrink-0"
              aria-label="Cancelar resposta"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================
         MIDDLE: Messages List
         ======================================== */}
      <div className="chat-area-messages flex-1 overflow-y-auto p-4" role="log" aria-live="polite" aria-label="Mensagens">
        {filteredMessages.length === 0 ? (
          <div className="chat-area-empty flex-1 flex flex-col items-center justify-center text-center text-gray-500 gap-3">
            <div className="chat-area-empty-icon">
              {isDirectMessages ? <MessageSquare className="w-10 h-10 text-gray-300" /> : <Hash className="w-10 h-10 text-gray-300" />}
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{isDirectMessages ? 'Nenhuma mensagem ainda' : 'Canal vazio'}</h3>
            <p className="text-sm">{isDirectMessages ? 'Inicie a conversa enviando a primeira mensagem.' : 'Seja o primeiro a enviar uma mensagem neste canal!'}</p>
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
              const isSelf = msg.senderId === currentUser.id;
              const isUnread = !!lastReadAt && msg.senderId !== currentUser.id && parseAppDate(msg.timestamp).getTime() > parseAppDate(lastReadAt).getTime();

              return (
                <React.Fragment key={msg.id}>
                  {startsNewDay && (
                    <div className="chat-area-date-divider flex items-center justify-center gap-3 my-4">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{formatDateHeading(msg.timestamp)}</span>
                    </div>
                  )}
                  {msg.id === firstUnreadId && (
                    <div className="chat-area-unread-divider flex items-center justify-center gap-3 my-3">
                      <span className="text-xs font-bold text-[#00BFFF] uppercase tracking-wider">Não lidas</span>
                    </div>
                  )}
                  <div
                    id={`message-${msg.id}`}
                    className={`message-bubble flex gap-3 px-1 py-1 ${isSelf ? 'self' : ''} ${isGrouped ? 'is-grouped' : ''}`}
                    data-message-id={msg.id}
                  >
                    {!isGrouped && (
                      <div className="message-avatar flex-shrink-0">
                        {msg.sender.avatar ? (
                          <img src={msg.sender.avatar} alt={msg.sender.name} className="w-9 h-9 rounded-full object-cover" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-base">
                            {msg.sender.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="message-content flex-1 min-w-0 flex flex-col gap-1.5">
                      {!isSelf && !isGrouped && (
                        <div className="message-header flex items-center gap-2">
                          <span className="message-author text-sm font-semibold text-gray-900">{msg.sender.name}</span>
                          <span className="message-timestamp text-xs text-gray-500">{formatRelativeTime(msg.timestamp)}</span>
                          {msg.pinned && <Pin className="w-3.5 h-3.5 text-amber-400" />}
                        </div>
                      )}
                      <div className={`message-text ${isSelf ? 'self' : ''}`}>
                        <div className={`message-bubble ${isSelf ? 'message-bubble-self' : 'message-bubble-other'} max-w-[85%] rounded-2xl px-4 py-2 ${isSelf ? 'bg-[#00BFFF] text-white' : 'bg-gray-100 text-gray-800'} ${isSelf ? 'rounded-tr-xl' : 'rounded-tl-xl'}`}>
                          <div className="message-copy text-sm leading-relaxed">{msg.content}</div>
                        </div>
                      </div>
                      {isSelf && (
                        <div className="message-timestamp text-xs text-white/70 text-right mr-1 flex items-center justify-end gap-1">
                          {formatRelativeTime(msg.timestamp)}
                          {msg.pinned && <Pin className="w-3.5 h-3.5 text-amber-300" />}
                        </div>
                      )}
                    </div>

                    {/* Hover Actions */}
                    <div className="message-hover-actions flex items-center gap-1 opacity-0 transition-opacity hover:opacity-100 self-start -ml-2">
                      {!isSelf && (
                        <button
                          className="message-hover-btn p-1.5 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setShowEmojiPicker({ messageId: msg.id, x: rect.left, y: rect.top });
                          }}
                          title="Adicionar reação"
                          aria-label="Adicionar reação"
                        >
                          <Smile className="w-4 h-4" />
                        </button>
                      )}
                      {isSelf && !editingMessageId && (
                        <>
                          <button
                            className="message-hover-btn p-1.5 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(msg);
                            }}
                            title="Editar"
                            aria-label="Editar mensagem"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            className="message-hover-btn p-1.5 rounded-lg bg-white border border-gray-200 text-rose-400 hover:text-rose-500 hover:bg-rose-50 transition-colors shadow-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMessage(msg.id);
                            }}
                            title="Excluir"
                            aria-label="Excluir mensagem"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {!isSelf && (
                        <>
                          <button
                            className="message-hover-btn p-1.5 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReply(msg);
                            }}
                            title="Responder"
                            aria-label="Responder"
                          >
                            <Reply className="w-4 h-4" />
                          </button>
                          <button
                            className="message-hover-btn p-1.5 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyMessage(msg.content || '');
                            }}
                            title="Copiar"
                            aria-label="Copiar mensagem"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            className="message-hover-btn p-1.5 rounded-lg bg-white border border-gray-200 text-amber-400 hover:text-amber-500 hover:bg-amber-50 transition-colors shadow-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFlagMessage();
                            }}
                            title="Denunciar"
                            aria-label="Denunciar mensagem"
                          >
                            <Flag className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {canModerate && !msg.pinned && (
                        <button
                          className="message-hover-btn p-1.5 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePin(msg.id);
                          }}
                          title="Fixar mensagem"
                          aria-label="Fixar mensagem"
                        >
                          <Pin className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Emoji Picker Popover */}
                    {showEmojiPicker?.messageId === msg.id && (
                      <div className="emoji-picker-popover absolute right-0 bottom-full mb-2 flex gap-2 p-2 rounded-xl border border-gray-200 bg-white shadow-lg z-10" style={{ right: '0', bottom: '100%', marginBottom: '4px' }}>
                        {['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '👀', '👏', '🙏'].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEmojiPick(emoji);
                            }}
                            className="p-2 rounded-lg text-2xl hover:bg-gray-100 transition-colors"
                            style={{ width: '40px', height: '40px', borderRadius: '8px', fontSize: '18px' }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="chat-area-typing flex items-center gap-2 px-4 py-2 text-sm text-gray-500 animate-in fade-in">
                <span className="font-semibold text-[#00BFFF]">{typingUser || 'Alguém'}</span>
                <span>está digitando</span>
                <span className="chat-area-typing-dots flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00BFFF] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00BFFF] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00BFFF] animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* ========================================
         BOTTOM: Floating Message Input
         ======================================== */}
      <div className="chat-area-input-container p-4 border-t border-gray-100 bg-white">
        <div className="chat-area-input-wrapper flex items-end gap-2 rounded-2xl bg-gray-50 border border-gray-200 p-2 shadow-sm focus-within:border-[#00BFFF] focus-within:ring-2 focus-within:ring-[#00BFFF]/20 transition-all">
          <div className="chat-area-input-actions flex gap-1">
            <button className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors" title="Anexar arquivo" aria-label="Anexar arquivo">
              <Paperclip className="w-5 h-5" />
            </button>
            <button className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors" title="Gravar áudio" aria-label="Gravar áudio">
              <Mic className="w-5 h-5" />
            </button>
            <button className="p-2 rounded-xl text-gray-400 hover:text-amber-400 hover:bg-amber-50 transition-colors" title="Emojis" aria-label="Emojis" onClick={() => {}}>
              <Smile className="w-5 h-5" />
            </button>
          </div>
          <textarea
            ref={messageInputRef}
            value={editingMessageId ? editContent : ''}
            onChange={(e) => {
              if (editingMessageId) setEditContent(e.target.value);
              handleInputChange(e);
            }}
            onKeyDown={handleKeyDown}
            placeholder={editingMessageId ? `Editando...` : isDirectMessages ? 'Mensagem...' : `#${activeChannel?.name || 'chat'}...`}
            className="chat-area-input flex-1 bg-transparent border-0 resize-none py-1.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none max-h-32 min-h-[20px]"
            rows={1}
            aria-label={editingMessageId ? 'Editar mensagem' : 'Digite sua mensagem'}
          />
          <button
            onClick={handleSendMessage}
            disabled={!editingMessageId ? !messageInputRef.current?.value.trim() : !editContent.trim()}
            className="chat-area-input-send p-2.5 rounded-xl bg-[#00BFFF] hover:bg-[#009FD6] text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            aria-label={editingMessageId ? 'Salvar edição' : 'Enviar mensagem'}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatArea;