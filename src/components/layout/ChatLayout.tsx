import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { Message } from '../../types';
import { MessageItem } from '../chat/MessageItem';
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

const ChatLayout: React.FC = () => {
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
    markMessageRead,
    getMessageReadStatus,
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
  const [messageText, setMessageText] = useState('');

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
    if (editingMessageId) {
      if (editContent.trim()) {
        editMessage(editingMessageId, editContent.trim());
        setEditingMessageId(null);
        setEditContent('');
      }
    } else if (messageText.trim()) {
      const replyTo = replyTarget ? {
        id: replyTarget.id,
        senderName: replyTarget.sender.name,
        content: replyTarget.content || '',
      } : undefined;
      sendMessage(messageText.trim(), replyTo);
      setMessageText('');
      if (messageInputRef.current) messageInputRef.current.style.height = 'auto';
      setReplyTarget(null);
    }
  }, [sendMessage, replyTarget, editingMessageId, editContent, editMessage, messageText]);

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
    const value = textarea.value;
    if (editingMessageId) {
      setEditContent(value);
    } else {
      setMessageText(value);
    }
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

  // Render empty state when no channel/DM selected
  if (!activeChannelKey && !isDirectMessages) {
    return (
      <div className="chat-area-v2 flex flex-col h-full">
        <header className="chat-area-header-v2">
          <div className="chat-area-header-left-v2">
            <div className="chat-area-channel-info-v2">
              <div className="chat-area-channel-avatar-v2">
                <div className="chat-area-channel-avatar-fallback-v2">
                  <Hash className="w-6 h-6" />
                </div>
              </div>
              <span className="chat-area-channel-name-v2">Selecione um canal</span>
            </div>
          </div>
          <div className="chat-area-header-right-v2" />
        </header>
        <div className="chat-area-empty-v2 flex-1">
          <div className="chat-area-empty-icon-v2">
            <Hash className="w-12 h-12" />
          </div>
          <h3>Nenhum canal selecionado</h3>
          <p>Selecione um canal na barra lateral ou crie um novo para começar a conversar.</p>
        </div>
        <div className="chat-area-input-container-v2" />
      </div>
    );
  }

  if (isDirectMessages && !activeDmId) {
    return (
      <div className="chat-area-v2 flex flex-col h-full">
        <header className="chat-area-header-v2">
          <div className="chat-area-header-left-v2">
            <div className="chat-area-channel-info-v2">
              <div className="chat-area-channel-avatar-v2">
                <div className="chat-area-channel-avatar-fallback-v2">
                  <MessageSquare className="w-6 h-6" />
                </div>
              </div>
              <span className="chat-area-channel-name-v2">Mensagens Diretas</span>
            </div>
          </div>
          <div className="chat-area-header-right-v2" />
        </header>
        <div className="chat-area-empty-v2 flex-1">
          <div className="chat-area-empty-icon-v2">
            <MessageSquare className="w-12 h-12" />
          </div>
          <h3>Mensagens Diretas</h3>
          <p>Selecione uma conversa na barra lateral ou inicie uma nova clicando no botão +.</p>
        </div>
        <div className="chat-area-input-container-v2" />
      </div>
    );
  }

  return (
    <div className="chat-area-v2 flex flex-col h-full bg-white">
      {/* ========================================
         HEADER: Channel/DM name, status, action icons
         ======================================== */}
      <header className="chat-area-header-v2">
        {/* Left: Channel / DM Info */}
        <div className="chat-area-header-left-v2">
          {isDirectMessages ? (
            activeDm && activeDm.user ? (
              <div
                onClick={() => openUserProfile(activeDm.user)}
                className="chat-area-channel-info-v2 min-w-0 cursor-pointer group"
              >
                <div className="chat-area-channel-avatar-v2">
                  {activeDm.user.avatar ? (
                    <img
                      src={activeDm.user.avatar}
                      alt={activeDm.user.name || 'Usuário'}
                      className="w-full h-full rounded-full object-cover group-hover:ring-2 group-hover:ring-primary transition-all"
                    />
                  ) : (
                    <div className="chat-area-channel-avatar-fallback-v2">
                      {(activeDm.user.name || '?').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className={`chat-area-channel-status-v2 ${
                    activeDm.user.status === 'online' ? 'online' :
                    activeDm.user.status === 'idle' ? 'idle' : 'offline'
                  }`} />
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="chat-area-channel-name-v2 truncate group-hover:text-primary transition-colors">
                      {activeDm.user.name || 'Membro Koaline'}
                    </span>
                  </div>
                  <div className="chat-area-channel-meta-v2 truncate">
                    {activeDm.user.status === 'online' ? '● Online' : activeDm.user.status === 'idle' ? '● Ausente' : '○ Offline'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="chat-area-channel-info-v2">
                <div className="chat-area-channel-avatar-v2">
                  <div className="chat-area-channel-avatar-fallback-v2">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                </div>
                <span className="chat-area-channel-name-v2 truncate">Mensagem Direta</span>
              </div>
            )
          ) : (
            <div className="chat-area-channel-info-v2">
              <div className="chat-area-channel-avatar-v2">
                {activeChannel?.type === 'voice' ? (
                  <div className="w-full h-full rounded-full bg-primary-light flex items-center justify-center">
                    <Volume2 className="w-6 h-6 text-primary" />
                  </div>
                ) : (
                  <div className="w-full h-full rounded-full bg-primary-light flex items-center justify-center">
                    <Hash className="w-6 h-6 text-primary" />
                  </div>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="chat-area-channel-name-v2 truncate">
                  {activeChannel?.name ? `#${activeChannel.name}` : 'chat-geral'}
                </span>
                {activeChannel?.topic && (
                  <span className="chat-area-channel-meta-v2 truncate hidden md:inline-block max-w-xs">
                    {activeChannel.topic}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="chat-area-header-right-v2">
          {isDirectMessages && activeDm && activeDm.user && (
            <>
              <button
                onClick={() => startDirectCall(activeDm.user, 'voice')}
                title="Chamada de voz"
                className="chat-area-icon-btn-v2"
              >
                <Phone className="w-4 h-4" />
              </button>
              <button
                onClick={() => startDirectCall(activeDm.user, 'video')}
                title="Chamada de vídeo"
                className="chat-area-icon-btn-v2"
              >
                <Video className="w-4 h-4" />
              </button>
              <button
                onClick={() => toggleArchiveDm(activeDm.id)}
                title="Arquivar conversa"
                className="chat-area-icon-btn-v2"
              >
                <Archive className="w-4 h-4" />
              </button>
            </>
          )}

          {!isDirectMessages && hasPinnedMessages && (
            <button
              onClick={() => document.querySelector('.chat-area-pinned-bar')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              title="Mensagens fixadas"
              className="chat-area-icon-btn-v2"
            >
              <Pin className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => isContextPanelOpen ? closeContextPanel() : openMembersPanel()}
            title="Painel de membros"
            className={`chat-area-icon-btn-v2 ${isContextPanelOpen ? 'active' : ''}`}
          >
            <Users className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsSearching(!isSearching)}
            title="Buscar no canal"
            className={`chat-area-icon-btn-v2 ${isSearching ? 'active' : ''}`}
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            onClick={() => {}}
            title="Mais opções"
            className="chat-area-icon-btn-v2"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* In-channel Search */}
      {isSearching && (
        <div className="chat-area-search px-4 py-3 border-b border-border bg-surface">
          <div className="chat-area-search-wrapper">
            <Search className="w-4 h-4" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Pesquisar neste canal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="chat-area-search-input"
            />
          </div>
        </div>
      )}

      {/* Pinned Messages Bar */}
      {pinnedMessages.length > 0 && (
        <div className="chat-area-pinned-bar px-4 py-2 border-b border-border bg-surface">
          <div className="chat-area-pinned-header flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider mb-2">
            <Pin className="w-3.5 h-3.5" />
            Fixadas
          </div>
          <div className="chat-area-pinned-list flex flex-wrap gap-2">
            {pinnedMessages.map((message) => (
              <button
                key={message.id}
                type="button"
                className="chat-area-pinned-item flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-surface text-text-main text-sm cursor-pointer hover:border-primary transition-colors"
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
        <div className="chat-area-reply-preview px-4 py-2 border-b border-border bg-primary-light flex items-center justify-between gap-4">
          <div className="chat-area-reply-content flex items-center gap-3 flex-1 min-w-0">
            <div className="chat-area-reply-text flex-1 min-w-0">
              <div className="text-xs font-semibold text-primary">Respondendo a {replyTarget.sender.name}</div>
              <div className="text-sm text-text-main truncate">{replyTarget.content || 'Anexo'}</div>
            </div>
            <button
              onClick={() => setReplyTarget(null)}
              className="chat-area-reply-close p-1.5 rounded-full text-text-muted hover:text-text-main hover:bg-bg-hover transition-colors flex-shrink-0"
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
      <div className="chat-area-messages-v2 flex-1 overflow-y-auto" role="log" aria-live="polite" aria-label="Mensagens">
        {filteredMessages.length === 0 ? (
          <div className="chat-area-empty-v2 flex-1">
            <div className="chat-area-empty-icon-v2">
              {isDirectMessages ? <MessageSquare className="w-12 h-12" /> : <Hash className="w-12 h-12" />}
            </div>
            <h3>{isDirectMessages ? 'Nenhuma mensagem ainda' : 'Canal vazio'}</h3>
            <p>{isDirectMessages ? 'Inicie a conversa enviando a primeira mensagem.' : 'Seja o primeiro a enviar uma mensagem neste canal!'}</p>
            <button className="chat-area-empty-button" onClick={() => messageInputRef.current?.focus()}>
              <MessageSquare className="w-4 h-4" />
              Dizer Olá
            </button>
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
              const timeLabel = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(parseAppDate(msg.timestamp));
              const readStatus = getMessageReadStatus(msg.id, activeChannelKey, isDirectMessages);

              return (
                <React.Fragment key={msg.id}>
                  {startsNewDay && (
                    <div className="chat-area-date-divider flex items-center justify-center gap-3 my-4">
                      <span className="text-xs font-bold text-text-muted uppercase tracking-wider">{formatDateHeading(msg.timestamp)}</span>
                    </div>
                  )}
                  {msg.id === firstUnreadId && (
                    <div className="chat-area-unread-divider flex items-center justify-center gap-3 my-3">
                      <span className="text-xs font-bold text-primary uppercase tracking-wider">Não lidas</span>
                    </div>
                  )}
                  <MessageItem
                    message={msg}
                    isGrouped={isGrouped}
                    isUnread={isUnread}
                    timeLabel={timeLabel}
                    readStatus={readStatus}
                    onReply={handleReply}
                  />
                </React.Fragment>
              );
            })}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="chat-area-typing flex items-center gap-2 px-4 py-2 text-sm text-text-muted animate-in fade-in">
                <span className="font-semibold text-primary">{typingUser || 'Alguém'}</span>
                <span>está digitando</span>
                <span className="chat-area-typing-dots flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* ========================================
         BOTTOM: Floating Message Input - Pill Format
         ======================================== */}
      <div className="chat-area-input-container-v2">
        <div className="chat-area-input-wrapper-v2">
          <div className="chat-area-input-actions-v2">
            <button className="chat-area-input-btn-v2" title="Anexar arquivo" aria-label="Anexar arquivo">
              <Paperclip className="w-5 h-5" />
            </button>
            <button className="chat-area-input-btn-v2" title="Gravar áudio" aria-label="Gravar áudio">
              <Mic className="w-5 h-5" />
            </button>
            <button className="chat-area-input-btn-v2" title="Emojis" aria-label="Emojis" onClick={() => {}}>
              <Smile className="w-5 h-5" />
            </button>
          </div>
          <textarea
            ref={messageInputRef}
            value={editingMessageId ? editContent : messageText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={editingMessageId ? `Editando...` : isDirectMessages ? 'Mensagem...' : `#${activeChannel?.name || 'chat'}...`}
            className="chat-area-input-v2"
            rows={1}
            aria-label={editingMessageId ? 'Editar mensagem' : 'Digite sua mensagem'}
          />
          <button
            onClick={handleSendMessage}
            disabled={!editingMessageId ? !messageText.trim() : !editContent.trim()}
            className="chat-area-input-send-v2"
            aria-label={editingMessageId ? 'Salvar edição' : 'Enviar mensagem'}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatLayout;