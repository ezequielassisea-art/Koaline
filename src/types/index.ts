export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';
export type ChannelType = 'text' | 'voice';

export interface User {
  id: string;
  name: string;
  handle: string;
  email?: string;
  onboarding_completed?: boolean;
  communityRole?: 'owner' | 'admin' | 'moderator' | 'member';
  statusKnown?: boolean;
  avatar: string;
  banner?: string;
  status: UserStatus;
  customStatus?: {
    emoji: string;
    text: string;
  };
  bio?: string;
  pronouns?: string;
  interests?: string[];
  favoriteGames?: string[];
  level: number;
  xp: number;
  xpMax: number;
  badges: Array<{
    id: string;
    name: string;
    icon: string;
    description: string;
  }>;
  socials: Array<{
    platform: string;
    url: string;
    visible: boolean;
  }>;
  isSelf?: boolean;
  voiceMuted?: boolean;
}

export interface Reaction {
  emoji: string;
  count: number;
  users: string[]; // user IDs
}

export interface Message {
  id: string;
  channelId: string;
  senderId: string;
  sender: User;
  content: string;
  timestamp: string;
  edited?: boolean;
  isDeleted?: boolean;
  replyTo?: {
    id: string;
    senderName: string;
    content: string;
  };
  reactions: Reaction[];
  attachments?: Array<{
    type: 'image' | 'video' | 'file';
    url: string;
    name: string;
    size?: string;
  }>;
  pinned?: boolean;
}

export interface Channel {
  id: string;
  communityId: string;
  name: string;
  topic?: string;
  type: ChannelType;
  categoryId: string;
  ownerId?: string;
  unreadCount?: number;
  connectedUsers?: User[];
  voiceStartedAt?: number | null;
  isPrivate?: boolean;
  isArchived?: boolean;
  isDefault?: boolean;
}

export interface Category {
  id: string;
  communityId: string;
  name: string;
  collapsed?: boolean;
}

export interface Community {
  id: string;
  name: string;
  tagline: string;
  icon: string;
  banner?: string;
  membersCount: number;
  categories: Category[];
  channels: Channel[];
  creatorId?: string;
  ownerId?: string;
  visibility?: 'public' | 'private';
  description?: string;
  createdAt?: string;
}

export interface DirectMessageConversation {
  id: string;
  user: User;
  lastMessage: string;
  lastMessageTime: string;
  unread: boolean;
  lastReadAt?: string;
  isArchived: boolean;
}

export interface ActiveCall {
  channelId: string;
  startedAt?: number;
  channelName: string;
  communityName: string;
  type: 'voice' | 'video';
  isMinimized: boolean;
  isMicMuted: boolean;
  isDeafened: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  screenStream?: MediaStream | null;
  isWatchingScreen?: boolean;
  screenViewers?: User[];
  layout: 'grid' | 'spotlight' | 'audio-only';
  participants: Array<{
    user: User;
    isSpeaking: boolean;
    isMuted: boolean;
    isCameraOn: boolean;
    streamActive?: boolean;
  }>;
}

export interface ThemeSettings {
  mode: 'light' | 'dark';
  fontScale: number; // 80 to 150 percent
  reduceMotion: boolean;
}

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

export interface IncomingCall {
  callId: string;
  callerId: string;
  callerName: string;
  callerHandle: string;
  callerAvatar: string;
  type: 'voice' | 'video';
  startedAt: number;
}

export interface OutgoingCall {
  callId: string;
  targetUserId: string;
  targetUserName: string;
  type: 'voice' | 'video';
  startedAt: number;
}
