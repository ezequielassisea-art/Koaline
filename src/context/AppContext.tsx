import React, { createContext, useContext, useState, useEffect } from 'react';
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

const EMPTY_USER: User = { id: '', name: '', handle: '', avatar: '', status: 'online', level: 1, xp: 0, xpMax: 100, badges: [], socials: [] };

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
  deleteChannel: (id: string) => void;
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
  startCall: (channel: Channel, mode: 'voice' | 'video', isDeafened?: boolean) => void;
  startDirectCall: (targetUser: User, mode: 'voice' | 'video') => void;
  leaveCall: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => void;
  watchScreen: () => void;
  stopWatchingScreen: () => void;
  toggleMinimizeCall: () => void;
  setCallLayout: (layout: 'grid' | 'spotlight' | 'audio-only') => void;
  switchCallChannel: (channel: Channel) => void;

  // Themes
  theme: ThemeSettings;
  updateTheme: (updates: Partial<ThemeSettings>) => void;
  resetTheme: () => void;

  // Notifications / Toasts
  toasts: ToastMessage[];
  addToast: (title: string, message: string, type?: ToastMessage['type']) => void;
  removeToast: (id: string) => void;

  // User Actions Menu
  activeUserMenu: { user: User; position: { x: number; y: number } } | null;
  openUserMenu: (user: User, e: React.MouseEvent) => void;
  closeUserMenu: () => void;
}

const DEFAULT_THEME: ThemeSettings = {
  mode: 'dark',
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
  const [messages, setMessages] = useState<Record<string, Message[]>>(() => { try { return JSON.parse(localStorage.getItem('koaline:messages') || '{}'); } catch { return {}; } });

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

  useEffect(() => {
    if (localStorage.getItem('koaline:migrated_clean') === '1') return;
    try {
      const stored = JSON.parse(localStorage.getItem('koaline:communities') || '[]') as Community[];
      const legacyIds = new Set(stored.filter((item) => !item.ownerId && (item.id.startsWith('comm-koala-') || item.id.startsWith('comm-tech-') || (item as Community & { isDemo?: boolean; mock?: boolean }).isDemo || (item as Community & { mock?: boolean }).mock)).map((item) => item.id));
      if (legacyIds.size) {
        const valid = stored.filter((item) => !legacyIds.has(item.id) || !!item.ownerId);
        const removedChannelIds = new Set(stored.filter((item) => legacyIds.has(item.id) && !item.ownerId).flatMap((item) => item.channels.map((channel) => channel.id)));
        setCommunities(valid);
        setFlatChannels((prev) => prev.filter((item) => !legacyIds.has(item.communityId)));
        setMembers((prev) => prev.filter((item) => !legacyIds.has(item.communityId)));
        setInvites((prev) => (prev as Array<{communityId?:string}>).filter((item) => !item.communityId || !legacyIds.has(item.communityId)));
        setLogs((prev) => (prev as Array<{communityId?:string}>).filter((item) => !item.communityId || !legacyIds.has(item.communityId)));
        setMessages((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !removedChannelIds.has(id))));
        if (legacyIds.has(localStorage.getItem('koaline:current-community') || '')) { setCurrentCommunityId(''); setCurrentChannelId(''); }
        setDms((prev) => prev.filter((item) => !['user-leo','user-clara','user-thiago','user-beatriz'].includes(item.user.id)));
      }
    } catch { /* Dados locais inválidos são preservados para não apagar conteúdo não identificado. */ }
    localStorage.setItem('koaline:migrated_clean', '1');
  }, []);

  // Messaging
  useEffect(() => {
    try {
      localStorage.setItem('koaline:messages', JSON.stringify(messages));
    } catch {
      // Mídia Base64 pode exceder a cota local; as mensagens continuam disponíveis na sessão atual.
    }
  }, [messages]);
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
  const screenStreamRef = React.useRef<MediaStream | null>(null);

  // Theme
  const [theme, setTheme] = useState<ThemeSettings>(() => {
    const savedTheme = loadThemeSettings();
    document.documentElement.setAttribute('data-theme', savedTheme.mode);
    return savedTheme;
  });

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

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
      '--color-border', '--accent-muted', '--density-padding', '--glass-opacity', '--glass-blur',
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
    if (value) setCurrentUser((prev) => {
      const user = { ...prev, id: prev.id || crypto.randomUUID() };
      localStorage.setItem('koaline:current-user', JSON.stringify(user));
      return user;
    });
    setLoggedIn(value);
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

  const addToast = (title: string, message: string, type: ToastMessage['type'] = 'coral') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
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

  const deleteChannel = (id: string) => {
    setCommunities((prev) => prev.map((community) => ({
      ...community,
      channels: community.channels.filter((channel) => channel.id !== id),
    })));
    setFlatChannels((prev) => prev.filter((channel) => channel.id !== id));
    setMessages((prev) => { const next = { ...prev }; delete next[id]; return next; });
    if (currentChannelId === id) {
      const fallback = communities.find((community) => community.id === currentCommunityId)?.channels.find((channel) => channel.id !== id && channel.type === 'text');
      setCurrentChannelId(fallback?.id || '');
    }
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

  const sendMessage = (
    content: string,
    replyTo?: Message['replyTo'],
    attachments?: Message['attachments']
  ) => {
    if (!content.trim() && (!attachments || attachments.length === 0)) return;

    const newMessage: Message = {
      id: `m-${Date.now()}`,
      channelId: activeChannelKey,
      senderId: currentUser.id,
      sender: currentUser,
      content: content.trim(),
      timestamp: 'Hoje às ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      reactions: [],
      replyTo,
      attachments,
    };

    setMessages((prev) => ({
      ...prev,
      [activeChannelKey]: [...(prev[activeChannelKey] || []), newMessage],
    }));

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
  const startCall = (channel: Channel, mode: 'voice' | 'video', isDeafened = false) => {
    const currentComm = communities.find((c) => c.id === currentCommunityId);
    const otherParticipants = (channel.connectedUsers || [])
      .filter((user) => user.id !== currentUser.id)
      .map((user) => ({ user, isSpeaking: false, isMuted: false, isCameraOn: false }));
    setActiveCall({
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
    });
    addToast('Conectado', `Entrou na sala de voz ${channel.name}`, 'success');
  };

  const startDirectCall = (targetUser: User, mode: 'voice' | 'video') => {
    setActiveCall({
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
    });
    addToast('Chamando...', `Iniciando chamada com ${targetUser.name}`);
  };

  const leaveCall = () => {
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    setActiveCall(null);
    addToast('Chamada Encerrada', 'Você saiu da sala.');
  };

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
    addToast('Trocando de canal', `Saindo de ${activeCall.channelName}, entrando em ${channel.name}...`);
    setActiveCall((prev) =>
      prev
        ? {
            ...prev,
            channelId: channel.id,
            channelName: channel.name,
          }
        : null
    );
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
        theme,
        updateTheme,
        resetTheme,
        toasts,
        addToast,
        removeToast,
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
