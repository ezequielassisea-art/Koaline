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
import { getOrCreateConversation } from '../services/directMessageService';


const EMPTY_USER: User = { id: '', name: '', handle: '', avatar: '', status: 'offline', level: 1, xp: 0, xpMax: 100, badges: [], socials: [] };

type SupabaseMessageRow = {
  id: string;
  channel_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author?: { username?: string | null; avatar_url?: string | null } | Array<{ username?: string | null; avatar_url?: string | null }> | null;
  profiles?: { username?: string | null; avatar_url?: string | null } | Array<{ username?: string | null; avatar_url?: string | null }> | null;
  community_role?: 'admin' | 'moderator' | 'member';
};

type SupabaseCommunityRow = {
  id: string;
  name: string;
  description?: string | null;
  banner_url?: string | null;
  created_by: string;
  created_at: string;
};

type SupabaseChannelRow = {
  id: string;
  community_id: string;
  name: string;
  type: 'text' | 'voice';
  created_at?: string;
};

const toCommunityChannel = (row: SupabaseChannelRow, categoryId: string, ownerId?: string): Channel => ({
  id: row.id,
  communityId: row.community_id,
  name: row.name,
  type: row.type,
  categoryId,
  ownerId,
  connectedUsers: row.type === 'voice' ? [] : undefined,
});

const toChatMessage = (row: SupabaseMessageRow, currentUser: User, communityRole?: 'admin' | 'moderator' | 'member'): Message => {
  const relation = row.author ?? row.profiles;
  const profile = Array.isArray(relation) ? relation[0] : relation;
  const isCurrentUser = row.author_id === currentUser.id;
  const authorName = profile?.username || (isCurrentUser ? currentUser.name : 'Usuário');
  const author: User = isCurrentUser ? currentUser : {
    ...EMPTY_USER,
    id: row.author_id,
    name: authorName,
    handle: profile?.username || '',
    avatar: profile?.avatar_url || '',
    communityRole,
    statusKnown: false,
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

const getDirectCallRoomId = (firstUserId: string, secondUserId: string) =>
  `dm-call-${[firstUserId, secondUserId].sort().join('-')}`;

type PendingCallRequest =
  | { type: 'channel'; channel: Channel; mode: 'voice' | 'video'; isDeafened: boolean }
  | { type: 'direct'; targetUser: User; mode: 'voice' | 'video' };

interface AppContextType {
  // User & Auth
  currentUser: User;
  updateCurrentUser: (updates: Partial<User>) => void;
  completeOnboarding: (updates?: Partial<User>) => Promise<boolean>;
  isLoggedIn: boolean;
  setIsLoggedIn: (val: boolean) => void;
  isAuthLoading: boolean;
  authLoadError: string | null;
  retryAuthProfileLoad: () => void;
  createCommunity: (input: { name: string; icon?: string; visibility: 'public' | 'private' }) => Promise<Community | null>;
  joinCommunityByInvite: (code: string) => boolean;
  
  // Communities & Channels
  communities: Community[];
  members: Array<{id:string;communityId:string;userId:string;role:'owner'|'admin'|'moderator'|'member';joinedAt:string}>;
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
  isDmLoading: boolean;
  openDirectMessage: (user: User) => Promise<void>;
  createChannel: (name: string, type: 'text' | 'voice', categoryId: string) => Promise<boolean>;
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
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authLoadError, setAuthLoadError] = useState<string | null>(null);
  const [profileLoadAttempt, setProfileLoadAttempt] = useState(0);
  const lastProfileUserIdRef = useRef('');
  const retryAuthProfileLoad = () => {
    lastProfileUserIdRef.current = '';
    setAuthLoadError(null);
    setIsAuthLoading(true);
    setProfileLoadAttempt((attempt) => attempt + 1);
  };

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setLoggedIn(false);
      setCurrentUser(EMPTY_USER);
      setIsAuthLoading(false);
      return;
    }

    let active = true;
    let requestId = 0;
    const applySession = async (session: Awaited<ReturnType<typeof client.auth.getSession>>['data']['session']) => {
      const currentRequestId = ++requestId;
      const authUser = session?.user;
      if (!authUser) {
        lastProfileUserIdRef.current = '';
        setLoggedIn(false);
        setCurrentUser(EMPTY_USER);
        setAuthLoadError(null);
        setIsAuthLoading(false);
        return;
      }

      if (lastProfileUserIdRef.current === authUser.id) {
        setLoggedIn(true);
        setIsAuthLoading(false);
        return;
      }

      const metadata = authUser.user_metadata || {};
      setLoggedIn(true);
      setAuthLoadError(null);
      setIsAuthLoading(true);
      setCurrentUser((previous) => ({
        ...previous,
        id: authUser.id,
        email: authUser.email || '',
        name: String(metadata.full_name || metadata.name || previous.name || authUser.email?.split('@')[0] || 'Usuário'),
        handle: String(metadata.username || metadata.user_name || previous.handle || authUser.email?.split('@')[0] || ''),
        avatar: String(metadata.avatar_url || metadata.picture || previous.avatar || ''),
        onboarding_completed: undefined,
      }));

      try {
        const selected = await client.from('profiles')
          .select('id,username,full_name,avatar_url,onboarding_completed')
          .eq('id', authUser.id)
          .maybeSingle();
        if (selected.error) throw selected.error;

        let profile = selected.data;
        if (!profile) {
          const inserted = await client.from('profiles').upsert({
            id: authUser.id,
            username: String(metadata.username || metadata.user_name || authUser.email?.split('@')[0] || ''),
            full_name: String(metadata.full_name || metadata.name || authUser.email?.split('@')[0] || 'Usuário'),
            avatar_url: String(metadata.avatar_url || metadata.picture || '') || null,
            onboarding_completed: false,
          }, { onConflict: 'id' }).select('id,username,full_name,avatar_url,onboarding_completed').single();
          if (inserted.error) throw inserted.error;
          profile = inserted.data;
        }

        if (!active || currentRequestId !== requestId) return;
        lastProfileUserIdRef.current = authUser.id;
        setCurrentUser((previous) => ({
          ...previous,
          id: authUser.id,
          email: authUser.email || '',
          name: String(profile.full_name || metadata.full_name || metadata.name || authUser.email?.split('@')[0] || 'Usuário'),
          handle: String(profile.username || metadata.username || metadata.user_name || authUser.email?.split('@')[0] || ''),
          avatar: String(profile.avatar_url || metadata.avatar_url || metadata.picture || ''),
          onboarding_completed: profile.onboarding_completed === true,
        }));
        setIsAuthLoading(false);
      } catch (error) {
        if (!active || currentRequestId !== requestId) return;
        setAuthLoadError(error instanceof Error ? error.message : 'Não foi possível carregar seu perfil.');
        setIsAuthLoading(false);
      }
    };

    void client.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setAuthLoadError(error.message);
        setIsAuthLoading(false);
        return;
      }
      void applySession(data.session);
    }).catch((error: unknown) => {
      if (!active) return;
      setAuthLoadError(error instanceof Error ? error.message : 'Não foi possível verificar a sessão.');
      setIsAuthLoading(false);
    });

    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'TOKEN_REFRESHED' && session?.user.id === lastProfileUserIdRef.current) return;
      window.setTimeout(() => { if (active) void applySession(session); }, 0);
    });
    return () => {
      active = false;
      requestId += 1;
      subscription.unsubscribe();
    };
  }, [profileLoadAttempt]);

  // Navigation
  const [communities, setCommunities] = useState<Community[]>([]);
  const [currentCommunityId, setCurrentCommunityId] = useState<string>('');
  const [currentChannelId, setCurrentChannelId] = useState<string>('');
  const [isDirectMessages, setIsDirectMessages] = useState<boolean>(false);
  const [activeDmId, setActiveDmId] = useState<string | null>(null);
  const [isDmLoading, setIsDmLoading] = useState<boolean>(false);
  const [dms, setDms] = useState<DirectMessageConversation[]>([]);
  const [members, setMembers] = useState<Array<{id:string;communityId:string;userId:string;role:'owner'|'admin'|'moderator'|'member';joinedAt:string}>>([]);
  const [invites, setInvites] = useState<unknown[]>(() => { try { return JSON.parse(localStorage.getItem('koaline:invites') || '[]'); } catch { return []; } });
  const [logs, setLogs] = useState<unknown[]>(() => { try { return JSON.parse(localStorage.getItem('koaline:logs') || '[]'); } catch { return []; } });
  const [messages, setMessages] = useState<Record<string, Message[]>>({});

  useEffect(() => {
    try {
      localStorage.setItem('koaline:invites', JSON.stringify(invites));
      localStorage.setItem('koaline:logs', JSON.stringify(logs));
    } catch {}
  }, [invites, logs]);
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

  const currentChannelCommunityId = communities.find((community) => community.channels.some((channel) => channel.id === currentChannelId))?.id || '';

  // Text channel messages are loaded from Supabase and kept current through Realtime.
  useEffect(() => {
    const client = supabase;
    if (!client || !isLoggedIn || !currentChannelId || isDirectMessages) return;

    let active = true;
    setMessages((previous) => ({ ...previous, [currentChannelId]: [] }));

    const loadMessages = async () => {
      const { data, error } = await client
        .from('messages')
        .select('*, author:profiles!messages_author_id_fkey(username, avatar_url)')
        .eq('channel_id', currentChannelId)
        .order('created_at', { ascending: true });

      if (!active) return;
      if (error) {
        addToast('Não foi possível carregar as mensagens', error.message, 'error');
        return;
      }

      const rows = (data || []) as SupabaseMessageRow[];
      const authorIds = [...new Set(rows.map((row) => row.author_id).filter(Boolean))];
      let roleByUserId = new Map<string, 'admin' | 'moderator' | 'member'>();
      if (currentChannelCommunityId && authorIds.length) {
        const rolesResult = await client.from('community_members').select('user_id,role').eq('community_id', currentChannelCommunityId).in('user_id', authorIds);
        if (!rolesResult.error) roleByUserId = new Map((rolesResult.data || []).map((row) => [row.user_id as string, row.role as 'admin' | 'moderator' | 'member']));
      }
      if (!active) return;
      const loadedMessages = rows.map((row) => toChatMessage(row, currentUser, roleByUserId.get(row.author_id)));
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
        void (async () => {
          const [profileResult, roleResult] = await Promise.all([
            client.from('profiles').select('username,avatar_url').eq('id', row.author_id).maybeSingle(),
            currentChannelCommunityId
              ? client.from('community_members').select('role').eq('community_id', currentChannelCommunityId).eq('user_id', row.author_id).maybeSingle()
              : Promise.resolve({ data: null, error: null }),
          ]);
          if (!active) return;
          const enrichedRow: SupabaseMessageRow = {
            ...row,
            profiles: profileResult.data,
            community_role: roleResult.data?.role as 'admin' | 'moderator' | 'member' | undefined,
          };
          const message = toChatMessage(enrichedRow, currentUser, enrichedRow.community_role);
          setMessages((previous) => {
            const channelMessages = previous[currentChannelId] || [];
            if (channelMessages.some((item) => item.id === message.id)) return previous;
            return { ...previous, [currentChannelId]: [...channelMessages, message] };
          });
        })().catch(() => {
          if (!active) return;
          const message = toChatMessage(row, currentUser);
          setMessages((previous) => ({ ...previous, [currentChannelId]: previous[currentChannelId]?.some((item) => item.id === message.id) ? previous[currentChannelId] : [...(previous[currentChannelId] || []), message] }));
        });
      })
      .subscribe();

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [currentChannelId, currentChannelCommunityId, currentUser, isDirectMessages, isLoggedIn]);

  // Direct Messages (DMs) loaded from Supabase and kept current through Realtime.
  useEffect(() => {
    const client = supabase;
    if (!client || !isLoggedIn || !isDirectMessages || !activeDmId) return;

    let active = true;

    const loadDmMessages = async () => {
      try {
        const { data, error } = await client
          .from('direct_messages')
          .select('*')
          .eq('conversation_id', activeDmId)
          .order('created_at', { ascending: true });

        if (!active || error) return;

        const rows = (data || []) as Array<{ id: string; conversation_id: string; sender_id?: string; author_id?: string; content: string; created_at: string }>;
        const userIds = [...new Set(rows.map((r) => r.sender_id || r.author_id).filter(Boolean))] as string[];

        const profileMap = new Map<string, { username?: string | null; avatar_url?: string | null }>();
        if (userIds.length > 0) {
          const { data: profData } = await client.from('profiles').select('id, username, avatar_url').in('id', userIds);
          (profData || []).forEach((p) => profileMap.set(p.id, { username: p.username, avatar_url: p.avatar_url }));
        }

        if (!active) return;
        const loadedMessages: Message[] = rows.map((r) => {
          const senderId = r.sender_id || r.author_id || '';
          const prof = profileMap.get(senderId);
          const isMe = senderId === currentUser.id;
          const senderUser: User = isMe
            ? currentUser
            : {
                ...currentUser,
                id: senderId,
                name: prof?.username || 'Membro Koaline',
                handle: prof?.username || 'koaline',
                avatar: prof?.avatar_url || '',
                status: 'online',
              };

          return {
            id: r.id,
            channelId: activeDmId,
            senderId,
            sender: senderUser,
            content: r.content,
            timestamp: r.created_at,
            reactions: [],
          };
        });

        if (loadedMessages.length > 0) {
          setMessages((previous) => ({
            ...previous,
            [activeDmId]: loadedMessages,
          }));
        }
      } catch {
        // Fallback gracioso
      }
    };

    void loadDmMessages();

    const dmChannel = client
      .channel(`direct_messages:${activeDmId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `conversation_id=eq.${activeDmId}`,
      }, (payload) => {
        const row = payload.new as { id: string; conversation_id: string; sender_id?: string; author_id?: string; content: string; created_at: string };
        if (!active || !row?.id) return;
        const senderId = row.sender_id || row.author_id || '';
        if (senderId === currentUser.id) return;

        void (async () => {
          const { data: prof } = await client.from('profiles').select('username, avatar_url').eq('id', senderId).maybeSingle();
          if (!active) return;
          const senderUser: User = {
            ...currentUser,
            id: senderId,
            name: prof?.username || 'Membro Koaline',
            handle: prof?.username || 'koaline',
            avatar: prof?.avatar_url || '',
            status: 'online',
          };
          const newMsg: Message = {
            id: row.id,
            channelId: activeDmId,
            senderId,
            sender: senderUser,
            content: row.content,
            timestamp: row.created_at,
            reactions: [],
          };
          setMessages((previous) => {
            const currentMsgs = previous[activeDmId] || [];
            if (currentMsgs.some((m) => m.id === newMsg.id)) return previous;
            return { ...previous, [activeDmId]: [...currentMsgs, newMsg] };
          });
          setDms((previous) =>
            previous.map((dm) =>
              dm.id === activeDmId
                ? { ...dm, lastMessage: row.content, lastMessageTime: 'Agora', unread: true }
                : dm
            )
          );
        })();
      })
      .subscribe();

    return () => {
      active = false;
      void client.removeChannel(dmChannel);
    };
  }, [activeDmId, isDirectMessages, isLoggedIn, currentUser]);

  // Carrega lista de conversas diretas do usuário do Supabase
  useEffect(() => {
    const client = supabase;
    if (!client || !isLoggedIn || !currentUser.id) return;
    let active = true;

    const loadUserConversations = async () => {
      try {
        const { data: myMembers, error: memError } = await client
          .from('direct_conversation_members')
          .select('conversation_id')
          .eq('user_id', currentUser.id);

        if (memError || !myMembers?.length) return;
        const convIds = myMembers.map((m) => m.conversation_id).filter(Boolean);

        const { data: otherMembers, error: otherError } = await client
          .from('direct_conversation_members')
          .select('conversation_id, user_id')
          .in('conversation_id', convIds)
          .neq('user_id', currentUser.id);

        if (otherError || !otherMembers?.length) return;
        const otherUserIds = [...new Set(otherMembers.map((m) => m.user_id))];

        const { data: profiles } = await client
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', otherUserIds);

        if (!active) return;
        const profMap = new Map((profiles || []).map((p) => [p.id, p]));

        const loadedDms: DirectMessageConversation[] = otherMembers.map((m) => {
          const prof = profMap.get(m.user_id);
          const name = prof?.username || 'Membro Koaline';
          const user: User = {
            id: m.user_id,
            name,
            handle: prof?.username || 'koaline',
            avatar: prof?.avatar_url || '',
            status: 'offline',
            level: 1,
            xp: 0,
            xpMax: 100,
            badges: [],
            socials: [],
          };
          return {
            id: m.conversation_id,
            user,
            lastMessage: '',
            lastMessageTime: '',
            unread: false,
            isArchived: false,
          };
        });

        setDms((prev) => {
          const merged = [...prev];
          loadedDms.forEach((dm) => {
            const idx = merged.findIndex((item) => item.id === dm.id);
            if (idx >= 0) {
              merged[idx] = { ...dm, ...merged[idx], user: dm.user };
            } else {
              merged.push(dm);
            }
          });
          return merged;
        });
      } catch {
        // Silencioso
      }
    };

    void loadUserConversations();
    return () => { active = false; };
  }, [isLoggedIn, currentUser.id]);
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
  const globalPresenceChannelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);
  const [pendingCallRequest, setPendingCallRequest] = useState<PendingCallRequest | null>(null);
  const screenStreamRef = React.useRef<MediaStream | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!client || !isLoggedIn || isAuthLoading || !currentUser.id) {
      globalPresenceChannelRef.current = null;
      return;
    }

    let active = true;
    const channel = client.channel('koaline:presence:global', {
      config: { presence: { key: currentUser.id } },
    });
    globalPresenceChannelRef.current = channel;
    const applyPresence = () => {
      const presence = channel.presenceState<{ user_id?: string; status?: User['status'] }>();
      const statusById = new Map<string, User['status']>();
      Object.entries(presence).forEach(([key, entries]) => {
        const entry = entries[entries.length - 1];
        const userId = entry?.user_id || key;
        if (userId) statusById.set(userId, entry?.status === 'idle' || entry?.status === 'dnd' || entry?.status === 'offline' ? entry.status : 'online');
      });

      setDms((previous) => previous.map((dm) => ({
        ...dm,
        user: { ...dm.user, status: statusById.get(dm.user.id) || 'offline', statusKnown: true },
      })));
      setCommunities((previous) => previous.map((community) => ({
        ...community,
        channels: community.channels.map((voiceChannel) => voiceChannel.connectedUsers
          ? { ...voiceChannel, connectedUsers: voiceChannel.connectedUsers.map((user) => ({ ...user, status: statusById.get(user.id) || 'offline', statusKnown: true })) }
          : voiceChannel),
      })));
      setActiveCall((previous) => previous ? {
        ...previous,
        participants: previous.participants.map((participant) => ({
          ...participant,
          user: { ...participant.user, status: statusById.get(participant.user.id) || 'offline', statusKnown: true },
        })),
      } : previous);
    };

    channel.on('presence', { event: 'sync' }, applyPresence).subscribe(async (status) => {
      if (status !== 'SUBSCRIBED' || !active) return;
      await channel.track({
        user_id: currentUser.id,
        username: currentUser.handle || undefined,
        full_name: currentUser.name || undefined,
        avatar_url: currentUser.avatar || undefined,
        status: currentUser.status === 'idle' || currentUser.status === 'dnd' ? currentUser.status : 'online',
      });
      applyPresence();
    });

    return () => {
      active = false;
      if (globalPresenceChannelRef.current === channel) globalPresenceChannelRef.current = null;
      void client.removeChannel(channel);
    };
  }, [isLoggedIn, isAuthLoading, currentUser.id]);

  useEffect(() => {
    const channel = globalPresenceChannelRef.current;
    if (!channel || !currentUser.id) return;
    void channel.track({
      user_id: currentUser.id,
      username: currentUser.handle || undefined,
      full_name: currentUser.name || undefined,
      avatar_url: currentUser.avatar || undefined,
      status: currentUser.status === 'idle' || currentUser.status === 'dnd' ? currentUser.status : 'online',
    });
  }, [currentUser.name, currentUser.handle, currentUser.avatar, currentUser.status, currentUser.id]);

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

  const completeOnboarding = async (updates: Partial<User> = {}): Promise<boolean> => {
    const client = supabase;
    if (!client || !currentUser.id) {
      addToast('Não foi possível salvar o perfil', 'Sua sessão não está disponível. Entre novamente e tente outra vez.', 'error');
      return false;
    }

    const next = { ...currentUser, ...updates, onboarding_completed: true };
    const { data, error } = await client.from('profiles').update({
      username: next.handle.replace(/^@/, ''),
      full_name: next.name,
      avatar_url: next.avatar || null,
      onboarding_completed: true,
    }).eq('id', currentUser.id).select('onboarding_completed').single();

    if (error || data?.onboarding_completed !== true) {
      addToast('Não foi possível salvar o perfil', error?.message || 'O Supabase não confirmou a conclusão do perfil.', 'error');
      return false;
    }

    setCurrentUser(next);
    try { localStorage.setItem('koaline:current-user', JSON.stringify(next)); }
    catch { addToast('Perfil salvo', 'Seu perfil foi salvo no servidor, mas a imagem não pôde ser mantida neste dispositivo.', 'warning'); return true; }
    addToast('Perfil concluído', 'Suas preferências foram salvas.', 'success');
    return true;
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
    const cleanName = name.trim();
    const client = supabase;
    if (!client || !currentUser.id || !cleanName) {
      addToast('Não foi possível criar a comunidade', 'Entre na sua conta e informe um nome para continuar.', 'error');
      return null;
    }

    const slugBase = cleanName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'comunidade';
    const slug = `${slugBase}-${crypto.randomUUID().slice(0, 8)}`;
    const { data, error } = await client.rpc('create_orbit_community', {
      p_name: cleanName,
      p_slug: slug,
      p_description: '',
      p_banner_url: icon || null,
    });

    if (error) {
      addToast('Não foi possível criar a comunidade', error.message, 'error');
      return null;
    }

    const row = (Array.isArray(data) ? data[0] : data) as SupabaseCommunityRow | null;
    if (!row?.id) {
      addToast('Não foi possível criar a comunidade', 'O Supabase não retornou a comunidade criada.', 'error');
      return null;
    }

    const categoryId = `${row.id}:geral`;
    const defaultChannelResults = await Promise.all([
      { name: 'geral', type: 'text' as const },
      { name: 'Sala de voz', type: 'voice' as const },
    ].map(({ name: channelName, type }) => client
      .from('channels')
      .insert({ community_id: row.id, name: channelName, type })
      .select('*')
      .single()));

    const channelRows = defaultChannelResults.flatMap((result) => result.error || !result.data ? [] : [result.data as SupabaseChannelRow]);
    const channels = channelRows.map((channel) => toCommunityChannel(channel, categoryId, row.created_by));
    if (defaultChannelResults.some((result) => result.error)) {
      const channelError = defaultChannelResults.find((result) => result.error)?.error;
      addToast('Comunidade criada com aviso', `Não foi possível criar todos os canais iniciais: ${channelError?.message || 'erro desconhecido'}.`, 'warning');
    }

    const community: Community = {
      id: row.id,
      name: row.name,
      tagline: row.description || '',
      description: row.description || '',
      icon: row.banner_url || '◇',
      banner: row.banner_url || undefined,
      visibility,
      ownerId: row.created_by,
      creatorId: row.created_by,
      createdAt: row.created_at,
      membersCount: 1,
      categories: [{ id: categoryId, communityId: row.id, name: 'Geral' }],
      channels,
    };
    setCommunities((previous) => previous.some((item) => item.id === community.id) ? previous : [...previous, community]);
    setMembers((previous) => [...previous, { id: `${row.id}:${currentUser.id}`, communityId: row.id, userId: currentUser.id, role: 'admin', joinedAt: row.created_at }]);
    setLogs((previous) => [{ id: crypto.randomUUID(), communityId: row.id, userId: currentUser.id, action: 'community_created', targetId: row.id, metadata: {}, createdAt: row.created_at }, ...previous]);
    setCurrentCommunityId(row.id);
    setCurrentChannelId(channels.find((channel) => channel.type === 'text')?.id || '');
    setIsDirectMessages(false);
    addToast('Comunidade criada', `${cleanName} está pronta.`, 'success');
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

  useEffect(() => {
    const client = supabase;
    if (!client || !isLoggedIn || !currentUser.id) {
      setCommunities([]);
      setMembers([]);
      return;
    }

    let active = true;
    const loadCommunitiesAndChannels = async () => {
      try {
        const [communitiesResult, membershipResult] = await Promise.all([
          client.from('communities').select('id,name,slug,description,banner_url,created_by,created_at').order('created_at', { ascending: false }),
          client.from('community_members').select('community_id,user_id,role,joined_at').eq('user_id', currentUser.id),
        ]);
        if (communitiesResult.error) throw communitiesResult.error;
        if (membershipResult.error) throw membershipResult.error;

        const joinedIdSet = new Set((membershipResult.data || []).map((item) => item.community_id as string));
        const joinedCommunities = ((communitiesResult.data || []) as SupabaseCommunityRow[]).filter((community) => joinedIdSet.has(community.id));
        const mappedCommunities = await Promise.all(joinedCommunities.map(async (community): Promise<Community> => {
          const categoryId = `${community.id}:geral`;
          const { data, error } = await client.from('channels').select('*').eq('community_id', community.id);
          if (error) throw error;
          const channels = ((data || []) as SupabaseChannelRow[]).map((row) => toCommunityChannel(row, categoryId, community.created_by));
          return {
            id: community.id,
            name: community.name,
            tagline: community.description || '',
            description: community.description || '',
            icon: community.banner_url || '◇',
            banner: community.banner_url || undefined,
            visibility: 'public',
            ownerId: community.created_by,
            creatorId: community.created_by,
            createdAt: community.created_at,
            membersCount: 1,
            categories: [{ id: categoryId, communityId: community.id, name: 'Geral' }],
            channels,
          };
        }));
        if (!active) return;

        setMembers(((membershipResult.data || []) as Array<{ community_id: string; user_id: string; role: string; joined_at: string }>).map((row) => ({
          id: `${row.community_id}:${row.user_id}`,
          communityId: row.community_id,
          userId: row.user_id,
          role: row.role === 'admin' ? 'admin' : row.role === 'moderator' ? 'moderator' : 'member',
          joinedAt: row.joined_at,
        })));
        setCommunities(mappedCommunities);

        const selectedCommunity = mappedCommunities.find((community) => community.id === currentCommunityId) || mappedCommunities[0];
        const selectedChannel = selectedCommunity?.channels.find((channel) => channel.id === currentChannelId)
          || getDefaultTextChannel(selectedCommunity || undefined);
        setCurrentCommunityId(selectedCommunity?.id || '');
        setCurrentChannelId(selectedChannel?.id || '');
      } catch (error) {
        if (active) addToast('Não foi possível carregar as comunidades', error instanceof Error ? error.message : 'Tente novamente.', 'error');
      }
    };

    void loadCommunitiesAndChannels();
    return () => { active = false; };
  }, [isLoggedIn, currentUser.id]);

  useEffect(() => {
    const client = supabase;
    if (!client || !isLoggedIn || !currentCommunityId) return;
    const community = communities.find((item) => item.id === currentCommunityId);
    if (!community) return;

    const channel = client
      .channel(`channels:${currentCommunityId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'channels',
        filter: `community_id=eq.${currentCommunityId}`,
      }, (payload) => {
        const row = payload.new as SupabaseChannelRow;
        if (!row?.id) return;
        const newChannel = toCommunityChannel(row, community.categories[0]?.id || `${community.id}:geral`, community.ownerId);
        setCommunities((previous) => previous.map((item) => item.id !== community.id || item.channels.some((existing) => existing.id === newChannel.id)
          ? item
          : { ...item, channels: [...item.channels, newChannel] }));
      })
      .subscribe();

    return () => { void client.removeChannel(channel); };
  }, [communities, currentCommunityId, isLoggedIn]);

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
    const anchor = e.currentTarget.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    const height = Math.min(560, window.innerHeight - 24);
    const x = Math.max(12, Math.min(anchor.left, window.innerWidth - width - 12));
    const below = anchor.bottom + 8;
    const y = below + height <= window.innerHeight - 12
      ? below
      : Math.max(12, anchor.top - height - 8);
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

  const openDirectMessage = async (user: User) => {
    const existing = dms.find((dm) => dm.user.id === user.id || dm.user.handle.toLowerCase() === user.handle.toLowerCase());
    if (existing && !existing.id.startsWith('dm-')) {
      if (existing.isArchived) {
        setDms((prev) => prev.map((dm) => dm.id === existing.id ? { ...dm, isArchived: false } : dm));
      }
      setActiveDmId(existing.id);
      setIsDirectMessages(true);
      setIsColumn1Collapsed(false);
      return;
    }

    setIsDmLoading(true);
    try {
      const conversationId = await getOrCreateConversation(user.id);
      setDms((previous) => {
        const existingConversation = previous.find((dm) => dm.id === conversationId);
        if (existingConversation) {
          return previous.map((dm) => dm.id === conversationId ? { ...dm, user, isArchived: false } : dm);
        }
        return [...previous, {
          id: conversationId,
          user,
          lastMessage: '',
          lastMessageTime: '',
          unread: false,
          isArchived: false,
        }];
      });
      setActiveDmId(conversationId);
      setIsDirectMessages(true);
      setIsColumn1Collapsed(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível abrir a conversa direta.';
      addToast('Conversa não aberta', message, 'error');
    } finally {
      setIsDmLoading(false);
    }
  };

  const createChannel = async (name: string, type: 'text' | 'voice', categoryId: string): Promise<boolean> => {
    const cleanName = name.trim().toLowerCase().replace(/\s+/g, '-');
    const activeCommunity = communities.find((community) => community.id === currentCommunityId);
    if (!/^[a-z0-9_-]+$/.test(cleanName)) {
      addToast('Nome inválido', 'Use letras, números, hífen ou sublinhado.', 'warning');
      return false;
    }
    if (activeCommunity?.channels.some((channel) => channel.name === cleanName)) {
      addToast('Nome em uso', 'Já existe um canal com esse nome nesta comunidade.', 'warning');
      return false;
    }
    const client = supabase;
    if (!client || !activeCommunity || !currentUser.id) {
      addToast('Canal não criado', 'A sessão do Supabase ou a comunidade não está disponível.', 'error');
      return false;
    }

    const { data, error } = await client
      .from('channels')
      .insert({ community_id: currentCommunityId, name: cleanName, type })
      .select('*')
      .single();
    if (error || !data) {
      addToast('Canal não criado', error?.message || 'O Supabase não retornou o canal criado.', 'error');
      return false;
    }

    const newChan: Channel = {
      ...toCommunityChannel(data as SupabaseChannelRow, categoryId, currentUser.id),
      topic: `Canal ${type === 'voice' ? 'de voz' : 'de texto'} criado recentemente`,
      unreadCount: 0,
    };

    setCommunities((prev) =>
      prev.map((c) =>
        c.id === currentCommunityId ? { ...c, channels: [...c.channels, newChan] } : c
      )
    );
    setLogs((prev) => [{ id: crypto.randomUUID(), communityId: currentCommunityId, userId: currentUser.id, action: 'channel_created', targetId: newChan.id, metadata: { name: cleanName, type }, createdAt: new Date().toISOString() }, ...prev]);
    setIsCreateChannelModalOpen(false);
    setCurrentChannelId(newChan.id);
    addToast('Canal Criado', `#${cleanName} foi criado com sucesso!`, 'success');
    return true;
  };

  const updateCommunity = (id: string, updates: Partial<Community>) => {
    setCommunities((prev) => prev.map((community) => community.id === id ? { ...community, ...updates } : community));
  };

  const updateChannel = (id: string, updates: Partial<Channel>) => {
    setCommunities((prev) => prev.map((community) => ({
      ...community,
      channels: community.channels.map((channel) => channel.id === id ? { ...channel, ...updates } : channel),
    })));
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
    const client = supabase;
    if (!client) {
      notify.error('A conexão com o Supabase não está configurada.');
      return false;
    }

    let authUser: { id: string; email?: string } | null = null;
    try {
      const { data, error } = await client.auth.getUser();
      if (!error && data.user) {
        authUser = data.user;
      } else {
        const refreshed = await client.auth.refreshSession();
        if (!refreshed.error && refreshed.data.session?.user) {
          authUser = refreshed.data.session.user;
        }
      }
    } catch {
      authUser = null;
    }

    if (!authUser && currentUser?.id) {
      authUser = { id: currentUser.id, email: currentUser.email };
    }

    if (!authUser) {
      notify.error('Sua sessão expirou. Faça login novamente.');
      return false;
    }

    // Se for DM (Direct Messages)
    if (isDirectMessages) {
      const conversationId = activeDmId;
      if (!conversationId) {
        notify.error('Selecione uma conversa para enviar a mensagem.');
        return false;
      }

      let data: any = null;
      try {
        const res = await client
          .from('direct_messages')
          .insert({
            conversation_id: conversationId,
            author_id: authUser.id,
            content: messageContent,
          })
          .select('*')
          .single();
        if (res.error) throw res.error;
        data = res.data;
      } catch (reason) {
        notify.error('Não foi possível enviar a mensagem direta.');
        return false;
      }

      const sender = { ...currentUser, id: authUser.id, email: authUser.email || currentUser.email };
      const newMessage: Message = {
        id: data?.id || crypto.randomUUID(),
        channelId: conversationId,
        senderId: authUser.id,
        sender,
        content: messageContent,
        timestamp: data?.created_at || new Date().toISOString(),
        reactions: [],
        replyTo,
        attachments,
      };

      setMessages((previous) => {
        const dmMessages = previous[conversationId] || [];
        if (dmMessages.some((item) => item.id === newMessage.id)) return previous;
        return { ...previous, [conversationId]: [...dmMessages, newMessage] };
      });

      setDms((previous) =>
        previous.map((dm) =>
          dm.id === conversationId
            ? { ...dm, lastMessage: messageContent, lastMessageTime: 'Agora' }
            : dm
        )
      );

      return true;
    }

    // Canal normal de texto
    let channelId = currentChannelId || activeChannelKey;
    if (!channelId) {
      const activeComm = communities.find((c) => c.id === currentCommunityId) || communities[0];
      const textChannel = activeComm?.channels.find((c) => c.type === 'text');
      if (textChannel) {
        channelId = textChannel.id;
        setCurrentChannelId(channelId);
      } else {
        notify.error('Selecione um canal de texto antes de enviar.');
        return false;
      }
    }

    const selectedChannel = communities.flatMap((community) => community.channels).find((channel) => channel.id === channelId);
    if (selectedChannel && selectedChannel.type !== 'text') {
      notify.error('Mensagens só podem ser enviadas em canais de texto.');
      return false;
    }

    let data: SupabaseMessageRow | null = null;
    let error: { message: string } | null = null;
    try {
      const result = await client
        .from('messages')
        .insert({ channel_id: channelId, author_id: authUser.id, content: messageContent })
        .select('*, author:profiles!messages_author_id_fkey(username, avatar_url)')
        .single();
      data = result.data as SupabaseMessageRow | null;
      error = result.error;
    } catch (reason) {
      notify.error(reason instanceof Error ? reason.message : 'Não foi possível conectar ao Supabase.');
      return false;
    }

    if (error && !data) {
      notify.error(error.message || 'Não foi possível salvar a mensagem.');
      return false;
    }

    if (data) {
      const sender = { ...currentUser, id: authUser.id, email: authUser.email || currentUser.email };
      const newMessage = { ...toChatMessage(data, sender), replyTo, attachments };
      setMessages((previous) => {
        const channelMessages = previous[channelId] || [];
        if (channelMessages.some((item) => item.id === newMessage.id)) return previous;
        return { ...previous, [channelId]: [...channelMessages, newMessage] };
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
      channelId: getDirectCallRoomId(currentUser.id, targetUser.id),
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
    const targetCallId = getDirectCallRoomId(currentUser.id, targetUser.id);
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
        completeOnboarding,
        isLoggedIn,
        setIsLoggedIn,
        isAuthLoading,
        authLoadError,
        retryAuthProfileLoad,
        createCommunity,
        joinCommunityByInvite,
        communities,
        members,
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
        isDmLoading,
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



