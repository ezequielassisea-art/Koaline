import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { CallDock } from '../call/CallDock';
import {
  Bell,
  X,
  ChevronDown,
  Search,
  UserPlus,
  MessageSquare,
  AtSign,
} from 'lucide-react';
import { parseAppDate } from '../../utils/time';
import { audioManager } from '../../services/AudioManager';
import { supabase } from '../../services/supabaseClient';
import { InviteModal } from '../admin/InviteModal';
import { Button } from '@/components/ui/button';

type AppNotification = {
  id: string;
  user_id: string;
  actor_id: string;
  type: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

type CommunityInviteNotification = {
  id: string;
  actor_id: string;
  user_id: string;
  type: string;
  payload: {
    community_id: string;
    community_name: string;
    inviter_id: string;
    inviter_name: string;
    custom_message: string;
    community_icon?: string;
    community_banner?: string;
  };
  read_at: string | null;
  created_at: string
};

export const TopBar: React.FC<{ className?: string }> = ({ className = '' }) => {
  const {
    currentUser,
    communities,
    dms,
    messages,
    lastReadAtByChannel,
    markNotificationsRead,
    currentCommunityId,
    setCurrentCommunityId,
    setCurrentChannelId,
    isDirectMessages,
    setIsDirectMessages,
    openUserProfile,
    setIsProfileEditorOpen,
    setIsLoggedIn,
    addToast,
    openDirectMessage,
    notifications,
    markNotificationRead,
    deleteNotification,
    clearAllNotifications,
    leaveCommunity,
    isLeftSidebarOpen,
    setIsLeftSidebarOpen,
    currentChannelId,
    activeDmId,
  } = useApp();

  const [isCommunityDropdownOpen, setIsCommunityDropdownOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [openingNotificationId, setOpeningNotificationId] = useState<string | null>(null);
  const [inviteModal, setInviteModal] = useState<CommunityInviteNotification | null>(null);
  const [audioPreferences, setAudioPreferences] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('koaline:audio-settings') || '{}');
      return { volume: Math.max(0, Math.min(1, Number(saved.volume ?? 0.55))), muted: Boolean(saved.muted) };
    } catch { return { volume: 0.55, muted: false }; }
  });
  const updateAudioPreferences = (next: { volume: number; muted: boolean }) => {
    setAudioPreferences(next);
    audioManager.setPreferences(next.volume, next.muted);
  };

  const [searchQuery, setSearchQuery] = useState('');

  const commDropdownRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const activeCommunity = communities.find((c) => c.id === currentCommunityId) || communities[0];
  const activeChannel = activeCommunity?.channels?.find((c) => c.id === currentChannelId);

  const unreadDirectMessages = dms.filter((dm) => dm.unread && !dm.isArchived).length;
  const inviteNotifications = notifications.filter((notification) => notification.type === 'community_invite');
  const dmMessageNotifications = notifications.filter((notification) => notification.type === 'dm_message' && !notification.read_at);
  const mentionNotifications = notifications.filter((notification) => notification.type === 'mention' && !notification.read_at);
  const channelMessageNotifications = notifications.filter((notification) => notification.type === 'channel_message' && !notification.read_at);
  const unreadMentions = Object.entries(messages).reduce((count, [channelId, channelMessages]) => {
    const lastReadAt = lastReadAtByChannel[channelId];
    const normalizedHandle = currentUser.handle.replace(/^@/, '').split('#')[0].toLowerCase();
    return count + channelMessages.filter((message) => {
      if (message.senderId === currentUser.id) return false;
      if (lastReadAt && parseAppDate(message.timestamp).getTime() <= parseAppDate(lastReadAt).getTime()) return false;
      const content = (message.content || '').toLowerCase();
      let mentionIndex = normalizedHandle ? content.indexOf(`@${normalizedHandle}`) : -1;
      let mentionsUser = false;
      while (mentionIndex >= 0) {
        const nextCharacter = content[mentionIndex + normalizedHandle.length + 1];
        if (!nextCharacter || !/[a-z0-9_]/i.test(nextCharacter)) { mentionsUser = true; break; }
        mentionIndex = content.indexOf(`@${normalizedHandle}`, mentionIndex + 1);
      }
      return mentionsUser || /@(?:everyone|all)\b/i.test(content);
    }).length;
  }, 0);
  const notificationCount = unreadDirectMessages + unreadMentions + inviteNotifications.filter((item) => !item.read_at).length + dmMessageNotifications.length + mentionNotifications.length + channelMessageNotifications.length;

  const openInviteNotification = async (notification: AppNotification) => {
    const client = supabase;
    if (!client || openingNotificationId) return;
    setOpeningNotificationId(notification.id);
    try {
      console.log("PAYLOAD DO CONVITE:", notification.payload);

      const payload = notification.payload as Record<string, unknown> | undefined;
      if (!payload || typeof payload.community_id !== 'string') {
        throw new Error('Payload do convite inválido ou ausente');
      }

      const inviterId = notification.actor_id || (typeof payload.inviter_id === 'string' ? payload.inviter_id : '');
      if (inviterId) {
        const { data: profile, error } = await client.from('profiles').select('id,username,full_name,avatar_url').eq('id', inviterId).maybeSingle();
        if (error) {
          console.error("ERRO AO BUSCAR PERFIL DO CONVIDADOR:", error);
        }
      }

      const inviteNotification: CommunityInviteNotification = {
        ...notification,
        actor_id: inviterId,
      } as CommunityInviteNotification;

      setInviteModal(inviteNotification);
      setIsNotificationsOpen(false);
    } catch (error) {
      console.error("ERRO AO ABRIR CONVITE:", error);
      addToast('Convite não aberto', error instanceof Error ? error.message : 'Tente novamente.', 'error');
    } finally { setOpeningNotificationId(null); }
  };

  const handleNotificationClick = async (notification: AppNotification) => {
    const payload = notification.payload as Record<string, unknown> | undefined;

    if (!notification.read_at) {
      await markNotificationRead(notification.id);
    }

    try {
      let targetMessageId: string | null = null;
      let targetChannelId: string | null = null;

      switch (notification.type) {
        case 'channel_message': {
          if (payload?.channel_id) {
            targetChannelId = String(payload.channel_id);
            targetMessageId = payload?.message_id as string | null;
            const targetCommunity = communities.find((c) => c.channels.some((ch) => ch.id === targetChannelId));
            if (targetCommunity) {
              setCurrentCommunityId(targetCommunity.id);
              setCurrentChannelId(targetChannelId);
              setIsDirectMessages(false);
            }
          }
          break;
        }
        case 'dm_message': {
          if (payload?.conversation_id) {
            targetChannelId = String(payload.conversation_id);
            targetMessageId = payload?.message_id as string | null;
            const dm = dms.find((d) => d.id === targetChannelId);
            if (dm) {
              await openDirectMessage(dm.user);
            }
          }
          break;
        }
        case 'community_invite': {
          await openInviteNotification(notification);
          return;
        }
        case 'mention': {
          if (payload?.channel_id) {
            targetChannelId = String(payload.channel_id);
            targetMessageId = payload?.message_id as string | null;
            const targetCommunity = communities.find((c) => c.channels.some((ch) => ch.id === targetChannelId));
            if (targetCommunity) {
              setCurrentCommunityId(targetCommunity.id);
              setCurrentChannelId(targetChannelId);
              setIsDirectMessages(false);
            }
          }
          break;
        }
      }

      if (targetMessageId && targetChannelId) {
        setTimeout(() => {
          const messageElement = document.getElementById(`message-${targetMessageId}`);
          if (messageElement) {
            messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            messageElement.classList.add('highlight-message');
            setTimeout(() => {
              messageElement.classList.remove('highlight-message');
            }, 2000);
          }
        }, 500);
      }
    } catch (error) {
      console.error('Erro ao redirecionar notificação:', error);
    }

    if (notification.type !== 'community_invite') {
      setIsNotificationsOpen(false);
    }
  };

  const handleDeleteNotification = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    await deleteNotification(notificationId);
  };

  const handleClearAllNotifications = async () => {
    await clearAllNotifications();
    setIsNotificationsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (commDropdownRef.current && !commDropdownRef.current.contains(e.target as Node)) {
        setIsCommunityDropdownOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Build section name: Community > Channel or DM name
  const getSectionName = () => {
    if (isDirectMessages) {
      if (activeDmId && dms.length > 0) {
        const dm = dms.find(d => d.id === activeDmId);
        return dm?.user?.name || 'Mensagens Diretas';
      }
      return 'Mensagens Diretas';
    }
    if (!activeCommunity) return 'Koaline';
    if (activeChannel) {
      return `${activeCommunity.name} / #${activeChannel.name}`;
    }
    return activeCommunity.name;
  };

  const sectionName = getSectionName();

  return (
    <header className={`h-14 px-3 md:px-4 bg-white border-b border-gray-100 flex items-center justify-between sticky top-0 z-30 ${className}`}>
      {/* LEFT: Section/Channel Name */}
      <div className="flex items-center justify-start min-w-0 pr-4">
        <span className="text-sm font-semibold text-gray-900 truncate max-w-xs md:max-w-md lg:max-w-lg">
          {sectionName}
        </span>
      </div>

      {/* CENTER: Unified Search Bar */}
      <div className="flex-1 flex items-center justify-center px-4 md:px-8 max-w-2xl">
        <div className="relative w-full max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden="true" />
          <input
            type="text"
            placeholder="Buscar mensagens, amigos, grupos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-100 border-0 rounded-full px-10 py-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#00BFFF]/20 transition-all"
            aria-label="Buscar mensagens, amigos e grupos"
          />
          {searchQuery && (
            <Button
              onClick={() => setSearchQuery('')}
              variant="ghost"
              size="icon"
              className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8"
              aria-label="Limpar pesquisa"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* RIGHT: Notifications */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Notifications */}
        <div className="relative" ref={notificationsRef}>
        <Button
          onClick={() => { setIsNotificationsOpen((value) => !value); markNotificationsRead(); }}
          title={notificationCount ? `${notificationCount} notificações não lidas` : 'Nenhuma notificação não lida'}
          aria-label={notificationCount ? `${notificationCount} notificações não lidas` : 'Nenhuma notificação não lida'}
          variant="ghost"
          size="icon"
          className={`h-9 w-9 relative transition-colors ${notificationCount ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <Bell className="w-4 h-4" />
          {notificationCount > 0 && <span className="notification-badge bg-[#00BFFF] text-white" aria-hidden="true">{notificationCount}</span>}
        </Button>
        {isNotificationsOpen && (() => {
            const relevantNotifications = [...inviteNotifications, ...notifications.filter(n => n.type === 'dm_message' || n.type === 'mention' || n.type === 'channel_message')]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            const groupedNotifications = new Map<string, AppNotification[]>();
            relevantNotifications.forEach((notification) => {
              const key = `${notification.actor_id}:${notification.type}`;
              if (!groupedNotifications.has(key)) {
                groupedNotifications.set(key, []);
              }
              groupedNotifications.get(key)!.push(notification);
            });

            const renderNotificationGroup = (group: AppNotification[]) => {
              const first = group[0];
              const payload = first.payload as Record<string, unknown> | undefined;
              const isUnread = group.some(n => !n.read_at);
              const latestDate = group.reduce((latest, n) => new Date(n.created_at) > new Date(latest) ? n.created_at : latest, first.created_at);

              const baseClasses = 'w-full border-b border-gray-100 px-4 py-3 text-left transition-colors relative group';
              const unreadBg = isUnread ? 'bg-[#00BFFF]/5' : 'bg-white';
              const unreadIndicator = isUnread ? <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#00BFFF]" aria-hidden="true" /> : null;
              const count = group.length > 1 ? <span className="ml-2 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-500">{group.length}</span> : null;

              if (first.type === 'community_invite') {
                const inviterName = typeof payload?.inviter_name === 'string' ? payload.inviter_name : '@membro';
                const communityName = typeof payload?.community_name === 'string' ? payload.community_name : 'uma comunidade';
                return (
                  <div key={`${first.actor_id}:community_invite`} className={`${baseClasses} ${unreadBg} hover:bg-gray-50`}>
                    {unreadIndicator}
                    <button onClick={() => handleNotificationClick(first)} className="w-full text-left flex items-center justify-between">
                      <span className="block text-sm text-gray-900">{inviterName} te convidou para {communityName}</span>
                      {count}
                    </button>
                    <Button onClick={(e) => { e.stopPropagation(); group.forEach(n => deleteNotification(n.id)); }} variant="ghost" size="icon" className="h-6 w-6 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100" aria-label="Excluir notificações"><X className="w-3.5 h-3.5" /></Button>
                  </div>
                );
              }
              if (first.type === 'dm_message') {
                const senderName = typeof payload?.sender_name === 'string' ? payload.sender_name : 'Alguém';
                const messagePreview = typeof payload?.message === 'string' ? payload.message.slice(0, 50) : 'Nova mensagem';
                return (
                  <div key={`${first.actor_id}:dm_message`} className={`${baseClasses} ${unreadBg} hover:bg-gray-50`}>
                    {unreadIndicator}
                    <button onClick={() => handleNotificationClick(first)} className="w-full text-left flex items-center justify-between">
                      <span className="block text-sm text-gray-900 flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5 text-[#00BFFF]" /> {senderName}</span>
                      {count}
                    </button>
                    <span className="mt-1 block text-xs text-gray-500 truncate">{messagePreview}</span>
                    <span className="mt-1 block text-[10px] text-gray-400">{new Date(latestDate).toLocaleString('pt-BR')}</span>
                    <Button onClick={(e) => { e.stopPropagation(); group.forEach(n => deleteNotification(n.id)); }} variant="ghost" size="icon" className="h-6 w-6 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100" aria-label="Excluir notificações"><X className="w-3.5 h-3.5" /></Button>
                  </div>
                );
              }
              if (first.type === 'mention') {
                const channelName = typeof payload?.channel_name === 'string' ? payload.channel_name : 'canal';
                const mentionType = typeof payload?.mention_type === 'string' ? payload.mention_type : 'user';
                const messagePreview = typeof payload?.message === 'string' ? payload.message.slice(0, 50) : 'Menção';
                const icon = mentionType === 'todos' ? <span className="text-amber-400">@todos</span> : <span className="text-[#00BFFF]">@{typeof payload?.mentioned_handle === 'string' ? payload.mentioned_handle : 'usuário'}</span>;
                return (
                  <div key={`${first.actor_id}:mention`} className={`${baseClasses} ${unreadBg} hover:bg-gray-50`}>
                    {unreadIndicator}
                    <button onClick={() => handleNotificationClick(first)} className="w-full text-left flex items-center justify-between">
                      <span className="block text-sm text-gray-900 flex items-center gap-1.5"><AtSign className="w-3.5 h-3.5 text-[#00BFFF]" /> Menção em #{channelName} {icon}</span>
                      {count}
                    </button>
                    <span className="mt-1 block text-xs text-gray-500 truncate">{messagePreview}</span>
                    <span className="mt-1 block text-[10px] text-gray-400">{new Date(latestDate).toLocaleString('pt-BR')}</span>
                    <Button onClick={(e) => { e.stopPropagation(); group.forEach(n => deleteNotification(n.id)); }} variant="ghost" size="icon" className="h-6 w-6 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100" aria-label="Excluir notificações"><X className="w-3.5 h-3.5" /></Button>
                  </div>
                );
              }
              if (first.type === 'channel_message') {
                const channelName = typeof payload?.channel_name === 'string' ? payload.channel_name : 'canal';
                const senderName = typeof payload?.sender_name === 'string' ? payload.sender_name : 'Alguém';
                const messagePreview = typeof payload?.message === 'string' ? payload.message.slice(0, 50) : 'Nova mensagem';
                return (
                  <div key={`${first.actor_id}:channel_message`} className={`${baseClasses} ${unreadBg} hover:bg-gray-50`}>
                    {unreadIndicator}
                    <button onClick={() => handleNotificationClick(first)} className="w-full text-left flex items-center justify-between">
                      <span className="block text-sm text-gray-900 flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5 text-emerald-500" /> {senderName} em #{channelName}</span>
                      {count}
                    </button>
                    <span className="mt-1 block text-xs text-gray-500 truncate">{messagePreview}</span>
                    <span className="mt-1 block text-[10px] text-gray-400">{new Date(latestDate).toLocaleString('pt-BR')}</span>
                    <Button onClick={(e) => { e.stopPropagation(); group.forEach(n => deleteNotification(n.id)); }} variant="ghost" size="icon" className="h-6 w-6 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100" aria-label="Excluir notificações"><X className="w-3.5 h-3.5" /></Button>
                  </div>
                );
              }
              return null;
            };

            return (
              <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-gray-200 bg-white shadow-2xl flex flex-col overflow-hidden">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 flex-shrink-0">
                  <strong className="text-sm text-gray-900">Notificações</strong>
                  <Button onClick={() => setIsNotificationsOpen(false)} aria-label="Fechar notificações" variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></Button>
                </div>
                <div className="flex-1 max-h-80 overflow-y-auto">
                  {relevantNotifications.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500">Nenhuma notificação por enquanto.</p>
                  ) : (
                    Array.from(groupedNotifications.values()).map(renderNotificationGroup)
                  )}
                </div>
                <div className="border-t border-gray-100 p-3 flex-shrink-0">
                  <Button onClick={handleClearAllNotifications} variant="ghost" size="sm" className="w-full py-2 text-sm font-medium text-rose-500 hover:text-rose-600 transition-colors rounded-sm hover:bg-rose-50">
                    Limpar todas
                  </Button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
      <InviteModal
        isOpen={!!inviteModal}
        onClose={() => setInviteModal(null)}
        invite={inviteModal}
      />
    </header>
  );
};
