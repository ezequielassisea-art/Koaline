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
  createCommunity: (input: { name: string; icon?: string; visibility: 'public' | 'private' }) => Promise<Community | null>;
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
  createChannel: (name: string, type: 'text' | 'voice', categoryId: string) => Promise<void>;
  updateCommunity: (id: string, updates: Partial<Community>) => void;
  updateChannel: (id: string, updates: Partial<Channel>) => void;
  deleteChannel: (id: string) => boolean;
  removeCommunity: (id: string) => void;

  // Messaging
  messages: Record<string, Message[]>;
  sendMessage: (content: string, replyTo?: Message['replyTo'], attachments?: Message['attachments']) => void;
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
  const [communities, setCommunities] = useState<Community[]>([]);
  const [currentCommunityId, setCurrentCommunityId] = useState<string>('');
  const [currentChannelId, setCurrentChannelId] = useState<string>('');
  const [isDirectMessages, setIsDirectMessages] = useState<boolean>(false);
  const [activeDmId, setActiveDmId] = useState<string | null>(null);
  const [dms, setDms] = useState<DirectMessageConversation[]>([]);
  const [members, setMembers] = useState<Array<{id:string;communityId:string;userId:string;role:'owner'|'admin'|'moderator'|'member';joinedAt:string}>>(() => { try { return JSON.parse(localStorage.getItem('koaline:members') || '[]'); } catch { return []; } });
  const [flatChannels, setFlatChannels] = useState<Array<{id:string;communityId:string;name:string;type:'text'|'voice';category:string;position:number;isPrivate:boolean;isArchived:boolean;createdAt:string}>>(() => { try { return JSON.parse(localStorage.getItem('koaline:channels') || '[]'); } catch { return []; } });
  const [invites, setInvites] = useState<unknown[]>(() => { try { return JSON.parse(localStorage.getItem('koaline:invites') || '[]'); } catch { return []; } });
  const [logs, setLogs] = useState<unknown[]>(() => { try { return JSON.parse(localStorage.getItem('koaline:logs') || '[]'); } catch { return []; } });
  const [messages, setMessages] = useState<Record<string, Message[]>>({});

  // Load community and channel state from Supabase. The browser only keeps navigation preferences.
  useEffect(() => {
    let cancelled = false;
    const loadCommunities = async () => {
      if (!supabase || !isLoggedIn || !currentUser.id) {
        setCommunities([]); setMembers([]); setFlatChannels([]); setMessages({});
        return;
      }
      const sb = supabase; // TypeScript narrow
      try {
        const membershipResult = await sb.from('community_members').select('community_id,role,joined_at').eq('user_id', currentUser.id);
        if (membershipResult.error) throw membershipResult.error;
        const memberships = membershipResult.data || [];
        const ids = memberships.map((row) => row.community_id as string);
        if (!ids.length) {
          if (!cancelled) { setCommunities([]); setMembers([]); setFlatChannels([]); }
          return;
        }
        const [communityResult, categoryResult, channelResult] = await Promise.all([
          sb.from('communities').select('id,name,description,icon_url,visibility,created_by,owner_id,created_at').in('id', ids).order('created_at'),
          sb.from('community_categories').select('id,community_id,name,position').in('community_id', ids).order('position'),
          sb.from('channels').select('id,community_id,category_id,name,type,topic,position,is_private,is_archived,is_default,created_by').in('community_id', ids).order('position'),
        ]);
        if (communityResult.error) throw communityResult.error;
        if (categoryResult.error) throw categoryResult.error;
        if (channelResult.error) throw channelResult.error;
        const nextCommunities: Community[] = (communityResult.data || []).map((row) => {
          const categories = (categoryResult.data || []).filter((category) => category.community_id === row.id).map((category) => ({ id: category.id, communityId: category.community_id, name: category.name }));
          const channels = (channelResult.data || []).filter((channel) => channel.community_id === row.id).map((channel) => ({ id: channel.id, communityId: channel.community_id, name: channel.name, topic: channel.topic, type: channel.type as 'text'|'voice', categoryId: channel.category_id || categories[0]?.id || '', isPrivate: channel.is_private, isArchived: channel.is_archived, isDefault: channel.is_default, ownerId: channel.created_by || undefined, connectedUsers: channel.type === 'voice' ? [] : undefined }));
          const membership = memberships.find((item) => item.community_id === row.id);
          return { id: row.id, name: row.name, tagline: '', description: row.description || '', icon: row.icon_url || '◇', visibility: row.visibility, ownerId: row.owner_id || row.created_by, creatorId: row.created_by, createdAt: row.created_at, membersCount: 1, categories, channels };
        });
        if (!cancelled) {
          setCommunities(nextCommunities);
          setMembers(memberships.map((item) => ({ id: `${item.community_id}:${currentUser.id}`, communityId: item.community_id, userId: currentUser.id, role: item.role, joinedAt: item.joined_at })));
          setFlatChannels((channelResult.data || []).map((channel) => ({ id: channel.id, communityId: channel.community_id, name: channel.name, type: channel.type as 'text'|'voice', category: categoryResult.data?.find((category) => category.id === channel.category_id)?.name || 'Geral', position: channel.position, isPrivate: channel.is_private, isArchived: channel.is_archived, createdAt: '' })));
          if (!currentCommunityId || !nextCommunities.some((community) => community.id === currentCommunityId)) {
            const firstCommunity = nextCommunities[0];
            setCurrentCommunityId(firstCommunity?.id || '');
            setCurrentChannelId(getDefaultTextChannel(firstCommunity)?.id || '');
          } else {
            const selectedCommunity = nextCommunities.find((community) => community.id === currentCommunityId);
            if (!selectedCommunity?.channels.some((channel) => channel.id === currentChannelId)) setCurrentChannelId(getDefaultTextChannel(selectedCommunity)?.id || '');
          }
        }
      } catch (error) {
        if (!cancelled) addToast('Falha ao carregar comunidades', error instanceof Error ? error.message : 'Verifique as permissões e o schema do Supabase.', 'error');
      }
    };
    void loadCommunities();
    return () => { cancelled = true; };
  }, [isLoggedIn, currentUser.id]);

  useEffect(() => {
    if (!supabase || !isLoggedIn || !currentUser.id) { setDms([]); return; }
    const sb = supabase; // TypeScript narrow
    let cancelled = false;
    const loadDms = async () => {
      const { data: mine, error: mineError } = await sb.from('direct_conversation_members').select('conversation_id').eq('user_id', currentUser.id);
      if (mineError) throw mineError;
      const conversationIds = (mine || []).map((row) => row.conversation_id as string);
      if (!conversationIds.length) { if (!cancelled) setDms([]); return; }
      const [memberResult, messageResult] = await Promise.all([
        sb.from('direct_conversation_members').select('conversation_id,user_id').in('conversation_id', conversationIds),
        sb.from('direct_messages').select('conversation_id,content,created_at').in('conversation_id', conversationIds).order('created_at', { ascending: false }),
      ]);
      if (memberResult.error) throw memberResult.error;
      if (messageResult.error) throw messageResult.error;
      const peerIds = [...new Set((memberResult.data || []).filter((row) => row.user_id !== currentUser.id).map((row) => row.user_id))];
      const profileResult = peerIds.length ? await sb.from('profiles').select('id,username,full_name,avatar_url').in('id', peerIds) : { data: [], error: null };
      if (profileResult.error) throw profileResult.error;
      const profiles = new Map((profileResult.data || []).map((profile) => [profile.id, profile]));
      const nextDms = conversationIds.flatMap((id) => {
        const peerId = memberResult.data?.find((row) => row.conversation_id === id && row.user_id !== currentUser.id)?.user_id;
        const profile = peerId && profiles.get(peerId);
        if (!peerId || !profile) return [];
        const lastMessage = messageResult.data?.find((row) => row.conversation_id === id);
        const user: User = { ...EMPTY_USER, id: peerId, name: profile.full_name || profile.username || 'Usuário', handle: profile.username || '', avatar: profile.avatar_url || '' };
        return [{ id, user, lastMessage: lastMessage?.content || '', lastMessageTime: lastMessage?.created_at || '', unread: false, isArchived: false }];
      });
      if (!cancelled) setDms(nextDms);
    };
    void loadDms().catch((error) => { if (!cancelled) addToast('Falha ao carregar conversas', error instanceof Error ? error.message : 'Não foi possível consultar as DMs.', 'error'); });
    return () => { cancelled = true; };
  }, [isLoggedIn, currentUser.id]);

  const activeChannelKey = isDirectMessages && activeDmId ? activeDmId : currentChannelId;
  useEffect(() => {
    if (!supabase || !isLoggedIn || !currentUser.id || !activeChannelKey) return;
    const sb = supabase; // TypeScript narrow: sb é non-null aqui
    let cancelled = false;
    const isDm = isDirectMessages;

    // 1️⃣ Limpa o estado do canal atual ANTES de buscar (evita vazamento de mensagens antigas ao trocar DMs)
    setMessages((previous) => {
      const next = { ...previous };
      delete next[activeChannelKey];
      return next;
    });

    const loadMessages = async () => {
      const query = isDm
        ? sb.from('direct_messages').select('*').eq('conversation_id', activeChannelKey).order('created_at', { ascending: true }).limit(200)
        : sb.from('messages').select('*').eq('channel_id', activeChannelKey).order('created_at', { ascending: true }).limit(200);
      const { data, error } = await query;
      if (error) throw error;
      const rows = data || [];
      const authorIds = [...new Set(rows.map((row) => row.author_id as string))];
      const profileResult = authorIds.length ? await sb.from('profiles').select('id,username,full_name,avatar_url').in('id', authorIds) : { data: [], error: null };
      if (profileResult.error) throw profileResult.error;
      const profiles = new Map((profileResult.data || []).map((profile) => [profile.id, profile]));
      const reactionResult = !isDm && rows.length ? await sb.from('message_reactions').select('message_id,user_id,emoji').in('message_id', rows.map((row) => row.id)) : { data: [], error: null };
      if (reactionResult.error) throw reactionResult.error;
      const mapped: Message[] = rows.map((row) => {
        const profile = profiles.get(row.author_id);
        const messageReactions = (reactionResult.data || []).filter((reaction) => reaction.message_id === row.id);
        const reactions = [...new Set(messageReactions.map((reaction) => reaction.emoji))].map((emoji) => {
          const users = messageReactions.filter((reaction) => reaction.emoji === emoji).map((reaction) => reaction.user_id);
          return { emoji, users, count: users.length };
        });
        const reply = rows.find((candidate) => candidate.id === row.reply_to);
        const replyProfile = reply && profiles.get(reply.author_id);
        return { id: row.id, channelId: activeChannelKey, senderId: row.author_id, sender: { ...EMPTY_USER, id: row.author_id, name: profile?.full_name || profile?.username || 'Usuário', handle: profile?.username || '', avatar: profile?.avatar_url || '' }, content: row.deleted_at ? 'Mensagem apagada' : row.content, timestamp: row.created_at, edited: Boolean(row.edited_at), isDeleted: Boolean(row.deleted_at), pinned: Boolean(row.pinned), reactions, attachments: row.attachments || [], replyTo: reply ? { id: reply.id, senderName: replyProfile?.full_name || replyProfile?.username || 'Usuário', content: reply.content } : undefined };
      });
      if (!cancelled) setMessages((previous) => ({ ...previous, [activeChannelKey]: mapped }));
    };
    loadMessages().catch((error) => { if (!cancelled) addToast('Falha ao carregar mensagens', error instanceof Error ? error.message : 'Não foi possível consultar o histórico.', 'error'); });
    const table = isDm ? 'direct_messages' : 'messages';
    const filter = isDm ? `conversation_id=eq.${activeChannelKey}` : `channel_id=eq.${activeChannelKey}`;
    const subscription = sb.channel(`chat:${table}:${activeChannelKey}`).on('postgres_changes', { event: '*', schema: 'public', table, filter }, () => { loadMessages().catch(() => undefined); }).subscribe();
    return () => { cancelled = true; void sb.removeChannel(subscription); };
  }, [isLoggedIn, currentUser.id, activeChannelKey, isDirectMessages]);
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

  // Chat content is fetched from Supabase and kept only in memory.
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

  const createCommunity = async ({ name, icon = '', visibility }: { name: string; icon?: string; visibility: 'public' | 'private' }): Promise<Community | null> => {
    if (!supabase || !currentUser.id || !name.trim()) return null;
    try {
      const slug = `${name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${crypto.randomUUID().slice(0, 6)}`;
      const { data, error } = await supabase.rpc('create_orbit_community', { p_name: name.trim(), p_slug: slug, p_description: '', p_banner_url: null });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as { id: string; created_at: string; created_by: string } | null;
      if (!row?.id) throw new Error('O Supabase não retornou a comunidade criada.');
      const { error: communityUpdateError } = await supabase.from('communities').update({ visibility, icon_url: icon.startsWith('http') ? icon : null }).eq('id', row.id);
      if (communityUpdateError) throw communityUpdateError;
      const { data: category, error: categoryError } = await supabase.from('community_categories').insert({ community_id: row.id, name: 'Geral', position: 0 }).select('id').single();
      if (categoryError) throw categoryError;
      const { data: channelRows, error: channelError } = await supabase.from('channels').insert([
        { community_id: row.id, category_id: category.id, name: 'geral', type: 'text', position: 0, is_default: true, created_by: currentUser.id },
        { community_id: row.id, category_id: category.id, name: 'Sala de voz', type: 'voice', position: 1, created_by: currentUser.id },
      ]).select('id,community_id,category_id,name,type,topic,position,is_private,is_archived,is_default,created_by');
      if (channelError) throw channelError;
      const community: Community = { id: row.id, name: name.trim(), icon: icon.startsWith('http') ? icon : '◇', tagline: '', description: '', visibility, ownerId: currentUser.id, creatorId: currentUser.id, createdAt: row.created_at, membersCount: 1, categories: [{ id: category.id, communityId: row.id, name: 'Geral' }], channels: (channelRows || []).map((channel) => ({ id: channel.id, communityId: row.id, name: channel.name, type: channel.type as 'text'|'voice', categoryId: channel.category_id || '', topic: channel.topic, isDefault: channel.is_default, ownerId: channel.created_by || undefined, connectedUsers: channel.type === 'voice' ? [] : undefined })) };
      setCommunities((previous) => [...previous, community]);
      setMembers((previous) => [...previous, { id: `${row.id}:${currentUser.id}`, communityId: row.id, userId: currentUser.id, role: 'admin', joinedAt: row.created_at }]);
      setCurrentCommunityId(row.id); setCurrentChannelId(community.channels[0]?.id || ''); setIsDirectMessages(false);
      addToast('Comunidade criada', 'A comunidade e seus canais foram salvos.', 'success');
      return community;
    } catch (error) {
      addToast('Não foi possível criar a comunidade', error instanceof Error ? error.message : 'Verifique as permissões do Supabase.', 'error');
      return null;
    }
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
    setIsDirectMessages(true);
    setIsColumn1Collapsed(false);
    if (!supabase || !currentUser.id || !user.id) { addToast('DM indisponível', 'Entre com uma conta para abrir uma conversa.', 'error'); return; }
    const existing = dms.find((dm) => dm.user.id === user.id);
    if (existing) { setActiveDmId(existing.id); setDms((prev) => prev.map((dm) => dm.id === existing.id ? { ...dm, isArchived: false } : dm)); return; }
    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_or_create_direct_conversation', { p_other_user: user.id });
        if (error) throw error;
        const conversationId = String(data || '');
        if (!conversationId) throw new Error('O banco não retornou o identificador da conversa.');
        setDms((prev) => [...prev.filter((dm) => dm.id !== conversationId), { id: conversationId, user, lastMessage: '', lastMessageTime: '', unread: false, isArchived: false }]);
        setActiveDmId(conversationId);
      } catch (error: unknown) {
        setIsDirectMessages(false);
        addToast('Não foi possível abrir a DM', error instanceof Error ? error.message : 'Aplique a atualização de conversas diretas no Supabase.', 'error');
      }
    })();
  };

  const createChannel = async (name: string, type: 'text' | 'voice', categoryId: string) => {
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
    if (!supabase || !currentUser.id) { addToast('Supabase indisponível', 'Entre novamente para criar canais no banco.', 'error'); return; }
    const { data: insertedChannel, error } = await supabase.from('channels').insert({ community_id: currentCommunityId, category_id: categoryId || null, name: cleanName, type, topic: `Canal ${type === 'voice' ? 'de voz' : 'de texto'} criado recentemente`, position: activeCommunity?.channels.length || 0, created_by: currentUser.id }).select('id').single();
    if (error) { addToast('Não foi possível criar o canal', error.message, 'error'); return; }
    const newChan: Channel = {
      id: insertedChannel.id,
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
    addToast('Canal Criado', `#${cleanName} foi salvo no Supabase.`, 'success');
  };

  const updateCommunity = (id: string, updates: Partial<Community>) => {
    if (supabase) {
      const payload: Record<string, unknown> = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.description !== undefined) payload.description = updates.description;
      if (updates.banner !== undefined) payload.banner_url = updates.banner;
      if (updates.icon !== undefined) payload.icon_url = updates.icon;
      if (updates.visibility !== undefined) payload.visibility = updates.visibility;
      if (Object.keys(payload).length) void supabase.from('communities').update(payload).eq('id', id).then(({ error }) => { if (error) addToast('Alterações não salvas', error.message, 'error'); });
    }
    setCommunities((prev) => prev.map((community) => community.id === id ? { ...community, ...updates } : community));
  };

  const updateChannel = (id: string, updates: Partial<Channel>) => {
    if (supabase) {
      const payload: Record<string, unknown> = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.topic !== undefined) payload.topic = updates.topic;
      if (updates.categoryId !== undefined) payload.category_id = updates.categoryId || null;
      if (updates.isPrivate !== undefined) payload.is_private = updates.isPrivate;
      if (updates.isArchived !== undefined) payload.is_archived = updates.isArchived;
      if (updates.isDefault !== undefined) payload.is_default = updates.isDefault;
      if (Object.keys(payload).length) void supabase.from('channels').update(payload).eq('id', id).then(({ error }) => { if (error) addToast('Canal não atualizado', error.message, 'error'); });
    }
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

    if (supabase) void supabase.from('channels').delete().eq('id', id).then(({ error }) => { if (error) addToast('Canal não excluído no banco', error.message, 'error'); });

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
    if (supabase) void supabase.from('communities').delete().eq('id', id).then(({ error }) => { if (error) addToast('Comunidade não excluída no banco', error.message, 'error'); });
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

  const sendMessage = (
    content: string,
    replyTo?: Message['replyTo'],
    attachments?: Message['attachments']
  ) => {
    if (!supabase || !currentUser.id || !activeChannelKey || (!content.trim() && (!attachments || attachments.length === 0))) return;
    const sb = supabase; // TypeScript narrow

    const newMessage: Message = {
      id: `pending-${crypto.randomUUID()}`,
      channelId: activeChannelKey,
      senderId: currentUser.id,
      sender: currentUser,
      content: content.trim(),
      timestamp: new Date().toISOString(),
      reactions: [],
      replyTo,
      attachments,
    };

    setMessages((prev) => ({ ...prev, [activeChannelKey]: [...(prev[activeChannelKey] || []), newMessage] }));
    (async () => {
      const table = isDirectMessages ? 'direct_messages' : 'messages';
      const payload = isDirectMessages
        ? { conversation_id: activeChannelKey, author_id: currentUser.id, content: content.trim(), attachments: attachments || [], reply_to: replyTo?.id || null }
        : { channel_id: activeChannelKey, author_id: currentUser.id, content: content.trim(), attachments: attachments || [], reply_to: replyTo?.id || null };
      const { data, error } = await sb.from(table).insert(payload as any).select('id,created_at').single();
      if (error) {
        setMessages((prev) => ({ ...prev, [activeChannelKey]: (prev[activeChannelKey] || []).filter((message) => message.id !== newMessage.id) }));
        addToast('Mensagem não enviada', error.message, 'error');
        return;
      }
      setMessages((prev) => ({ ...prev, [activeChannelKey]: (prev[activeChannelKey] || []).map((message) => message.id === newMessage.id ? { ...message, id: data.id, timestamp: data.created_at } : message) }));
    })();
    if (isDirectMessages && activeDmId) {
      setDms((prev) => prev.map((dm) => dm.id === activeDmId
        ? { ...dm, lastMessage: content.trim() || 'Anexo', lastMessageTime: newMessage.timestamp, unread: false }
        : dm));
    }

  };

  const editMessage = (messageId: string, newContent: string) => {
    if (!supabase) return;
    const table = isDirectMessages ? 'direct_messages' : 'messages';
    void supabase.from(table).update({ content: newContent, edited_at: new Date().toISOString() }).eq('id', messageId).then(({ error }) => {
      if (error) { addToast('Mensagem não editada', error.message, 'error'); return; }
      setMessages((prev) => ({ ...prev, [activeChannelKey]: (prev[activeChannelKey] || []).map((message) => message.id === messageId ? { ...message, content: newContent, edited: true } : message) }));
    });
  };

  const deleteMessage = (messageId: string) => {
    if (!supabase) return;
    const table = isDirectMessages ? 'direct_messages' : 'messages';
    void supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq('id', messageId).then(({ error }) => {
      if (error) { addToast('Mensagem não apagada', error.message, 'error'); return; }
      setMessages((prev) => ({ ...prev, [activeChannelKey]: (prev[activeChannelKey] || []).map((message) => message.id === messageId ? { ...message, isDeleted: true, content: 'Mensagem apagada' } : message) }));
    });
    addToast('Mensagem Apagada', 'Mensagem removida.');
  };

  const toggleReaction = (messageId: string, emoji: string) => {
    if (!supabase || isDirectMessages || !currentUser.id) return;
    const currentMessage = (messages[activeChannelKey] || []).find((message) => message.id === messageId);
    const alreadyReacted = currentMessage?.reactions.some((reaction) => reaction.emoji === emoji && reaction.users.includes(currentUser.id));
    const request = alreadyReacted
      ? supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', currentUser.id).eq('emoji', emoji)
      : supabase.from('message_reactions').insert({ message_id: messageId, user_id: currentUser.id, emoji });
    void request.then(({ error }) => { if (error) addToast('Reação não salva', error.message, 'error'); });
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
    if (!supabase) return;
    const message = (messages[activeChannelKey] || []).find((item) => item.id === messageId);
    void supabase.from('messages').update({ pinned: !message?.pinned }).eq('id', messageId).then(({ error }) => { if (error) addToast('Não foi possível fixar', error.message, 'error'); });
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



