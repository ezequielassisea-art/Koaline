import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { CallDock } from '../call/CallDock';
import {
  Bell,
  X,
  ChevronDown,
  Moon,
  Sun,
  User,
  Settings,
  LogOut,
  Sparkles,
  MessageSquare,


  Volume2,
  VolumeX,
} from 'lucide-react';
import { parseAppDate } from '../../utils/time';
import { audioManager } from '../../services/AudioManager';
import { supabase } from '../../services/supabaseClient';
import { InviteModal } from '../admin/InviteModal';

type AppNotification = {
  id: string;
  user_id: string;
  sender_id: string;
  type: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

type CommunityInviteNotification = {
  id: string;
  sender_id: string;
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

export const TopBar: React.FC = () => {
  const {
    currentUser,
    communities,
    dms,
    messages,
    lastReadAtByChannel,
    markNotificationsRead,
    currentCommunityId,
    setCurrentCommunityId,
    isDirectMessages,
    setIsDirectMessages,
    theme,
    updateTheme,
    openUserProfile,
    setIsThemeCustomizerOpen,
    setIsProfileEditorOpen,
    setIsLoggedIn,
    addToast,
    openDirectMessage,
    notifications,
    markNotificationRead,
  } = useApp();

const [isCommunityDropdownOpen, setIsCommunityDropdownOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
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

  const commDropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const activeCommunity = communities.find((c) => c.id === currentCommunityId) || communities[0];
  const unreadDirectMessages = dms.filter((dm) => dm.unread && !dm.isArchived).length;
  const inviteNotifications = notifications.filter((notification) => notification.type === 'community_invite');
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
  const notificationCount = unreadDirectMessages + unreadMentions + inviteNotifications.filter((item) => !item.read_at).length;

  const openInviteNotification = async (notification: AppNotification) => {
    const client = supabase;
    if (!client || openingNotificationId) return;
    setOpeningNotificationId(notification.id);
    try {
      const { data: profile, error } = await client.from('profiles').select('id,username,full_name,avatar_url').eq('id', notification.sender_id).maybeSingle();
      if (error) throw error;
      // Set the invite modal data - cast to CommunityInviteNotification since we know it's a community_invite type
      setInviteModal(notification as CommunityInviteNotification);
      setIsNotificationsOpen(false);
    } catch (error) {
      addToast('Convite não aberto', error instanceof Error ? error.message : 'Tente novamente.', 'error');
    } finally { setOpeningNotificationId(null); }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (commDropdownRef.current && !commDropdownRef.current.contains(e.target as Node)) {
        setIsCommunityDropdownOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDarkMode = () => {
    if (theme.mode === 'light') {
      updateTheme({ mode: 'dark' });
      addToast('Tema Escuro', 'Modo escuro ativado.');
    } else {
      updateTheme({ mode: 'light' });
      addToast('Tema Claro', 'Modo claro ativado.');
    }
  };

  return (
    <header className="h-16 px-4 md:px-6 bg-slate-900 border-b border-border flex items-center justify-between sticky top-0 z-30 transition-colors">
      {/* LEFT: Wordmark + Community Selector Pill */}
      <div className="flex items-center gap-3 sm:gap-4">




        {/* Community Selector Pill */}
        <div className="relative" ref={commDropdownRef}>
          <button
            onClick={() => setIsCommunityDropdownOpen(!isCommunityDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-nest-pill bg-slate-800 hover:bg-slate-700 border border-border text-sm font-medium transition-all active:scale-95 max-w-[200px]"
          >
            {isDirectMessages ? <MessageSquare className="w-4 h-4 text-indigo-300" /> : activeCommunity?.icon?.startsWith('data:image/') ? <img src={activeCommunity.icon} alt="" className="w-5 h-5 rounded-md object-cover" /> : <span className="text-base">{activeCommunity?.icon || '◇'}</span>}
            <span className="truncate text-slate-100 font-semibold text-xs sm:text-sm">
              {isDirectMessages ? 'Mensagens Diretas' : activeCommunity?.name || 'Comunidades'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          </button>

          {isCommunityDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-64 p-2 rounded-nest-sm bg-slate-900 border border-slate-700 shadow-2xl z-40 animate-in fade-in zoom-in-95">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
                Servidores & Espaços
              </div>

              {communities.map((comm) => (
                <button
                  key={comm.id}
                  onClick={() => {
                    setCurrentCommunityId(comm.id);
                    setIsDirectMessages(false);
                    setIsCommunityDropdownOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-nest-sm text-left text-xs font-medium transition-colors ${
                    !isDirectMessages && comm.id === currentCommunityId
                      ? 'bg-indigo-600/20 text-indigo-400 font-semibold'
                      : 'hover:bg-slate-800 text-slate-200'
                  }`}
                >
                  {comm.icon.startsWith('data:image/') ? <img src={comm.icon} alt="" className="w-7 h-7 rounded-md object-cover" /> : <span className="text-lg">{comm.icon}</span>}
                  <div className="truncate flex-1">
                    <div className="truncate">{comm.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{comm.membersCount} membros</div>
                  </div>
                </button>
              ))}

              <div className="my-1.5 border-t border-slate-800" />

              <button
                onClick={() => {
                  setIsDirectMessages(true);
                  setIsCommunityDropdownOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-nest-sm text-left text-xs font-medium transition-colors ${
                  isDirectMessages
                    ? 'bg-sky-500/20 text-sky-400 font-semibold'
                    : 'hover:bg-slate-800 text-slate-200'
                }`}
              >
                <MessageSquare className="w-4 h-4 text-sky-400" />
                <div className="truncate flex-1">
                  <div>Mensagens Diretas</div>
                  <div className="text-[10px] text-slate-400">Conversas privadas</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Espaço central da TopBar, reservado para o CallDock minimizado */}
      <div className="flex-1 min-w-0 flex justify-end px-2 sm:px-4">
        <CallDock />
      </div>

      {/* RIGHT: Notifications, Theme Toggle, User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={toggleDarkMode}
          title="Alternar tema"
          className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
        >
          {theme.mode === 'light' ? (
            <Moon className="w-4 h-4" />
          ) : (
            <Sun className="w-4 h-4 text-amber-400" />
          )}
        </button>

        <div className="relative">
        <button
          onClick={() => { setIsNotificationsOpen((value) => !value); markNotificationsRead(); }}
          title={notificationCount ? `${notificationCount} notificações não lidas. Marcar como lidas` : 'Nenhuma notificação não lida'}
          aria-label={notificationCount ? `${notificationCount} notificações não lidas. Marcar como lidas` : 'Nenhuma notificação não lida'}
          className={`relative p-2 rounded-full hover:bg-slate-800 transition-colors ${notificationCount ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <Bell className="w-4 h-4" />
          {notificationCount > 0 && <span className="notification-badge !bg-red-500 !text-white" aria-hidden="true">{notificationCount}</span>}
        </button>
        {isNotificationsOpen && <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl"><div className="flex items-center justify-between border-b border-slate-800 px-4 py-3"><strong className="text-sm text-white">Notificações</strong><button onClick={() => setIsNotificationsOpen(false)} aria-label="Fechar notificações" className="text-slate-400 hover:text-white"><X className="h-4 w-4" /></button></div><div className="max-h-80 overflow-y-auto">{inviteNotifications.length === 0 ? <p className="p-4 text-sm text-slate-400">Nenhum convite por enquanto.</p> : inviteNotifications.map((notification) => <button key={notification.id} disabled={openingNotificationId === notification.id} onClick={() => void openInviteNotification(notification)} className={`w-full border-b border-slate-800 px-4 py-3 text-left transition-colors hover:bg-slate-900 ${notification.read_at ? 'opacity-70' : 'bg-indigo-500/5'}`}><span className="block text-sm text-slate-200">{String(notification.payload.inviter_name || '@membro')} te convidou para {String(notification.payload.community_name || 'uma comunidade')}</span><span className="mt-1 block text-xs text-slate-400">Clique para ver o convite.</span><span className="mt-1 block text-[10px] text-slate-500">{new Date(notification.created_at).toLocaleString('pt-BR')}</span></button>)}</div></div>}
        </div>

        {/* User Pill */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 p-1 pl-2 rounded-nest-pill bg-slate-800 hover:bg-slate-700 border border-border transition-all"
          >
            <div className="relative">
              {currentUser.avatar ? <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-7 h-7 rounded-full object-cover ring-1 ring-border"
              /> : <div aria-hidden="true" className="w-7 h-7 rounded-full bg-slate-700 ring-1 ring-border" />}
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-slate-900 ${
                  currentUser.status === 'online'
                    ? 'bg-emerald-500'
                    : currentUser.status === 'idle'
                    ? 'bg-amber-500'
                    : currentUser.status === 'dnd'
                    ? 'bg-rose-500'
                    : 'bg-zinc-400'
                }`}
              />
            </div>
            <span className="text-xs font-semibold text-slate-200 hidden sm:inline max-w-[100px] truncate">
              {currentUser.name.split(' ')[0]}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 mr-1" />
          </button>

          {isUserMenuOpen && (
            <div className="absolute top-full right-0 mt-2 w-64 p-2 rounded-nest-sm bg-slate-900 border border-slate-700 shadow-2xl z-40 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3 p-2.5 rounded-nest-sm bg-slate-950 mb-2">
                {currentUser.avatar ? <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-10 h-10 rounded-full object-cover"
                /> : <div aria-hidden="true" className="w-10 h-10 rounded-full bg-slate-700" />}
                <div className="truncate">
                  <div className="text-xs font-bold text-white truncate">
                    {currentUser.name}
                  </div>
                  <div className="text-[11px] text-slate-400">@{currentUser.handle}</div>
                  <div className="text-[10px] text-indigo-400 font-medium flex items-center gap-1 mt-0.5">
                    <span>{currentUser.customStatus?.emoji}</span>
                    <span className="truncate">{currentUser.customStatus?.text}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  openUserProfile(currentUser);
                  setIsUserMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-nest-sm text-left text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <User className="w-4 h-4 text-indigo-400" />
                <span>Ver Meu Perfil</span>
              </button>

              <button
                onClick={() => {
                  setIsProfileEditorOpen(true);
                  setIsUserMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-nest-sm text-left text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <Settings className="w-4 h-4 text-slate-400" />
                <span>Editar Perfil & Status</span>
              </button>

<div className="my-2 rounded-xl border border-slate-800 bg-slate-950 p-3">
                <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-slate-200">
                  <span>Áudio</span>
                  <button type="button" role="switch" aria-checked={audioPreferences.muted} onClick={() => updateAudioPreferences({ ...audioPreferences, muted: !audioPreferences.muted })} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-slate-300 hover:bg-slate-800">
                    {audioPreferences.muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                    {audioPreferences.muted ? 'Mudo' : 'Com som'}
                  </button>
                </div>
                <label className="flex items-center gap-2 text-[10px] text-slate-400">
                  <span>Volume</span><input type="range" min="0" max="100" value={Math.round(audioPreferences.volume * 100)} onChange={(event) => updateAudioPreferences({ ...audioPreferences, volume: Number(event.target.value) / 100 })} className="min-w-0 flex-1 accent-sky-500" /><span className="w-8 text-right">{Math.round(audioPreferences.volume * 100)}%</span>
                </label>
              </div>

              <button
                onClick={() => {
                  setIsThemeCustomizerOpen(true);
                  setIsUserMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-nest-sm text-left text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <Sparkles className="w-4 h-4 text-sky-400" />
                <span>Personalizar Tema</span>
              </button>

              <div className="my-1 border-t border-slate-800" />

              <button
                onClick={() => {
                  setIsLoggedIn(false);
                  setIsUserMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-nest-sm text-left text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair da Conta</span>
              </button>
            </div>
          )}
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




