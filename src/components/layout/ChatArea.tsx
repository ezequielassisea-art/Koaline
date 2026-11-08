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
      <div className="chat-area flex flex-col h-full">
        <header className="chat-area-header">
          <div className="chat-area-header-left">
            <div className="chat-area-channel-info">
              <span className="chat-area-channel-icon"><Hash className="w-5 h-5" /></span>
              <span className="chat-area-channel-name">Selecione um canal</span>
            </div>
          </div>
        </header>
        <div className="chat-area-empty flex-1">
          <div className="chat-area-empty-icon">
            <Hash className="w-8 h-8" />
          </div>
          <h3>Nenhum canal selecionado</h3>
          <p>Selecione um canal na barra lateral ou crie um novo para começar a conversar.</p>
        </div>
      </div>
    );
  }

  if (isDirectMessages && !activeDmId) {
    return (
      <div className="chat-area flex flex-col h-full">
        <header className="chat-area-header">
          <div className="chat-area-header-left">
            <div className="chat-area-channel-info">
              <span className="chat-area-channel-icon"><MessageSquare className="w-5 h-5" /></span>
              <span className="chat-area-channel-name">Mensagens Diretas</span>
            </div>
          </div>
        </header>
        <div className="chat-area-empty flex-1">
          <div className="chat-area-empty-icon">
            <MessageSquare className="w-8 h-8" />
          </div>
          <h3>Mensagens Diretas</h3>
          <p>Selecione uma conversa na barra lateral ou inicie uma nova clicando no botão +.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-area flex flex-col h-full">
      {/* ========================================
         HEADER: Channel/DM name, status, action icons
         ======================================== */}
      <header className="chat-area-header">
        {/* Left: Channel / DM Info */}
        <div className="chat-area-header-left">
          {isDirectMessages ? (
            activeDm && activeDm.user ? (
              <div
                onClick={() => openUserProfile(activeDm.user)}
                className="chat-area-channel-info cursor-pointer group"
              >
                <div className="relative" style={{ width: '32px', height: '32px' }}>
                  {activeDm.user.avatar ? (
                    <img
                      src={activeDm.user.avatar}
                      alt={activeDm.user.name || 'Usuário'}
                      className="w-full h-full rounded-full object-cover group-hover:ring-2 group-hover:ring-indigo-500 transition-all"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-white group-hover:ring-2 group-hover:ring-indigo-500 transition-all">
                      {(activeDm.user.name || '?').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[var(--discord-bg-secondary)] ${
                    activeDm.user.status === 'online' ? 'bg-emerald-500' : activeDm.user.status === 'idle' ? 'bg-amber-500' : 'bg-zinc-400'
                  }`} />
                </div>
                <div className="flex flex-col ml-2 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="chat-area-channel-name truncate group-hover:text-indigo-400 transition-colors">
                      {activeDm.user.name || 'Membro Koaline'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    {activeDm.user.status === 'online' ? '● Online' : activeDm.user.status === 'idle' ? '● Ausente' : '○ Offline'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="chat-area-channel-info min-w-0">
                <span className="chat-area-channel-icon"><MessageSquare className="w-5 h-5" /></span>
                <span className="chat-area-channel-name truncate">Mensagem Direta</span>
              </div>
            )
          ) : (
            <div className="chat-area-channel-info min-w-0">
              <span className="chat-area-channel-icon">
                {activeChannel?.type === 'voice' ? <Volume2 className="w-5 h-5" /> : <Hash className="w-5 h-5" />}
              </span>
              <span className="chat-area-channel-name truncate">
                {activeChannel?.name ? `#${activeChannel.name}` : 'chat-geral'}
              </span>
              {activeChannel?.topic && (
                <span className="chat-area-channel-topic truncate hidden md:inline-block">
                  {activeChannel.topic}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="chat-area-header-right">
          {isDirectMessages && activeDm && activeDm.user && (
            <>
              <button
                onClick={() => startDirectCall(activeDm.user, 'voice')}
                title="Chamada de voz"
                className="chat-area-icon-btn"
              >
                <Phone className="w-4 h-4" />
              </button>
              <button
                onClick={() => startDirectCall(activeDm.user, 'video')}
                title="Chamada de vídeo"
                className="chat-area-icon-btn"
              >
                <Video className="w-4 h-4" />
              </button>
              <button
                onClick={() => toggleArchiveDm(activeDm.id)}
                title="Arquivar conversa"
                className="chat-area-icon-btn"
              >
                <Archive className="w-4 h-4" />
              </button>
            </>
          )}

          {!isDirectMessages && hasPinnedMessages && (
            <button
              onClick={() => document.querySelector('.chat-area-pinned-bar')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              title="Mensagens fixadas"
              className="chat-area-icon-btn"
            >
              <Pin className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => isContextPanelOpen ? closeContextPanel() : openMembersPanel()}
            title="Painel de membros"
            className={`chat-area-icon-btn ${isContextPanelOpen ? 'text-indigo-400 bg-indigo-600/20' : ''}`}
          >
            <Users className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsSearching(!isSearching)}
            title="Buscar no canal"
            className={`chat-area-icon-btn ${isSearching ? 'text-indigo-400 bg-indigo-600/20' : ''}`}
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            onClick={() => {}}
            title="Mais opções"
            className="chat-area-icon-btn"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* In-channel Search */}
      {isSearching && (
        <div className="chat-area-search">
          <div className="chat-area-search-wrapper">
            <Search />
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
        <div className="chat-area-pinned-bar">
          <div className="chat-area-pinned-header">
            <Pin className="w-3.5 h-3.5" />
            Fixadas
          </div>
          <div className="chat-area-pinned-list">
            {pinnedMessages.map((message) => (
              <button
                key={message.id}
                type="button"
                className="chat-area-pinned-item"
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
                className="chat-area-pinned-item text-rose-400 hover:text-rose-300"
                onClick={() => { togglePinMessage(message.id); addToast('Mensagem desfixada', 'A mensagem foi removida das fixadas.', 'success'); }}
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Desfixar {message.sender.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reply Preview */}
      {replyTarget && (
        <div className="chat-area-reply-preview">
          <div className="chat-area-reply-content">
            <div className="chat-area-reply-text">
              <div className="chat-area-reply-author">Respondendo a {replyTarget.sender.name}</div>
              <div className="chat-area-reply-message">{replyTarget.content || 'Anexo'}</div>
            </div>
            <button
              onClick={() => setReplyTarget(null)}
              className="chat-area-reply-close"
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
      <div className="chat-area-messages" role="log" aria-live="polite" aria-label="Mensagens">
        {filteredMessages.length === 0 ? (
          <div className="chat-area-empty flex-1">
            <div className="chat-area-empty-icon">
              {isDirectMessages ? <MessageSquare className="w-8 h-8" /> : <Hash className="w-8 h-8" />}
            </div>
            <h3>{isDirectMessages ? 'Nenhuma mensagem ainda' : 'Canal vazio'}</h3>
            <p>{isDirectMessages ? 'Inicie a conversa enviando a primeira mensagem.' : 'Seja o primeiro a enviar uma mensagem neste canal!'}</p>
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
                    <div className="chat-area-date-divider">
                      <span>{formatDateHeading(msg.timestamp)}</span>
                    </div>
                  )}
                  {msg.id === firstUnreadId && (
                    <div className="chat-area-unread-divider"><span>Não lidas</span></div>
                  )}
                  <div
                    id={`message-${msg.id}`}
                    className={`message-bubble ${isSelf ? 'self' : ''} ${isGrouped ? 'is-grouped' : ''}`}
                    data-message-id={msg.id}
                  >
                    {!isGrouped && (
                      <div className="message-avatar">
                        {msg.sender.avatar ? (
                          <img src={msg.sender.avatar} alt={msg.sender.name} className="message-avatar" />
                        ) : (
                          <div className="message-avatar-fallback">
                            {msg.sender.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="message-content">
                      {!isSelf && !isGrouped && (
                        <div className="message-header">
                          <span className="message-author">{msg.sender.name}</span>
                          <span className="message-timestamp">{formatRelativeTime(msg.timestamp)}</span>
                          {msg.pinned && <Pin className="w-3.5 h-3.5 text-yellow-400" />}
                        </div>
                      )}
                      <div className={`message-text ${isSelf ? 'self' : ''}`}>
                        {msg.content}
                      </div>
                      {isSelf && (
                        <div className="message-timestamp" style={{ alignSelf: 'flex-end', marginRight: '12px' }}>
                          {formatRelativeTime(msg.timestamp)}
                          {msg.pinned && <Pin className="w-3.5 h-3.5 text-yellow-300 ml-1 inline" />}
                        </div>
                      )}
                    </div>

                    {/* Hover Actions */}
                    <div className="message-hover-actions">
                      {!isSelf && (
                        <button
                          className="message-hover-btn"
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
                            className="message-hover-btn"
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
                            className="message-hover-btn text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
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
                            className="message-hover-btn"
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
                            className="message-hover-btn"
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
                            className="message-hover-btn text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
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
                          className="message-hover-btn"
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
                      <div className="emoji-picker-popover" style={{ right: '0', bottom: '100%', marginBottom: '4px' }}>
                        {['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '👀', '👏', '🙏'].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEmojiPick(emoji);
                            }}
                            className="message-hover-btn text-2xl"
                            style={{ width: '36px', height: '36px', borderRadius: '8px', fontSize: '18px' }}
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
              <div className="chat-area-typing animate-in fade-in">
                <span className="font-semibold text-indigo-400">{typingUser || 'Alguém'}</span>
                <span>está digitando</span>
                <span className="chat-area-typing-dots">
                  <span />
                  <span />
                  <span />
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
      <div className="chat-area-input-container">
        <div className="chat-area-input-wrapper">
          <div className="chat-area-input-actions">
            <button className="chat-area-input-btn" title="Anexar arquivo" aria-label="Anexar arquivo">
              <Paperclip className="w-5 h-5" />
            </button>
            <button className="chat-area-input-btn" title="Gravar áudio" aria-label="Gravar áudio">
              <Mic className="w-5 h-5" />
            </button>
            <button className="chat-area-input-btn" title="Emojis" aria-label="Emojis" onClick={() => {}}>
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
            className="chat-area-input"
            rows={1}
            aria-label={editingMessageId ? 'Editar mensagem' : 'Digite sua mensagem'}
          />
          <button
            onClick={handleSendMessage}
            disabled={!editingMessageId ? !messageInputRef.current?.value.trim() : !editContent.trim()}
            className="chat-area-input-send"
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