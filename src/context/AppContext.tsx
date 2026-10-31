import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  User,
  Community,
  Channel,
  Message,
  ActiveCall,
  ThemeSettings,
  DirectMessageConversation,
  ToastMessage
} from '../types';
import { canDeleteCommunityChannel, canModerateCommunity } from '../components/admin/adminAccess';
import { audioManager } from '../services/AudioManager';
import { supabase } from '../services/supabaseClient';

const EMPTY_USER: User = { id: '', name: '', handle: '', avatar: '', status: 'online', level: 1, xp: 0, xpMax: 100, badges: [], socials: [] };

type SupabaseMessageRow = {
  id: string;
  channel_id: string;
  author_id: string;
  content: string;
  created_at: string;
  profiles?: { username?: string | null; avatar_url?: string | null } | Array<{ username?: string | null; avatar_url?: string | null }> | null;
};

const toChatMessage = (row: SupabaseMessageRow, currentUser: User): Message => {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const isCurrentUser = row.author_id === currentUser.id;
  const authorName = profile?.username || (isCurrentUser ? currentUser.name : 'Usuário');
  const author: User = isCurrentUser ? currentUser : {
    ...EMPTY_USER,
    id: row.author_id,
    name: authorName,
    handle: profile?.username || '',
    avatar: profile?.avatar_url || '',
  };

  return {
    id: row.id,
    channelId: row.channel_id,
    senderId: row.author_id,
    sender: author,
    content: row.content,
    timestamp: row.created_at,
    reactions: [],
  };
};

const getDefaultTextChannel = (community?: Community) => {
  const textChannels = community?.channels.filter((channel) => channel.type === 'text') || [];
  return textChannels.find((channel) => channel.isDefault)
    || textChannels.find((channel) => /^(geral|general)$/i.test(channel.name.trim()))
    || textChannels[0]
    || null;
};

type PendingCallRequest =
  | { type: 'channel'; channel: Channel; mode: 'voice' | 'video'; isDeafened: boolean }
  | { type: 'direct'; targetUser: User; mode: 'voice' | 'video' };

interface AppContextType {
  // User & Auth
  currentUser: User;
  updateCurrentUser: (updates: Partial<User>) => void;
  isLoggedIn: boolean;
  setIsLoggedIn: (val: boolean) => void;
  createCommunity: (input: { name: string; icon?: string; visibility: 'public' | 'private' }) => Community | null;
  joinCommunityByInvite: (code: string) => boolean;
  
  // Communities & Channels
  communities: Community[];
  currentCommunityId: string;
  setCurrentCommunityId: (id: string) => void;
  currentChannelId: string;
  setCurrentChannelId: (id: string) => void;
  isDirectMessages: boolean;
  setIsDirectMessages: (val: boolean) => void;
  activeDmId: string | null;
  setActiveDmId: (id: string | null) => void;
  dms: DirectMessageConversation[];
  toggleArchiveDm: (id: string) => void;
  openDirectMessage: (user: User) => void;
  createChannel: (name: string, type: 'text' | 'voice', categoryId: string) => void;
  updateCommunity: (id: string, updates: Partial<Community>) => void;
  updateChannel: (id: string, updates: Partial<Channel>) => void;
  deleteChannel: (id: string) => boolean;
  removeCommunity: (id: string) => void;

  // Messaging
  messages: Record<string, Message[]>;
  sendMessage: (content: string, replyTo?: Message['replyTo'], attachments?: Message['attachments']) => Promise<boolean>;
  editMessage: (messageId: string, newContent: string) => void;
  deleteMessage: (messageId: string) => void;
  toggleReaction: (messageId: string, emoji: string) => void;
  togglePinMessage: (messageId: string) => void;
  isTyping: boolean;
  typingUser: string | null;
  simulateTyping: (userName: string) => void;

  // UI Panels
  isColumn1Collapsed: boolean;
  setIsColumn1Collapsed: (val: boolean) => void;
  isContextPanelOpen: boolean;
  setIsContextPanelOpen: (val: boolean) => void;
  contextPanelUser: User | null;
  openUserProfile: (user: User) => void;
  openMembersPanel: () => void;
  closeContextPanel: () => void;

  // Modals
  isProfileEditorOpen: boolean;
  setIsProfileEditorOpen: (val: boolean) => void;
  isThemeCustomizerOpen: boolean;
  setIsThemeCustomizerOpen: (val: boolean) => void;
  isCreateChannelModalOpen: boolean;
  setIsCreateChannelModalOpen: (val: boolean) => void;

  // Call / Voice / Video
  activeCall: ActiveCall | null;
  pendingCallSwitch: boolean;
  confirmCallSwitch: () => void;
  cancelCallSwitch: () => void;
  startCall: (channel: Channel, mode: 'voice' | 'video', isDeafened?: boolean) => void;
  startDirectCall: (targetUser: User, mode: 'voice' | 'video') => void;
  leaveCall: (expectedChannelId?: string, silent?: boolean) => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => void;
  watchScreen: () => void;
  stopWatchingScreen: () => void;
  toggleMinimizeCall: () => void;
  setCallLayout: (layout: 'grid' | 'spotlight' | 'audio-only') => void;
  switchCallChannel: (channel: Channel) => void;
  moveVoiceUser: (userId: string, channelId: string) => boolean;
  syncVoiceParticipants: (channelId: string, users: User[]) => void;

  // Themes
  theme: ThemeSettings;
  updateTheme: (updates: Partial<ThemeSettings>) => void;
  resetTheme: () => void;

  // Notifications / Toasts
  toasts: ToastMessage[];
  addToast: (title: string, message: string, type?: ToastMessage['type']) => void;
  removeToast: (id: string) => void;
  pauseToast: () => void;
  resumeToast: () => void;
  notify: { success: (message: string, duration?: number) => void; error: (message: string, duration?: number) => void; warning: (message: string, duration?: number) => void; info: (message: string, duration?: number) => void };
  markNotificationsRead: () => void;
  lastReadAtByChannel: Record<string, string>;
  markChannelRead: (channelId: string) => void;

  // User Actions Menu
  activeUserMenu: { user: User; position: { x: number; y: number } } | null;
  openUserMenu: (user: User, e: React.MouseEvent) => void;
  closeUserMenu: () => void;
}

const DEFAULT_THEME: ThemeSettings = {
  mode: typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  fontScale: 100,
  reduceMotion: false,
};

const loadThemeSettings = (): ThemeSettings => {
  try {
    const saved = JSON.parse(localStorage.getItem('koaline_theme') || '{}') as Partial<ThemeSettings>;
    const storedFontScale = typeof saved.fontScale === 'number' && Number.isFinite(saved.fontScale)
      ? saved.fontScale <= 1.5 ? saved.fontScale * 100 : saved.fontScale
      : DEFAULT_THEME.fontScale;
    return {
      mode: saved.mode === 'dark' || saved.mode === 'light' ? saved.mode : DEFAULT_THEME.mode,
      fontScale: Math.min(150, Math.max(80, storedFontScale)),
      reduceMotion: typeof saved.reduceMotion === 'boolean' ? saved.reduceMotion : DEFAULT_THEME.reduceMotion,
    };
  } catch {
    return DEFAULT_THEME;
  }
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Auth & Profile
  const [currentUser, setCurrentUser] = useState<User>(() => { try { return { ...EMPTY_USER, ...JSON.parse(localStorage.getItem('koaline:current-user') || '{}') }; } catch { return EMPTY_USER; } });
  const [isLoggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const client = supabase;
    if (!client) { setLoggedIn(false); return; }
    const applySession = (session: Awaited<ReturnType<typeof client.auth.getSession>>['data']['session']) => {
      const authUser = session?.user;
      if (!authUser) { setLoggedIn(false); return; }
      const metadata = authUser.user_metadata || {};
      setCurrentUser((previous) => ({ ...previous, id: authUser.id, email: authUser.email || '', name: String(metadata.full_name || metadata.name || previous.name || authUser.email?.split('@')[0] || 'Usuário'), handle: String(metadata.username || metadata.user_name || previous.handle || authUser.email?.split('@')[0] || ''), avatar: String(metadata.avatar_url || metadata.picture || previous.avatar || ''), onboarding_completed: Boolean(metadata.onboarding_completed) }));
      setLoggedIn(true);
    };
    let alive = true;
    void client.auth.getSession().then(({ data }) => { if (alive) applySession(data.session); });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => { if (alive) applySession(session); });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  // Navigation
  const [communities, setCommunities] = useState<Community[]>(() => {
    try { return JSON.parse(localStorage.getItem('koaline:communities') || '[]'); } catch { return []; }
  });
  const [currentCommunityId, setCurrentCommunityId] = useState<string>(() => localStorage.getItem('koaline:current-community') || '');
  const [currentChannelId, setCurrentChannelId] = useState<string>(() => localStorage.getItem('koaline:current-channel') || '');
  const [isDirectMessages, setIsDirectMessages] = useState<boolean>(false);
  const [activeDmId, setActiveDmId] = useState<string | null>(null);
  const [dms, setDms] = useState<DirectMessageConversation[]>(() => { try { return JSON.parse(localStorage.getItem('koaline:dms') || '[]'); } catch { return []; } });
  const [members, setMembers] = useState<Array<{id:string;communityId:string;userId:string;role:'owner'|'admin'|'moderator'|'member';joinedAt:string}>>(() => { try { return JSON.parse(localStorage.getItem('koaline:members') || '[]'); } catch { return []; } });
  const [flatChannels, setFlatChannels] = useState<Array<{id:string;communityId:string;name:string;type:'text'|'voice';category:string;position:number;isPrivate:boolean;isArchived:boolean;createdAt:string}>>(() => { try { return JSON.parse(localStorage.getItem('koaline:channels') || '[]'); } catch { return []; } });
  const [invites, setInvites] = useState<unknown[]>(() => { try { return JSON.parse(localStorage.getItem('koaline:invites') || '[]'); } catch { return []; } });
  const [logs, setLogs] = useState<unknown[]>(() => { try { return JSON.parse(localStorage.getItem('koaline:logs') || '[]'); } catch { return []; } });
  const [messages, setMessages] = useState<Record<string, Message[]>>({});

  useEffect(() => {
    localStorage.setItem('koaline:communities', JSON.stringify(communities));
    localStorage.setItem('koaline:current-community', currentCommunityId);
    localStorage.setItem('koaline:current-channel', currentChannelId);
    localStorage.setItem('koaline:dms', JSON.stringify(dms));
    localStorage.setItem('koaline:members', JSON.stringify(members));
    localStorage.setItem('koaline:channels', JSON.stringify(flatChannels));
    localStorage.setItem('koaline:invites', JSON.stringify(invites));
    localStorage.setItem('koaline:logs', JSON.stringify(logs));
  }, [communities, currentCommunityId, currentChannelId, dms, members, flatChannels, invites, logs]);
  // A persisted voice-channel selection is not a call session. Return to text on reload/deep link.
  useEffect(() => {
    if (activeCallRef.current) return;
    const community = communities.find((item) => item.id === currentCommunityId);
    const selected = community?.channels.find((channel) => channel.id === currentChannelId);
    if (selected?.type !== 'voice') return;
    setCurrentChannelId(getDefaultTextChannel(community)?.id || '');
    setIsDirectMessages(false);
    setActiveDmId(null);
  }, [communities, currentCommunityId, currentChannelId]);

  useEffect(() => {
    if (localStorage.getItem('koaline:migrated_clean') === '1') return;
    try {
      const stored = JSON.parse(localStorage.getItem('koaline:communities') || '[]') as Community[];
      const legacyIds = new Set(stored.filter((item) => !item.ownerId && (item.id.startsWith('comm-koala-') || item.id.startsWith('comm-tech-') || (item as Community & { isDemo?: boolean; mock?: boolean }).isDemo || (item as Community & { mock?: boolean }).mock)).map((item) => item.id));
      if (legacyIds.size) {
        const valid = stored.filter((item) => !legacyIds.has(item.id) || !!item.ownerId);
        setCommunities(valid);
        setFlatChannels((prev) => prev.filter((item) => !legacyIds.has(item.communityId)));
        setMembers((prev) => prev.filter((item) => !legacyIds.has(item.communityId)));
        setInvites((prev) => (prev as Array<{communityId?:string}>).filter((item) => !item.communityId || !legacyIds.has(item.communityId)));
        setLogs((prev) => (prev as Array<{communityId?:string}>).filter((item) => !item.communityId || !legacyIds.has(item.communityId)));
        if (legacyIds.has(localStorage.getItem('koaline:current-community') || '')) { setCurrentCommunityId(''); setCurrentChannelId(''); }
        setDms((prev) => prev.filter((item) => !['user-leo','user-clara','user-thiago','user-beatriz'].includes(item.user.id)));
      }
    } catch { /* Dados locais inválidos são preservados para não apagar conteúdo não identificado. */ }
    localStorage.setItem('koaline:migrated_clean', '1');
  }, []);

  // Text channel messages are loaded from Supabase and kept current through Realtime.
  useEffect(() => {
    const client = supabase;
    if (!client || !isLoggedIn || !currentChannelId || isDirectMessages) return;

    let active = true;
    setMessages((previous) => ({ ...previous, [currentChannelId]: [] }));

    const loadMessages = async () => {
      const { data, error } = await client
        .from('messages')
        .select('*, profiles(username, avatar_url)')
        .eq('channel_id', currentChannelId)
        .order('created_at', { ascending: true });

      if (!active) return;
      if (error) {
        addToast('Não foi possível carregar as mensagens', error.message, 'error');
        return;
      }

      const loadedMessages = ((data || []) as SupabaseMessageRow[]).map((row) => toChatMessage(row, currentUser));
      setMessages((previous) => ({ ...previous, [currentChannelId]: loadedMessages }));
    };

    void loadMessages();

    const channel = client
      .channel(`messages:${currentChannelId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `channel_id=eq.${currentChannelId}`,
      }, (payload) => {
        const row = payload.new as SupabaseMessageRow;
        if (!active || !row?.id) return;
        const message = toChatMessage(row, currentUser);
        setMessages((previous) => {
          const channelMessages = previous[currentChannelId] || [];
          if (channelMessages.some((item) => item.id === message.id)) return previous;
          return { ...previous, [currentChannelId]: [...channelMessages, message] };
        });
      })
      .subscribe();

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [currentChannelId, currentUser, isDirectMessages, isLoggedIn]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);

  // UI Panels
  const [isColumn1Collapsed, setIsColumn1Collapsed] = useState(false);
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(false);
  const [contextPanelUser, setContextPanelUser] = useState<User | null>(null);

  // Modals
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);
  const [isThemeCustomizerOpen, setIsThemeCustomizerOpen] = useState(false);
  const [isCreateChannelModalOpen, setIsCreateChannelModalOpen] = useState(false);

  // Active Call
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const activeCallRef = useRef(activeCall);
  activeCallRef.current = activeCall;
  const [pendingCallRequest, setPendingCallRequest] = useState<PendingCallRequest | null>(null);
  const screenStreamRef = React.useRef<MediaStream | null>(null);

  // Theme
  const [theme, setTheme] = useState<ThemeSettings>(() => {
    const savedTheme = loadThemeSettings();
    document.documentElement.setAttribute('data-theme', savedTheme.mode);
    return savedTheme;
  });

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastTimerRef = useRef<number | null>(null);
  const toastPausedRef = useRef(false);
  const toastDeadlineRef = useRef(0);
  const toastRemainingRef = useRef(4000);
  const [lastReadAtByChannel, setLastReadAtByChannel] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('koaline:last-read') || '{}'); } catch { return {}; }
  });

  // User Actions Dropdown Menu
  const [activeUserMenu, setActiveUserMenu] = useState<{ user: User; position: { x: number; y: number } } | null>(null);

  // Apply Theme to DOM
  useEffect(() => {
    const root = document.documentElement;
    [
      '--bg-primary', '--bg-secondary', '--bg-elevated', '--text-primary', '--text-secondary',
      '--text-muted', '--border', '--border-strong', '--accent', '--accent-hover', '--color-primary',
      '--color-primary-hover', '--color-accent', '--color-bg-app', '--color-surface',
      '--color-surface-elevated', '--color-surface-sunken', '--color-text-main', '--color-text-muted',
      '--color-border', '--accent-muted', '--density-padding',
      '--app-background-image', '--background-opacity', '--radius-sm', '--radius-md', '--radius-lg',
      '--radius-xl', '--shadow-sm', '--shadow-md', '--shadow-lg',
    ].forEach((property) => root.style.removeProperty(property));
    root.removeAttribute('data-density');
    root.classList.remove('high-contrast');
    root.setAttribute('data-theme', theme.mode);
    root.style.setProperty('--font-scale', String(theme.fontScale / 100));
    root.style.fontSize = `${theme.fontScale}%`;

    try {
      localStorage.setItem('koaline_theme', JSON.stringify({
        mode: theme.mode,
        fontScale: theme.fontScale,
        reduceMotion: theme.reduceMotion,
      }));
    } catch { /* O tema segue aplicado mesmo se o armazenamento local estiver indisponível. */ }

    if (theme.mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    if (theme.reduceMotion) {
      root.classList.add('reduced-motion');
      root.setAttribute('data-reduce-motion', 'true');
    } else {
      root.classList.remove('reduced-motion');
      root.removeAttribute('data-reduce-motion');
    }

  }, [theme]);

  // Simulated speaking glow
  useEffect(() => {
    if (!activeCall) return;
    const interval = setInterval(() => {
      setActiveCall((prev) => {
        if (!prev) return null;
        const updated = prev.participants.map((p, idx) => {
          if (p.isMuted) return { ...p, isSpeaking: false };
          const shouldSpeak = idx === 0 ? p.isSpeaking : Math.random() > 0.6;
          return { ...p, isSpeaking: shouldSpeak };
        });
        return { ...prev, participants: updated };
      });
    }, 2400);

    return () => clearInterval(interval);
  }, [activeCall?.channelId]);

  const updateCurrentUser = (updates: Partial<User>) => {
    const next = { ...currentUser, ...updates };
    setCurrentUser(next);
    try { localStorage.setItem('koaline:current-user', JSON.stringify(next)); }
    catch { addToast('Armazenamento cheio', 'Não foi possível salvar a imagem. Remova alguns dados locais e tente novamente.', 'warning'); return; }
    addToast('Perfil Atualizado', 'Suas alterações foram salvas com sucesso.', 'success');
  };

  const setIsLoggedIn = (value: boolean) => {
    if (!value) {
      setLoggedIn(false);
      if (supabase) void supabase.auth.signOut();
      return;
    }
    setLoggedIn(Boolean(supabase));
  };

  const createCommunity = ({ name, icon = '', visibility }: { name: string; icon?: string; visibility: 'public' | 'private' }) => {
    if (!currentUser.id || !name.trim()) return null;
    const id = crypto.randomUUID(); const createdAt = new Date().toISOString(); const category = 'Geral';
    const generalId = crypto.randomUUID(); const voiceId = crypto.randomUUID();
    const community: Community = { id, name: name.trim(), icon: icon || '◇', tagline: '', description: '', visibility, ownerId: currentUser.id, creatorId: currentUser.id, createdAt, membersCount: 1, categories: [{ id: `${id}:geral`, communityId: id, name: category }], channels: [
      { id: generalId, communityId: id, name: 'geral', type: 'text', categoryId: `${id}:geral` },
      { id: voiceId, communityId: id, name: 'Sala de voz', type: 'voice', categoryId: `${id}:geral`, connectedUsers: [] },
    ] };
    const member = { id: crypto.randomUUID(), communityId: id, userId: currentUser.id, role: 'owner' as const, joinedAt: createdAt };
    setCommunities((prev) => [...prev, community]); setMembers((prev) => [...prev, member]);
    setFlatChannels((prev) => [...prev, { id: generalId, communityId: id, name: 'geral', type: 'text', category, position: 0, isPrivate: false, isArchived: false, createdAt }, { id: voiceId, communityId: id, name: 'Sala de voz', type: 'voice', category, position: 1, isPrivate: false, isArchived: false, createdAt }]);
    setLogs((prev) => [{ id: crypto.randomUUID(), communityId: id, userId: currentUser.id, action: 'community_created', targetId: id, metadata: {}, createdAt }, ...prev]);
    setCurrentCommunityId(id); setCurrentChannelId(generalId); setIsDirectMessages(false); localStorage.setItem('koaline:current-community', id); localStorage.setItem('koaline:current-channel', generalId);
    return community;
  };

  const joinCommunityByInvite = (code: string) => {
    if (!currentUser.id || !code.trim()) return false;
    const now = Date.now();
    let available: Array<{ id: string; communityId: string; code: string; expiresAt: number | null; maxUses: number | null; uses: number; revoked?: boolean }>;
    try { available = JSON.parse(localStorage.getItem('koaline:invites') || '[]'); } catch { available = []; }
    const invite = available.find((item) => item.code.toLowerCase() === code.trim().toLowerCase() && !item.revoked && (!item.expiresAt || item.expiresAt > now) && (!item.maxUses || item.uses < item.maxUses));
    const community = invite && communities.find((item) => item.id === invite.communityId);
    if (!invite || !community) return false;
    const existing = members.some((member) => member.communityId === community.id && member.userId === currentUser.id);
    if (!existing) {
      setMembers((prev) => [...prev, { id: crypto.randomUUID(), communityId: community.id, userId: currentUser.id, role: 'member', joinedAt: new Date().toISOString() }]);
      setCommunities((prev) => prev.map((item) => item.id === community.id ? { ...item, membersCount: item.membersCount + 1 } : item));
    }
    setInvites((prev) => (prev as typeof available).map((item) => item.id === invite.id ? { ...item, uses: item.uses + 1 } : item));
    setCurrentCommunityId(community.id);
    setCurrentChannelId(community.channels.find((channel) => channel.type === 'text')?.id || '');
    setIsDirectMessages(false);
    return true;
  };

  const clearToastTimer = () => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = null;
  };

  const addToast = (title: string, message: string, type: ToastMessage['type'] = 'info', duration = 4000) => {
    clearToastTimer();
    const id = crypto.randomUUID();
    const toast = { id, title, message, type, duration };
    setToasts([toast]);
    toastRemainingRef.current = duration;
    if (!toastPausedRef.current) {
      toastDeadlineRef.current = Date.now() + duration;
      toastTimerRef.current = window.setTimeout(() => removeToast(id), duration);
    }
  };

  const removeToast = (id: string) => {
    clearToastTimer();
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const pauseToast = () => {
    toastPausedRef.current = true;
    if (toastTimerRef.current === null) return;
    toastRemainingRef.current = Math.max(0, toastDeadlineRef.current - Date.now());
    clearToastTimer();
  };

  const resumeToast = () => {
    toastPausedRef.current = false;
    if (toastTimerRef.current !== null || !toasts[0]) return;
    const delay = toastRemainingRef.current || 1;
    toastDeadlineRef.current = Date.now() + delay;
    toastTimerRef.current = window.setTimeout(() => removeToast(toasts[0].id), delay);
  };

  const notify = {
    success: (message: string, duration?: number) => addToast('Sucesso', message, 'success', duration),
    error: (message: string, duration?: number) => addToast('Erro', message, 'error', duration),
    warning: (message: string, duration?: number) => addToast('Atenção', message, 'warning', duration),
    info: (message: string, duration?: number) => addToast('Informação', message, 'info', duration),
  };

  const markChannelRead = (channelId: string) => {
    const readAt = new Date().toISOString();
    setLastReadAtByChannel((prev) => {
      const next = { ...prev, [channelId]: readAt };
      try { localStorage.setItem('koaline:last-read', JSON.stringify(next)); } catch { /* Mantém a leitura na sessão atual. */ }
      return next;
    });
    setCommunities((prev) => prev.map((community) => ({ ...community, channels: community.channels.map((channel) => channel.id === channelId ? { ...channel, unreadCount: 0 } : channel) })));
    setDms((prev) => prev.map((dm) => dm.id === channelId ? { ...dm, unread: false, lastReadAt: readAt } : dm));
  };

  const markNotificationsRead = () => {
    const readAt = new Date().toISOString();
    setDms((prev) => prev.map((dm) => ({ ...dm, unread: false, lastReadAt: readAt })));
    setCommunities((prev) => prev.map((community) => ({ ...community, channels: community.channels.map((channel) => ({ ...channel, unreadCount: 0 })) })));
    const next: Record<string, string> = {};
    communities.forEach((community) => community.channels.forEach((channel) => { next[channel.id] = readAt; }));
    dms.forEach((dm) => { next[dm.id] = readAt; });
    setLastReadAtByChannel(next);
    try { localStorage.setItem('koaline:last-read', JSON.stringify(next)); } catch { /* Mantém o estado na sessão atual. */ }
  };

  const moveVoiceUser = (userId: string, channelId: string) => {
    if (!userId.trim()) return false;
    const destinationCommunity = communities.find((community) => community.channels.some((channel) => channel.id === channelId));
    const destination = destinationCommunity?.channels.find((channel) => channel.id === channelId);
    if (!destinationCommunity || destination?.type !== 'voice' || !canModerateCommunity(destinationCommunity.id, currentUser, destinationCommunity.ownerId || destinationCommunity.creatorId)) return false;
    const sourceChannel = communities.flatMap((community) => community.channels).find((channel) => channel.type === 'voice' && channel.connectedUsers?.some((user) => user.id === userId));
    if (!sourceChannel || sourceChannel.communityId !== destinationCommunity.id) return false;
    const movingUser = sourceChannel.connectedUsers?.find((user) => user.id === userId);
    if (!movingUser) return false;
    setCommunities((prev) => prev.map((community) => ({
      ...community,
      channels: community.channels.map((channel) => {
        const remaining = (channel.connectedUsers || []).filter((user) => user.id !== userId);
        return channel.id === channelId ? { ...channel, connectedUsers: [...remaining, movingUser] } : channel.connectedUsers ? { ...channel, connectedUsers: remaining } : channel;
      }),
    })));
    setActiveCall((prev) => prev?.participants.some((participant) => participant.user.id === userId)
      ? { ...prev, channelId, channelName: destination.name }
      : prev);
    addToast('Usuário movido', `Usuário movido para ${destination.name}.`, 'success');
    return true;
  };

  const syncVoiceParticipants = (channelId: string, users: User[]) => {
    const validUsers = [...new Map(users.filter((user) => (user.id || '').trim() && ((user.avatar || '').trim() || (user.name || '').trim() || (user.handle || '').trim())).map((user) => [user.id, user])).values()];
    setCommunities((prev) => prev.map((community) => ({
      ...community,
      channels: community.channels.map((channel) => channel.id === channelId
        ? { ...channel, connectedUsers: validUsers }
        : channel),
    })));
  };

  const updateTheme = (updates: Partial<ThemeSettings>) => {
    setTheme((prev) => ({ ...prev, ...updates }));
  };

  const resetTheme = () => {
    setTheme(DEFAULT_THEME);
    addToast('Tema Restaurado', 'Configurações visuais redefinidas.');
  };

  const openUserProfile = (user: User) => {
    setContextPanelUser(user);
    setIsContextPanelOpen(true);
    closeUserMenu();
  };

  const openMembersPanel = () => {
    setContextPanelUser(null);
    setIsContextPanelOpen(true);
  };

  const closeContextPanel = () => {
    setIsContextPanelOpen(false);
  };

  const openUserMenu = (user: User, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 240);
    const y = Math.min(e.clientY, window.innerHeight - 340);
    setActiveUserMenu({ user, position: { x, y } });
  };

  const closeUserMenu = () => {
    setActiveUserMenu(null);
  };

  const toggleArchiveDm = (id: string) => {
    setDms((prev) =>
      prev.map((dm) => (dm.id === id ? { ...dm, isArchived: !dm.isArchived } : dm))
    );
    addToast('Conversa Atualizada', 'O status de arquivamento foi modificado.');
  };

  const openDirectMessage = (user: User) => {
    const existing = dms.find((dm) => dm.user.id === user.id || dm.user.handle.toLowerCase() === user.handle.toLowerCase());
    const id = existing?.id || `dm-${user.id}`;
    if (!existing) {
      setDms((prev) => [...prev, { id, user, lastMessage: '', lastMessageTime: '', unread: false, isArchived: false }]);
    } else if (existing.isArchived) {
      setDms((prev) => prev.map((dm) => dm.id === existing.id ? { ...dm, isArchived: false } : dm));
    }
    setActiveDmId(id);
    setIsDirectMessages(true);
    setIsColumn1Collapsed(false);
  };

  const createChannel = (name: string, type: 'text' | 'voice', categoryId: string) => {
    const cleanName = name.trim().toLowerCase().replace(/\s+/g, '-');
    const activeCommunity = communities.find((community) => community.id === currentCommunityId);
    if (!/^[a-z0-9_-]+$/.test(cleanName)) {
      addToast('Nome inválido', 'Use letras, números, hífen ou sublinhado.', 'warning');
      return;
    }
    if (activeCommunity?.channels.some((channel) => channel.name === cleanName)) {
      addToast('Nome em uso', 'Já existe um canal com esse nome nesta comunidade.', 'warning');
      return;
    }
    const newChan: Channel = {
      id: crypto.randomUUID(),
      communityId: currentCommunityId,
      ownerId: currentUser.id,
      name: cleanName,
      type,
      categoryId,
      topic: `Canal ${type === 'voice' ? 'de voz' : 'de texto'} criado recentemente`,
      unreadCount: 0,
      connectedUsers: type === 'voice' ? [] : undefined,
    };

    setCommunities((prev) =>
      prev.map((c) =>
        c.id === currentCommunityId ? { ...c, channels: [...c.channels, newChan] } : c
      )
    );
    setFlatChannels((prev) => [...prev, { id: newChan.id, communityId: currentCommunityId, name: cleanName, type, category: activeCommunity?.categories.find((item) => item.id === categoryId)?.name || 'Geral', position: activeCommunity?.channels.length || 0, isPrivate: false, isArchived: false, createdAt: new Date().toISOString() }]);
    setLogs((prev) => [{ id: crypto.randomUUID(), communityId: currentCommunityId, userId: currentUser.id, action: 'channel_created', targetId: newChan.id, metadata: { name: cleanName, type }, createdAt: new Date().toISOString() }, ...prev]);
    try {
      const key = `koaline:admin:${currentCommunityId}`;
      const saved = JSON.parse(localStorage.getItem(key) || '{}');
      const entry = { id: `audit-${Date.now()}`, actor: currentUser.name, action: 'Canal criado', target: cleanName, time: Date.now(), type: 'channel' };
      localStorage.setItem(key, JSON.stringify({ ...saved, audit: [entry, ...(saved.audit || [])] }));
    } catch { /* A criação continua disponível mesmo se o armazenamento local estiver indisponível. */ }
    setIsCreateChannelModalOpen(false);
    setCurrentChannelId(newChan.id);
    addToast('Canal Criado', `#${cleanName} foi criado com sucesso!`, 'success');
  };

  const updateCommunity = (id: string, updates: Partial<Community>) => {
    setCommunities((prev) => prev.map((community) => community.id === id ? { ...community, ...updates } : community));
  };

  const updateChannel = (id: string, updates: Partial<Channel>) => {
    setCommunities((prev) => prev.map((community) => ({
      ...community,
      channels: community.channels.map((channel) => channel.id === id ? { ...channel, ...updates } : channel),
    })));
    setFlatChannels((prev) => prev.map((channel) => {
      if (channel.id !== id) return channel;
      const community = communities.find((item) => item.id === channel.communityId);
      const category = updates.categoryId ? community?.categories.find((item) => item.id === updates.categoryId)?.name : channel.category;
      return { ...channel, ...(updates.name ? { name: updates.name } : {}), ...(category ? { category } : {}), ...(updates.isPrivate !== undefined ? { isPrivate: updates.isPrivate } : {}), ...(updates.isArchived !== undefined ? { isArchived: updates.isArchived } : {}) };
    }));
  };

  const deleteChannel = (id: string): boolean => {
    const community = communities.find((item) => item.channels.some((channel) => channel.id === id));
    const channel = community?.channels.find((item) => item.id === id);
    if (!community || !channel || !canDeleteCommunityChannel(community.id, currentUser, community.ownerId || community.creatorId, channel.ownerId)) return false;

    if (activeCallRef.current?.channelId === id) leaveCall(id, true);
    setCommunities((prev) => prev.map((item) => ({
      ...item,
      channels: item.channels.filter((itemChannel) => itemChannel.id !== id),
    })));
    setFlatChannels((prev) => prev.filter((item) => item.id !== id));
    setMessages((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setLastReadAtByChannel((prev) => { const next = { ...prev }; delete next[id]; return next; });
    try {
      const key = `koaline:admin:${community.id}`;
      const saved = JSON.parse(localStorage.getItem(key) || '{}');
      localStorage.setItem(key, JSON.stringify({
        ...saved,
        archived: (saved.archived || []).filter((channelId: string) => channelId !== id),
        channelOrder: (saved.channelOrder || []).filter((channelId: string) => channelId !== id),
      }));
    } catch { /* A remoção do canal não depende da limpeza dos dados auxiliares. */ }

    if (currentCommunityId === community.id && currentChannelId === id) {
      const remainingTextChannels = community.channels.filter((item) => item.id !== id && item.type === 'text');
      const remainingChannels = community.channels.filter((item) => item.id !== id);
      const fallback = remainingTextChannels.find((item) => /^(geral|general)$/i.test(item.name)) || remainingTextChannels[0] || remainingChannels[0];
      setCurrentChannelId(fallback?.id || '');
    }
    return true;
  };

  const removeCommunity = (id: string) => {
    const remaining = communities.filter((community) => community.id !== id);
    const removedChannelIds = new Set(communities.find((community) => community.id === id)?.channels.map((channel) => channel.id) || []);
    setCommunities(remaining);
    setFlatChannels((prev) => prev.filter((channel) => channel.communityId !== id));
    setMembers((prev) => prev.filter((member) => member.communityId !== id));
    setInvites((prev) => (prev as Array<{ communityId?: string }>).filter((item) => item.communityId !== id));
    setLogs((prev) => (prev as Array<{ communityId?: string }>).filter((item) => item.communityId !== id));
    setMessages((prev) => Object.fromEntries(Object.entries(prev).filter(([channelId]) => !removedChannelIds.has(channelId))));
    localStorage.removeItem(`koaline:admin:${id}`);
    if (currentCommunityId === id) {
      const nextCommunity = remaining[0];
      setCurrentCommunityId(nextCommunity?.id || '');
      setCurrentChannelId(nextCommunity?.channels.find((channel) => channel.type === 'text')?.id || '');
    }
    return true;
  };

  const simulateTyping = (userName: string) => {
    setIsTyping(true);
    setTypingUser(userName);
    setTimeout(() => {
      setIsTyping(false);
      setTypingUser(null);
    }, 3000);
  };

  const activeChannelKey = isDirectMessages && activeDmId ? activeDmId : currentChannelId;

  const sendMessage = async (
    content: string,
    replyTo?: Message['replyTo'],
    attachments?: Message['attachments']
  ) => {
    const messageContent = content.trim();
    if (!messageContent) return false;
    if (!supabase || isDirectMessages || !activeChannelKey || !currentUser.id) {
      addToast('Não foi possível enviar', 'Entre em um canal de texto com a sessão do Supabase ativa.', 'error');
      return false;
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({ channel_id: activeChannelKey, author_id: currentUser.id, content: messageContent })
      .select('*, profiles(username, avatar_url)')
      .single();

    if (error) {
      addToast('Mensagem não enviada', error.message, 'error');
      return false;
    }

    if (data) {
      const newMessage = { ...toChatMessage(data as SupabaseMessageRow, currentUser), replyTo, attachments };
      setMessages((previous) => {
        const channelMessages = previous[activeChannelKey] || [];
        if (channelMessages.some((item) => item.id === newMessage.id)) return previous;
        return { ...previous, [activeChannelKey]: [...channelMessages, newMessage] };
      });
    }
    return Boolean(data);
  };

  const editMessage = (messageId: string, newContent: string) => {
    setMessages((prev) => {
      const channelMsgs = prev[activeChannelKey] || [];
      return {
        ...prev,
        [activeChannelKey]: channelMsgs.map((m) =>
          m.id === messageId ? { ...m, content: newContent, edited: true } : m
        ),
      };
    });
    addToast('Mensagem Editada', 'Alteração salva com sucesso.');
  };

  const deleteMessage = (messageId: string) => {
    setMessages((prev) => {
      const channelMsgs = prev[activeChannelKey] || [];
      return {
        ...prev,
        [activeChannelKey]: channelMsgs.map((m) =>
          m.id === messageId ? { ...m, isDeleted: true, content: 'Mensagem apagada' } : m
        ),
      };
    });
    addToast('Mensagem Apagada', 'Mensagem removida.');
  };

  const toggleReaction = (messageId: string, emoji: string) => {
    setMessages((prev) => {
      const channelMsgs = prev[activeChannelKey] || [];
      const updated = channelMsgs.map((m) => {
        if (m.id !== messageId) return m;
        const existingRx = m.reactions.find((r) => r.emoji === emoji);
        let newReactions = [...m.reactions];

        if (existingRx) {
          const userHasReacted = existingRx.users.includes(currentUser.id);
          if (userHasReacted) {
            const newUsers = existingRx.users.filter((uid) => uid !== currentUser.id);
            if (newUsers.length === 0) {
              newReactions = newReactions.filter((r) => r.emoji !== emoji);
            } else {
              newReactions = newReactions.map((r) =>
                r.emoji === emoji ? { ...r, count: r.count - 1, users: newUsers } : r
              );
            }
          } else {
            newReactions = newReactions.map((r) =>
              r.emoji === emoji
                ? { ...r, count: r.count + 1, users: [...r.users, currentUser.id] }
                : r
            );
          }
        } else {
          newReactions.push({
            emoji,
            count: 1,
            users: [currentUser.id],
          });
        }
        return { ...m, reactions: newReactions };
      });

      return {
        ...prev,
        [activeChannelKey]: updated,
      };
    });
  };

  const togglePinMessage = (messageId: string) => {
    setMessages((prev) => {
      const channelMsgs = prev[activeChannelKey] || [];
      return {
        ...prev,
        [activeChannelKey]: channelMsgs.map((m) =>
          m.id === messageId ? { ...m, pinned: !m.pinned } : m
        ),
      };
    });
    addToast('Fixado', 'Status de fixação atualizado.');
  };

  // Call management
  const connectToChannelCall = (channel: Channel, mode: 'voice' | 'video', isDeafened = false) => {
    const currentComm = communities.find((c) => c.id === currentCommunityId);
    setCurrentChannelId(channel.id);
    const otherParticipants = (channel.connectedUsers || [])
      .filter((user) => user.id !== currentUser.id)
      .map((user) => ({ user, isSpeaking: false, isMuted: false, isCameraOn: false }));
    setCommunities((prev) => prev.map((community) => ({
      ...community,
      channels: community.channels.map((item) => item.id === channel.id
        ? { ...item, connectedUsers: [...(item.connectedUsers || []).filter((user) => user.id !== currentUser.id), currentUser] }
        : item),
    })));
    const nextCall: ActiveCall = {
      channelId: channel.id,
      channelName: channel.name,
      communityName: currentComm ? currentComm.name : 'Geral',
      type: mode,
      isMinimized: false,
      isMicMuted: false,
      isDeafened,
      isCameraOn: mode === 'video',
      isScreenSharing: false,
      screenStream: null,
      isWatchingScreen: false,
      screenViewers: [],
      layout: mode === 'video' ? 'grid' : 'audio-only',
      participants: [
        ...otherParticipants,
        { user: currentUser, isSpeaking: false, isMuted: false, isCameraOn: mode === 'video' },
      ],
    };
    activeCallRef.current = nextCall;
    setActiveCall(nextCall);
    addToast('Conectado', `Entrou na sala de voz ${channel.name}`, 'success');
  };

  const connectToDirectCall = (targetUser: User, mode: 'voice' | 'video') => {
    const nextCall: ActiveCall = {
      channelId: `dm-call-${targetUser.id}`,
      channelName: targetUser.name,
      communityName: 'Chamada Direta',
      type: mode,
      isMinimized: false,
      isMicMuted: false,
      isDeafened: false,
      isCameraOn: mode === 'video',
      isScreenSharing: false,
      screenStream: null,
      isWatchingScreen: false,
      screenViewers: [],
      layout: mode === 'video' ? 'grid' : 'audio-only',
      participants: [
        { user: currentUser, isSpeaking: false, isMuted: false, isCameraOn: mode === 'video' },
        { user: targetUser, isSpeaking: false, isMuted: false, isCameraOn: mode === 'video' },
      ],
    };
    activeCallRef.current = nextCall;
    setActiveCall(nextCall);
    addToast('Chamando...', `Iniciando chamada com ${targetUser.name}`);
  };

  const startCall = (channel: Channel, mode: 'voice' | 'video', isDeafened = false) => {
    if (activeCallRef.current && activeCallRef.current.channelId !== channel.id) {
      setPendingCallRequest({ type: 'channel', channel, mode, isDeafened });
      return;
    }
    connectToChannelCall(channel, mode, isDeafened);
  };

  const startDirectCall = (targetUser: User, mode: 'voice' | 'video') => {
    const targetCallId = `dm-call-${targetUser.id}`;
    if (activeCallRef.current && activeCallRef.current.channelId !== targetCallId) {
      setPendingCallRequest({ type: 'direct', targetUser, mode });
      return;
    }
    connectToDirectCall(targetUser, mode);
  };

  const leaveCall = (expectedChannelId?: string, silent = false) => {
    const callToLeave = activeCallRef.current;
    if (!callToLeave || (expectedChannelId && callToLeave.channelId !== expectedChannelId)) return;
    if (!silent) void audioManager.play('leave_call');
    if (!callToLeave.channelId.startsWith('dm-call-')) {
      const callCommunity = communities.find((community) => community.channels.some((channel) => channel.id === callToLeave.channelId));
      const callChannel = callCommunity?.channels.find((channel) => channel.id === callToLeave.channelId);
      if (currentChannelId === callToLeave.channelId && callChannel?.type === 'voice' && callCommunity) {
        setCurrentCommunityId(callCommunity.id);
        setCurrentChannelId(getDefaultTextChannel(callCommunity)?.id || '');
        setIsDirectMessages(false);
        setActiveDmId(null);
      }
      setCommunities((prev) => prev.map((community) => ({
        ...community,
        channels: community.channels.map((channel) => channel.id === callToLeave.channelId
          ? { ...channel, connectedUsers: (channel.connectedUsers || []).filter((user) => user.id !== currentUser.id) }
          : channel),
      })));
    }
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    activeCallRef.current = null;
    setActiveCall(null);
    if (!silent) addToast('Chamada Encerrada', 'Você saiu da call.');
  };

  const confirmCallSwitch = () => {
    const request = pendingCallRequest;
    if (!request) return;
    const previousCallId = activeCallRef.current?.channelId;
    if (previousCallId) leaveCall(previousCallId, true);
    setPendingCallRequest(null);
    window.setTimeout(() => {
      if (request.type === 'channel') connectToChannelCall(request.channel, request.mode, request.isDeafened);
      else connectToDirectCall(request.targetUser, request.mode);
    }, 0);
  };

  const cancelCallSwitch = () => setPendingCallRequest(null);

  const toggleMute = () => {
    setActiveCall((prev) => {
      if (!prev) return null;
      const newMuted = !prev.isMicMuted;
      const updatedParticipants = prev.participants.map((p) =>
        p.user.id === currentUser.id ? { ...p, isMuted: newMuted, isSpeaking: false } : p
      );
      return {
        ...prev,
        isMicMuted: newMuted,
        participants: updatedParticipants,
      };
    });
  };

  const toggleDeafen = () => {
    setActiveCall((prev) => (prev ? { ...prev, isDeafened: !prev.isDeafened } : null));
  };

  const toggleCamera = () => {
    setActiveCall((prev) => {
      if (!prev) return null;
      const newCam = !prev.isCameraOn;
      const updatedParticipants = prev.participants.map((p) =>
        p.user.id === currentUser.id ? { ...p, isCameraOn: newCam } : p
      );
      return {
        ...prev,
        isCameraOn: newCam,
        type: newCam ? 'video' : prev.type,
        layout: newCam && prev.layout === 'audio-only' ? 'grid' : prev.layout,
        participants: updatedParticipants,
      };
    });
  };

  const stopScreenShare = () => {
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    setActiveCall((prev) => prev ? { ...prev, isScreenSharing: false, screenStream: null, isWatchingScreen: false, screenViewers: [] } : null);
  };

  const toggleScreenShare = async () => {
    if (screenStreamRef.current) { stopScreenShare(); return; }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      addToast('Compartilhamento indisponível', 'Este navegador não oferece captura de tela.', 'warning');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      if (track) track.onended = stopScreenShare;
      setActiveCall((prev) => prev ? { ...prev, isScreenSharing: true, screenStream: stream, isWatchingScreen: false, screenViewers: [], layout: 'spotlight' } : null);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') return;
      addToast('Falha ao compartilhar', 'Não foi possível iniciar a captura de tela.', 'warning');
    }
  };

  const watchScreen = () => setActiveCall((prev) => prev?.screenStream ? { ...prev, isWatchingScreen: true, screenViewers: prev.screenViewers?.some((user) => user.id === currentUser.id) ? prev.screenViewers : [...(prev.screenViewers || []), currentUser] } : prev);
  const stopWatchingScreen = () => setActiveCall((prev) => prev ? { ...prev, isWatchingScreen: false, screenViewers: (prev.screenViewers || []).filter((user) => user.id !== currentUser.id) } : null);

  const toggleMinimizeCall = () => {
    setActiveCall((prev) => (prev ? { ...prev, isMinimized: !prev.isMinimized } : null));
  };

  const setCallLayout = (layout: 'grid' | 'spotlight' | 'audio-only') => {
    setActiveCall((prev) => (prev ? { ...prev, layout } : null));
  };

  const switchCallChannel = (channel: Channel) => {
    if (!activeCall) return;
    startCall(channel, activeCall.type, activeCall.isDeafened);
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        updateCurrentUser,
        isLoggedIn,
        setIsLoggedIn,
        createCommunity,
        joinCommunityByInvite,
        communities,
        currentCommunityId,
        setCurrentCommunityId,
        currentChannelId,
        setCurrentChannelId,
        isDirectMessages,
        setIsDirectMessages,
        activeDmId,
        setActiveDmId,
        dms,
        toggleArchiveDm,
        openDirectMessage,
        createChannel,
        updateCommunity,
        updateChannel,
        deleteChannel,
        removeCommunity,
        messages,
        sendMessage,
        editMessage,
        deleteMessage,
        toggleReaction,
        togglePinMessage,
        isTyping,
        typingUser,
        simulateTyping,
        isColumn1Collapsed,
        setIsColumn1Collapsed,
        isContextPanelOpen,
        setIsContextPanelOpen,
        contextPanelUser,
        openUserProfile,
        openMembersPanel,
        closeContextPanel,
        isProfileEditorOpen,
        setIsProfileEditorOpen,
        isThemeCustomizerOpen,
        setIsThemeCustomizerOpen,
        isCreateChannelModalOpen,
        setIsCreateChannelModalOpen,
        activeCall,
        pendingCallSwitch: pendingCallRequest !== null,
        confirmCallSwitch,
        cancelCallSwitch,
        startCall,
        startDirectCall,
        leaveCall,
        toggleMute,
        toggleDeafen,
        toggleCamera,
        toggleScreenShare,
        watchScreen,
        stopWatchingScreen,
        toggleMinimizeCall,
        setCallLayout,
        switchCallChannel,
        moveVoiceUser,
        syncVoiceParticipants,
        theme,
        updateTheme,
        resetTheme,
        toasts,
        addToast,
        removeToast,
        pauseToast,
        resumeToast,
        notify,
        markNotificationsRead,
        lastReadAtByChannel,
        markChannelRead,
        activeUserMenu,
        openUserMenu,
        closeUserMenu,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};



