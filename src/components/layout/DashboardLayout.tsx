import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Home,
  MessageSquare,
  Bell,
  Users,
  Plus,
  Search,
  Settings,
  ChevronDown,
  ChevronUp,
  LogOut,
  User,
  UserPlus,
  X,
  Send,
  Paperclip,
  Mic,
  Smile,
  MoreHorizontal,
  Heart,
  Repeat,
  Share2,
  Flag,
  Bookmark,
  EllipsisVertical,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../services/supabaseClient';

interface DashboardLayoutProps {
  className?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ className = '' }) => {
  const {
    currentUser,
    communities,
    dms,
    messages,
    currentCommunityId,
    currentChannelId,
    isDirectMessages,
    activeDmId,
    setCurrentCommunityId,
    setCurrentChannelId,
    setIsDirectMessages,
    setActiveDmId,
    openDirectMessage,
    sendMessage,
    isLoggedIn,
    setIsLoggedIn,
    addToast,
    notifications,
    markNotificationRead,
    deleteNotification,
    clearAllNotifications,
    updateCurrentUser,
    voicePresence,
    isContextPanelOpen,
    setIsContextPanelOpen,
    contextPanelUser,
    openUserProfile,
    openMembersPanel,
    closeContextPanel,
    isProfileEditorOpen,
    setIsProfileEditorOpen,
    activeUserMenu,
    closeUserMenu,
    setIsLoggedIn: setLoggedIn,
  } = useApp();

  // UI State
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeChatType, setActiveChatType] = useState<'dm' | 'channel' | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of chat
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeChatId, activeChatType, scrollToBottom]);

  // Get current community
  const currentCommunity = communities.find(c => c.id === currentCommunityId);

  // Get current channel
  const currentChannel = currentCommunity?.channels.find(c => c.id === currentChannelId);

  // Get active DM
  const activeDm = dms.find(dm => dm.id === activeDmId);

  // Get messages for active chat
  const getActiveMessages = () => {
    if (activeChatType === 'dm' && activeChatId) {
      return messages[activeChatId] || [];
    }
    if (activeChatType === 'channel' && activeChatId) {
      return messages[activeChatId] || [];
    }
    return [];
  };

  const activeMessages = getActiveMessages();

  // Handle opening a chat
  const handleOpenChat = useCallback(async (type: 'dm' | 'channel', id: string) => {
    setActiveChatId(id);
    setActiveChatType(type);

    if (type === 'dm') {
      const dm = dms.find(d => d.id === id);
      if (dm) {
        await openDirectMessage(dm.user);
      }
    } else if (type === 'channel') {
      setIsDirectMessages(false);
      setActiveDmId(null);
      const community = communities.find(c => c.channels.some(ch => ch.id === id));
      if (community) {
        setCurrentCommunityId(community.id);
        setCurrentChannelId(id);
      }
    }

    // On mobile, close left sidebar and open chat overlay
    if (window.innerWidth < 1150) {
      setLeftSidebarOpen(false);
      setRightSidebarOpen(false);
    }
  }, [dms, communities, openDirectMessage, setCurrentCommunityId, setCurrentChannelId, setIsDirectMessages, setActiveDmId]);

  // Handle sending message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending || !activeChatId) return;

    const content = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    try {
      if (activeChatType === 'dm') {
        await sendMessage(content);
      } else if (activeChatType === 'channel') {
        await sendMessage(content);
      }
    } catch (error) {
      addToast('Erro ao enviar', 'Não foi possível enviar a mensagem.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  // Handle typing indicator
  const handleTyping = (value: string) => {
    setNewMessage(value);
    // Typing indicator would be handled via AppContext setTypingStatus
  };

  // Handle selecting a community
  const handleSelectCommunity = (communityId: string) => {
    setCurrentCommunityId(communityId);
    const community = communities.find(c => c.id === communityId);
    const defaultChannel = community?.channels.find(c => c.type === 'text');
    if (defaultChannel) {
      setCurrentChannelId(defaultChannel.id);
    }
    setIsDirectMessages(false);
    setActiveDmId(null);
    setLeftSidebarOpen(false);
  };

  // Handle selecting a channel
  const handleSelectChannel = (channelId: string) => {
    handleOpenChat('channel', channelId);
  };

  // Handle selecting a DM
  const handleSelectDm = (dmId: string) => {
    handleOpenChat('dm', dmId);
  };

  // Format time for messages
  const formatMessageTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Agora';
      if (diffMins < 60) return `${diffMins}m`;
      if (diffHours < 24) return `${diffHours}h`;
      if (diffDays < 7) return `${diffDays}d`;
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    } catch {
      return '';
    }
  };

  // Format time for feed posts
  const formatFeedTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: ptBR });
    } catch {
      return '';
    }
  };

  // Get avatar initials
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get user avatar element
  const renderAvatar = (user: { avatar?: string; name?: string; handle?: string }, size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeClasses = {
      sm: 'w-8 h-8 text-xs',
      md: 'w-10 h-10 text-sm',
      lg: 'w-12 h-12 text-base',
    };

    if (user.avatar) {
      return (
        <img
          src={user.avatar}
          alt={user.name || user.handle || 'User'}
          className={`${sizeClasses[size]} rounded-full object-cover`}
        />
      );
    }

    return (
      <div className={`${sizeClasses[size]} rounded-full bg-primary-light text-primary font-bold flex items-center justify-center`}>
        {getInitials(user.name || user.handle || 'U')}
      </div>
    );
  };

  // Render status indicator
  const renderStatus = (status: string, size: 'sm' | 'md' = 'sm') => {
    const sizeClasses = { sm: 'w-2 h-2', md: 'w-3 h-3' };
    const statusColors = {
      online: 'bg-success',
      idle: 'bg-warning',
      dnd: 'bg-error',
      offline: 'bg-text-muted',
    };

    return (
      <span className={`${sizeClasses[size]} rounded-full ${statusColors[status as keyof typeof statusColors] || 'bg-text-muted'}`} />
    );
  };

  // Handle logout
  const handleLogout = () => {
    setLoggedIn(false);
    if (supabase) {
      void supabase.auth.signOut();
    }
  };

  interface FeedPost {
    id: string;
    type: 'message' | 'dm';
    community?: typeof communities[0];
    channel?: typeof communities[0]['channels'][0];
    dm?: typeof dms[0];
    message: typeof messages[string][0];
    timestamp: string;
  }

  // Create sample feed posts from communities and activity
  const generateFeedPosts = (): FeedPost[] => {
    const posts: FeedPost[] = [];

    // Add community posts
    communities.forEach(community => {
      community.channels
        .filter(c => c.type === 'text')
        .slice(0, 2)
        .forEach(channel => {
          const channelMessages = messages[channel.id] || [];
          channelMessages.slice(-3).forEach(msg => {
            if (msg.senderId !== currentUser.id) {
              posts.push({
                id: `post-${msg.id}`,
                type: 'message',
                community,
                channel,
                message: msg,
                timestamp: msg.timestamp,
              });
            }
          });
        });
    });

    // Add DM posts
    dms.forEach(dm => {
      const dmMessages = messages[dm.id] || [];
      dmMessages.slice(-2).forEach(msg => {
        if (msg.senderId !== currentUser.id) {
          posts.push({
            id: `post-dm-${msg.id}`,
            type: 'dm',
            dm,
            message: msg,
            timestamp: msg.timestamp,
          });
        }
      });
    });

    // Sort by timestamp descending
    return posts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 20);
  };

  const feedPosts = generateFeedPosts();

  // Handle notification click
  const handleNotificationClick = async (notification: typeof notifications[0]) => {
    await markNotificationRead(notification.id);
    // Navigate based on notification type
    const payload = notification.payload as Record<string, unknown>;
    if (payload.channel_id) {
      handleOpenChat('channel', payload.channel_id as string);
    }
  };

  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className={`dashboard-layout ${className}`}>
      {/* Left Sidebar */}
      <aside className={`dashboard-left-sidebar ${leftSidebarOpen ? 'open' : ''}`}>
        <div className="dashboard-left-header">
          <div className="dashboard-logo">
            <div className="dashboard-logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="dashboard-logo-text">Koaline</span>
          </div>
          <button
            className="dashboard-chat-back-btn"
            onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
            aria-label="Abrir painel direito"
          >
            <Users className="w-5 h-5" />
          </button>
        </div>

        <nav className="dashboard-left-nav" role="navigation" aria-label="Navegação principal">
          {/* Direct Messages */}
          <div className="dashboard-nav-section">
            <div className="dashboard-nav-section-title">Mensagens Diretas</div>
            <button
              className={`dashboard-nav-item ${activeChatType === 'dm' && activeChatId ? 'active' : ''}`}
              onClick={() => handleOpenChat('dm', 'new')}
              disabled={dms.length === 0}
            >
              <MessageSquare className="w-5 h-5" />
              <span>Nova conversa</span>
              <Plus className="w-4 h-4 ml-auto text-text-muted" />
            </button>
            {dms.filter(dm => !dm.isArchived).map(dm => (
              <button
                key={dm.id}
                className={`dashboard-nav-item ${activeChatType === 'dm' && activeChatId === dm.id ? 'active' : ''}`}
                onClick={() => handleSelectDm(dm.id)}
              >
                <div className="relative w-10 h-10 flex-shrink-0">
                  {renderAvatar(dm.user, 'sm')}
                  {dm.user.status !== 'offline' && (
                    <span className="absolute bottom-0 right-0">
                      {renderStatus(dm.user.status, 'sm')}
                    </span>
                  )}
                </div>
                <span className="truncate flex-1">{dm.user.name || dm.user.handle}</span>
                {dm.unread && (
                  <span className="dashboard-nav-item nav-badge">Novo</span>
                )}
              </button>
            ))}
            {dms.filter(dm => !dm.isArchived).length === 0 && (
              <div className="px-3 py-2 text-sm text-text-muted">Nenhuma conversa direta</div>
            )}
          </div>

          {/* Communities/Servers */}
          <div className="dashboard-nav-section">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="dashboard-nav-section-title">Comunidades</span>
              <button
                className="p-1 rounded-lg hover:bg-bg-hover text-text-muted transition-colors"
                onClick={() => {
                  const name = window.prompt('Nome da nova comunidade:');
                  if (name?.trim()) {
                    // This would call createCommunity from context
                    addToast('Funcionalidade', 'Criação de comunidade via botão +', 'info');
                  }
                }}
                aria-label="Criar comunidade"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {communities.map(community => (
              <button
                key={community.id}
                className={`dashboard-server-item ${currentCommunityId === community.id ? 'active' : ''}`}
                onClick={() => handleSelectCommunity(community.id)}
              >
                <div className="dashboard-server-avatar">
                  {community.icon && community.icon.startsWith('http') ? (
                    <img src={community.icon} alt={community.name} />
                  ) : (
                    community.icon || '◇'
                  )}
                </div>
                <span className="dashboard-server-name truncate">{community.name}</span>
                {currentCommunityId === community.id && (
                  <span className="w-2 h-2 rounded-full bg-primary" />
                )}
              </button>
            ))}
            {communities.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-text-muted">
                <p className="mb-2">Nenhuma comunidade ainda</p>
                <button
                  className="text-primary hover:underline text-sm"
                  onClick={() => {
                    const name = window.prompt('Nome da nova comunidade:');
                    if (name?.trim()) {
                      addToast('Comunidade', 'Use o botão + para criar', 'info');
                    }
                  }}
                >
                  Criar a primeira
                </button>
              </div>
            )}
          </div>
        </nav>

        {/* User Profile Footer */}
        <div className="dashboard-left-footer">
          <div className="dashboard-user-profile">
            <div className="dashboard-user-avatar">
              {currentUser.avatar ? (
                <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
              ) : (
                <div className="dashboard-user-avatar-fallback">
                  {getInitials(currentUser.name || currentUser.handle || 'U')}
                </div>
              )}
            </div>
            <div className="dashboard-user-info">
              <div className="dashboard-user-name truncate">{currentUser.name}</div>
              <div className="dashboard-user-status">
                <span className="dashboard-user-status-dot online" />
                <span>Disponível</span>
              </div>
            </div>
            <button
              className="p-1 rounded-lg hover:bg-surface text-text-muted transition-colors ml-auto"
              onClick={() => setIsProfileEditorOpen(true)}
              aria-label="Configurações do perfil"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Left Sidebar Overlay */}
      {leftSidebarOpen && window.innerWidth < 1150 && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setLeftSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Center Feed */}
      <main className="dashboard-center-feed" ref={feedRef}>
        <header className="dashboard-feed-header">
          <h1 className="dashboard-feed-title">
            {isDirectMessages ? 'Mensagens Diretas' : currentCommunity?.name || 'Início'}
          </h1>
          <div className="dashboard-feed-actions">
            <div className="dashboard-feed-search">
              <Search className="w-5 h-5" />
              <input
                type="search"
                placeholder="Buscar mensagens, pessoas..."
                className="w-full"
                aria-label="Buscar"
              />
            </div>
            <button
              className="p-2 rounded-full hover:bg-bg-hover text-text-muted transition-colors"
              onClick={() => setRightSidebarOpen(true)}
              aria-label="Abrir notificações"
            >
              <Bell className="w-5 h-5" />
            </button>
            <button
              className="p-2 rounded-full hover:bg-bg-hover text-text-muted transition-colors lg:hidden"
              onClick={() => setLeftSidebarOpen(true)}
              aria-label="Abrir menu lateral"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="dashboard-feed-content">
          {/* Welcome/Empty State */}
          {feedPosts.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 text-text-muted">
              <div className="w-16 h-16 rounded-2xl border border-border bg-bg-hover flex items-center justify-center text-2xl mb-4">
                <MessageSquare className="w-8 h-8 mx-auto" />
              </div>
              <h2 className="text-xl font-semibold text-text-main mb-2">Bem-vindo ao Koaline</h2>
              <p className="text-sm max-w-xs">
                Suas conversas e atividade das comunidades aparecerão aqui.
                Selecione uma comunidade ou inicie uma conversa direta para começar.
              </p>
            </div>
          )}

          {/* Feed Posts */}
          <div className="space-y-4">
            {feedPosts.map(post => (
              <article key={post.id} className="dashboard-post">
                <div className="dashboard-post-header">
                  <div className="dashboard-post-avatar">
                    {post.message.sender.avatar ? (
                      <img src={post.message.sender.avatar} alt={post.message.sender.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="dashboard-post-avatar-fallback">
                        {getInitials(post.message.sender.name || post.message.sender.handle || 'U')}
                      </div>
                    )}
                  </div>
                  <div className="dashboard-post-author-info">
                    <div className="dashboard-post-author-name">{post.message.sender.name}</div>
                    <div className="dashboard-post-meta">
                      <span>{post.type === 'dm' ? 'Mensagem direta' : `#${post.channel?.name} em ${post.community?.name}`}</span>
                      <span>·</span>
                      <time>{formatFeedTime(post.timestamp)}</time>
                    </div>
                  </div>
                  <button
                    className="p-1 rounded-lg hover:bg-bg-hover text-text-muted transition-colors ml-auto"
                    aria-label="Mais opções"
                  >
                    <EllipsisVertical className="w-5 h-5" />
                  </button>
                </div>
                <div className="dashboard-post-content">{post.message.content}</div>
                <div className="dashboard-post-actions">
                  <button className="dashboard-post-action" aria-label="Responder">
                    <Share2 className="w-4 h-4" />
                  </button>
                  <button className="dashboard-post-action" aria-label="Reagir">
                    <Heart className="w-4 h-4" />
                  </button>
                  <button className="dashboard-post-action" aria-label="Compartilhar">
                    <Repeat className="w-4 h-4" />
                  </button>
                  <button className="dashboard-post-action" aria-label="Salvar">
                    <Bookmark className="w-4 h-4" />
                  </button>
                  <button className="dashboard-post-action" aria-label="Denunciar">
                    <Flag className="w-4 h-4" />
                  </button>
                </div>
              </article>
            ))}

            {feedPosts.length === 0 && communities.length > 0 && (
              <div className="text-center py-8 text-text-muted">
                <p className="text-sm">Nenhuma atividade recente</p>
                <p className="text-xs mt-1">As mensagens das comunidades aparecerão aqui</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Right Sidebar */}
      <aside className={`dashboard-right-sidebar ${rightSidebarOpen ? 'open' : ''}`}>
        <div className="dashboard-right-header">
          <h2 className="dashboard-right-title">Notificações</h2>
          <button
            className="dashboard-chat-back-btn"
            onClick={() => setRightSidebarOpen(false)}
            aria-label="Fechar painel direito"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="dashboard-right-content">
          {/* Notifications */}
          <div className="dashboard-right-section">
            <div className="dashboard-right-section-title">
              <span>Recentes</span>
              {notifications.filter(n => !n.read_at).length > 0 && (
                <small>{notifications.filter(n => !n.read_at).length} não lidas</small>
              )}
            </div>
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-text-muted">
                Nenhuma notificação
              </div>
            ) : (
              notifications.slice(0, 20).map(notification => {
                const payload = notification.payload as Record<string, unknown>;
                const senderName = (payload.sender_name as string) || 'Alguém';
                const senderAvatar = payload.sender_avatar as string | undefined;

                return (
                  <button
                    key={notification.id}
                    className={`dashboard-notification-item ${!notification.read_at ? 'unread' : ''}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="dashboard-notification-avatar">
                      {senderAvatar ? (
                        <img src={senderAvatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="dashboard-notification-avatar-fallback">
                          {getInitials(senderName || 'U')}
                        </div>
                      )}
                    </div>
                    <div className="dashboard-notification-content">
                      <div className="dashboard-notification-text">
                        <strong>{senderName}</strong>{' '}
                        {notification.type === 'mention' ? 'mencionou você' : 'enviou uma mensagem'}
                      </div>
                      <div className="dashboard-notification-time">
                        {formatFeedTime(notification.created_at)}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
            {notifications.length > 20 && (
              <div className="px-4 py-2 text-center">
                <button className="text-sm text-primary hover:underline">Ver todas as notificações</button>
              </div>
            )}
          </div>

          {/* Friend Requests */}
          <div className="dashboard-right-section">
            <div className="dashboard-right-section-title">
              <span>Solicitações de amizade</span>
              <small>0 pendentes</small>
            </div>
            <div className="px-4 py-4 text-center text-sm text-text-muted">
              Nenhuma solicitação de amizade pendente
            </div>
          </div>

          {/* Suggestions */}
          <div className="dashboard-right-section">
            <div className="dashboard-right-section-title">
              <span>Sugestões para você</span>
              <small>Baseado em comunidades em comum</small>
            </div>
            <div className="px-4 py-4 text-center text-sm text-text-muted">
              Nenhuma sugestão no momento
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Right Sidebar Overlay */}
      {rightSidebarOpen && window.innerWidth < 1150 && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setRightSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Chat Overlay - Full Screen on Mobile, or always shown when active */}
      {(activeChatId && (window.innerWidth < 1150 || true)) && (
        <div className="dashboard-chat-overlay" role="dialog" aria-modal="true" aria-label="Conversa">
          <header className="dashboard-chat-header">
            <div className="dashboard-chat-header-left">
              <button
                className="dashboard-chat-back-btn"
                onClick={() => {
                  setActiveChatId(null);
                  setActiveChatType(null);
                }}
                aria-label="Voltar"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              {activeChatType === 'dm' && activeDm && (
                <div className="dashboard-chat-partner">
                  <div className="dashboard-chat-avatar">
                    {activeDm.user.avatar ? (
                      <img src={activeDm.user.avatar} alt={activeDm.user.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="dashboard-chat-avatar-fallback">
                        {getInitials(activeDm.user.name || activeDm.user.handle || 'U')}
                      </div>
                    )}
                    {activeDm.user.status !== 'offline' && (
                      <span className={`dashboard-chat-status ${activeDm.user.status}`} />
                    )}
                  </div>
                  <div>
                    <div className="dashboard-chat-partner-name">{activeDm.user.name}</div>
                    <div className="dashboard-chat-partner-status">
                      {activeDm.user.status === 'online' ? 'Online' :
                       activeDm.user.status === 'idle' ? 'Ausente' :
                       activeDm.user.status === 'dnd' ? 'Não perturbe' : 'Offline'}
                    </div>
                  </div>
                </div>
              )}
              {activeChatType === 'channel' && currentChannel && (
                <div className="dashboard-chat-partner">
                  <div className="dashboard-chat-avatar">
                    <div className="dashboard-chat-avatar-fallback w-full h-full">
                      {currentChannel.type === 'voice' ? '🔊' : '#'}
                    </div>
                  </div>
                  <div>
                    <div className="dashboard-chat-partner-name">#{currentChannel.name}</div>
                    <div className="dashboard-chat-partner-status">
                      {currentCommunity?.name}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="dashboard-chat-header-right">
              <button className="dashboard-chat-icon-btn" aria-label="Chamada de voz">
                <Mic className="w-5 h-5" />
              </button>
              <button className="dashboard-chat-icon-btn" aria-label="Chamada de vídeo">
                <Users className="w-5 h-5" />
              </button>
              <button className="dashboard-chat-icon-btn" aria-label="Mais opções">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>
          </header>

          <div className="dashboard-chat-messages" role="log" aria-live="polite" aria-label="Mensagens">
            {activeMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 text-text-muted">
                <div className="w-16 h-16 rounded-2xl border border-border bg-bg-hover flex items-center justify-center text-2xl mb-4">
                  <MessageSquare className="w-8 h-8 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-text-main mb-1">
                  {activeChatType === 'dm' ? 'Inicie a conversa' : 'Nenhuma mensagem ainda'}
                </h3>
                <p className="text-sm">
                  {activeChatType === 'dm'
                    ? 'Seja o primeiro a enviar uma mensagem'
                    : 'Seja o primeiro a falar neste canal'}
                </p>
              </div>
            ) : (
              <>
                {activeMessages.map((msg, index) => {
                  const isOwn = msg.senderId === currentUser.id;
                  const showAvatar = !isOwn && (index === 0 || activeMessages[index - 1].senderId !== msg.senderId);
                  const showName = !isOwn && (index === 0 || activeMessages[index - 1].senderId !== msg.senderId);
                  const showTime = index === activeMessages.length - 1 || activeMessages[index + 1]?.senderId !== msg.senderId;

                  return (
                    <div
                      key={msg.id}
                      className={`dashboard-chat-message ${isOwn ? 'own' : ''}`}
                    >
                      {showAvatar && (
                        <div className="dashboard-chat-message-avatar">
                          {msg.sender.avatar ? (
                            <img src={msg.sender.avatar} alt={msg.sender.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="dashboard-chat-message-avatar-fallback">
                              {getInitials(msg.sender.name || msg.sender.handle || 'U')}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="dashboard-chat-message-content">
                        {showName && !isOwn && (
                          <div className="dashboard-chat-message-header">
                            <span className="dashboard-chat-message-author">{msg.sender.name}</span>
                            <span className="dashboard-chat-message-time">{formatMessageTime(msg.timestamp)}</span>
                          </div>
                        )}
                        <div className="dashboard-chat-message-bubble">
                          <div className="dashboard-chat-message-text">{msg.content}</div>
                        </div>
                        {showTime && (
                          <div className="dashboard-chat-message-header" style={{ justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
                            <span className="dashboard-chat-message-time">{formatMessageTime(msg.timestamp)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          <form className="dashboard-chat-input-container" onSubmit={handleSendMessage}>
            <div className="dashboard-chat-input-wrapper">
              <div className="dashboard-chat-input-actions">
                <button type="button" className="dashboard-chat-input-btn" aria-label="Anexar arquivo">
                  <Paperclip className="w-5 h-5" />
                </button>
                <button type="button" className="dashboard-chat-input-btn" aria-label="Emojis">
                  <Smile className="w-5 h-5" />
                </button>
                <button type="button" className="dashboard-chat-input-btn" aria-label="Gravar áudio">
                  <Mic className="w-5 h-5" />
                </button>
              </div>
              <textarea
                className="dashboard-chat-input"
                placeholder="Mensagem..."
                value={newMessage}
                onChange={(e) => handleTyping(e.target.value)}
                rows={1}
                aria-label="Digite sua mensagem"
                disabled={isSending}
              />
              <button
                type="submit"
                className="dashboard-chat-input-send"
                disabled={!newMessage.trim() || isSending}
                aria-label="Enviar mensagem"
              >
                {isSending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* User Context Menu */}
      {activeUserMenu && (
        <div
          className="fixed z-50 glass-panel shadow-lg rounded-xl p-2 min-w-[200px] max-w-[280px]"
          style={{
            left: activeUserMenu.position.x,
            top: activeUserMenu.position.y,
          }}
          role="menu"
        >
          <button
            className="w-full px-3 py-2 rounded-lg text-left hover:bg-bg-hover flex items-center gap-2 text-sm"
            onClick={() => {
              openUserProfile(activeUserMenu.user);
              closeUserMenu();
            }}
            role="menuitem"
          >
            <User className="w-4 h-4" />
            Ver perfil
          </button>
          <button
            className="w-full px-3 py-2 rounded-lg text-left hover:bg-bg-hover flex items-center gap-2 text-sm"
            onClick={() => {
              openDirectMessage(activeUserMenu.user);
              closeUserMenu();
            }}
            role="menuitem"
          >
            <MessageSquare className="w-4 h-4" />
            Mensagem direta
          </button>
          <hr className="my-1 border-border" />
          <button
            className="w-full px-3 py-2 rounded-lg text-left hover:bg-bg-hover flex items-center gap-2 text-sm text-error"
            onClick={closeUserMenu}
            role="menuitem"
          >
            <Flag className="w-4 h-4" />
            Denunciar
          </button>
        </div>
      )}
    </div>
  );
};

export default DashboardLayout;