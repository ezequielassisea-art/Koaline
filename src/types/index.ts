export type ThemePreset = 'light' | 'dark' | 'amoled' | 'neon' | 'minimalist';
export type Density = 'compact' | 'comfortable' | 'spacious';
export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';
export type ChannelType = 'text' | 'voice';

export interface User {
  id: string;
  name: string;
  handle: string;
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
    type: 'image' | 'file';
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
  unreadCount?: number;
  connectedUsers?: User[];
  isPrivate?: boolean;
  isArchived?: boolean;
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
  isArchived: boolean;
}

export interface ActiveCall {
  channelId: string;
  channelName: string;
  communityName: string;
  type: 'voice' | 'video';
  isMinimized: boolean;
  isMicMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
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
  preset: ThemePreset;
  accentColor: string;
  fontScale: number; // 0.8 to 1.5
  density: Density;
  glassBlur: number;
  glassOpacity: number;
  reduceMotion: boolean;
  highContrast: boolean;
  iconPack: 'organic-round' | 'sharp-modern' | 'minimal';
  bgType: 'solid' | 'gradient' | 'image';
  syncDevices: boolean;
}

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'coral';
}
