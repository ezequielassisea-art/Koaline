import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Message } from '../../types';
import { formatRelativeTime } from '../../utils/time';
import { canModerateCommunity } from '../admin/adminAccess';
import {
  Smile,
  Reply,
  Edit2,
  Trash2,
  Pin,
  Check,
  X,
  FileText,
  Play,
  Pause,
  Volume2
} from 'lucide-react';

interface MessageItemProps {
  message: Message;
  isGrouped?: boolean;
  isUnread?: boolean;
  timeLabel?: string;
  onReply: (message: Message) => void;
}

const COMMON_EMOJIS = ['🔥', '⚡', '✨', '🚀', '👍', '❤️', '👀'];
const YOUTUBE_URL_REGEX = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i;

const getImageSource = (content: string): string | null => {
  const value = content.trim();
  if (/^data:image\//i.test(value)) return value;

  try {
    const imageUrl = new URL(value, window.location.origin);
    if (imageUrl.protocol !== 'http:' && imageUrl.protocol !== 'https:') return null;
    return /\.(png|jpe?g|gif|webp)$/i.test(imageUrl.pathname) ? imageUrl.href : null;
  } catch {
    return null;
  }
};

const getMediaSource = (content: string, kind: 'audio' | 'video'): string | null => {
  const value = content.trim();
  if (value.toLowerCase().startsWith(`data:${kind}/`)) return value;
  try {
    const pathname = new URL(value).pathname;
    const extensions = kind === 'audio' ? /\.(mp3|m4a|wav|ogg|webm|aac)$/i : /\.mp4$/i;
    return extensions.test(pathname) ? value : null;
  } catch {
    return null;
  }
};

const AudioMessagePlayer: React.FC<{ src: string }> = ({ src }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try { await audio.play(); } catch { setIsPlaying(false); }
    } else {
      audio.pause();
    }
  };

  return (
    <div className="flex w-full max-w-xs items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2.5">
      <audio ref={audioRef} src={src} preload="metadata" onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => setIsPlaying(false)} />
      <button type="button" onClick={togglePlayback} aria-label={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-600 text-white transition-colors hover:bg-indigo-500">
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-1" aria-hidden="true">
          {[8, 14, 10, 18, 12, 7, 15, 10, 19, 11, 7, 14, 9, 17, 10, 6, 13, 8].map((height, index) => (
            <span key={index} className={`w-1 rounded-full ${index / 18 <= (duration ? currentTime / duration : 0) ? 'bg-indigo-400' : 'bg-slate-600'}`} style={{ height: `${height}px` }} />
          ))}
        </div>
        <input type="range" min={0} max={duration || 0} step={0.01} value={Math.min(currentTime, duration || 0)} aria-label="Progresso do áudio" onChange={(event) => { const audio = audioRef.current; if (!audio) return; audio.currentTime = Number(event.target.value); setCurrentTime(audio.currentTime); }} className="h-1 w-full cursor-pointer accent-indigo-500" />
        <span className="text-[10px] text-slate-400">{Math.floor(currentTime / 60).toString().padStart(2, '0')}:{Math.floor(currentTime % 60).toString().padStart(2, '0')} / {Math.floor(duration / 60).toString().padStart(2, '0')}:{Math.floor(duration % 60).toString().padStart(2, '0')}</span>
      </div>
      <Volume2 className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
    </div>
  );
};

export const MessageItem: React.FC<MessageItemProps> = ({ message, isGrouped = false, isUnread = false, timeLabel, onReply }) => {
  const {
    currentUser,
    openUserMenu,
    editMessage,
    deleteMessage,
    toggleReaction,
    togglePinMessage,
    communities,
    currentCommunityId,
  } = useApp();

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(typeof message.content === 'string' ? message.content : '');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isYouTubeModalOpen, setIsYouTubeModalOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const isSelf = message.senderId === currentUser.id;
  const activeCommunity = communities.find((community) => community.id === currentCommunityId);
  const canManagePins = !!activeCommunity && canModerateCommunity(activeCommunity.id, currentUser, activeCommunity.ownerId || activeCommunity.creatorId);
  const sender = isSelf
    ? currentUser
    : {
        ...currentUser,
        ...(message.sender ?? {}),
        id: message.senderId || message.sender?.id || '',
        name: typeof message.sender?.name === 'string' && message.sender.name.trim() ? message.sender.name : 'Membro',
        handle: typeof message.sender?.handle === 'string' ? message.sender.handle : '',
        avatar: typeof message.sender?.avatar === 'string' ? message.sender.avatar : '',
      };
  const content = typeof message.content === 'string' ? message.content : '';
  const imageSource = getImageSource(content);
  const audioSource = getMediaSource(content, 'audio');
  const videoSource = getMediaSource(content, 'video');
  const youtubeMatch = content.match(YOUTUBE_URL_REGEX);
  const youtubeVideoId = youtubeMatch?.[1];
  const messageText = youtubeMatch
    ? content.replace(/https?:\/\/(?=(?:www\.)?(?:youtube\.com|youtu\.be))/i, '').replace(youtubeMatch[0], '').trim()
    : content.trim();
  const senderInitials = sender.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '◇';

  useEffect(() => {
    if (!isYouTubeModalOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setIsYouTubeModalOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isYouTubeModalOpen]);

  const handleSaveEdit = () => {
    if (editContent.trim()) {
      editMessage(message.id, editContent);
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setEditContent(content);
    setIsEditing(false);
  };

  if (message.isDeleted) {
    return (
      <div className="px-4 py-1.5 text-xs italic text-slate-500 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
        <span>Mensagem apagada</span>
      </div>
    );
  }

  return (
    <div
      id={`message-${message.id}`}
      className={`koaline-message group relative flex gap-3 px-4 py-2 transition-colors rounded-nest-sm ${isGrouped ? 'is-grouped' : 'mt-2'} ${
        message.pinned ? 'bg-indigo-950 border-l-2 border-indigo-500' : ''
      }`}
    >
      {/* Sender Avatar */}
      <div className="koaline-message-avatar flex-shrink-0 mt-0.5" data-grouped={isGrouped} data-self={isSelf}>
        {!isGrouped && (
          <button type="button" aria-label={`Abrir opções de ${sender.name}`} onClick={(event) => openUserMenu(sender, event)} className="block rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
            {sender.avatar
              ? <img src={sender.avatar} alt="" className="w-10 h-10 rounded-full object-cover cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all ring-1 ring-border shadow-sm" />
              : <span className="grid w-10 h-10 place-items-center rounded-full bg-slate-700 text-white font-semibold">{senderInitials}</span>}
          </button>
        )}
      </div>

      {/* Message Body */}
      <div className={`flex-1 min-w-0 ${isSelf ? 'message-body-self' : ''}`}>
        {/* Sender Name, Time, Badges */}
        <div className="flex items-center gap-2">
          {isSelf && !isGrouped && sender.avatar && <img src={sender.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />}
          {!isGrouped && <button type="button" onClick={(e) => openUserMenu(sender, e)} className={`koaline-message-author font-title hover:text-indigo-400 hover:underline cursor-pointer transition-colors ${isSelf ? 'self-message-author' : ''}`}>
            {sender.name}
          </button>}

          {isUnread && <span className="message-unread-dot" title="Mensagem não lida" aria-label="Mensagem não lida" />}

          {message.edited && (
            <span className="text-[10px] text-slate-500 italic">(editada)</span>
          )}

          {message.pinned && (
            <span className="text-[10px] text-indigo-400 flex items-center gap-0.5">
              <Pin className="w-2.5 h-2.5" /> Fixada
            </span>
          )}
        </div>
        {/* Content or Edit Input */}
        {isEditing ? (
          <div className="mt-1.5 space-y-2">
            <input
              type="text"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit();
                if (e.key === 'Escape') handleCancelEdit();
              }}
              autoFocus
              className="w-full px-3 py-1.5 text-xs rounded-nest-sm bg-slate-900 border border-indigo-500 focus:outline-none text-slate-100"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveEdit}
                className="flex items-center gap-1 px-3 py-1 rounded-nest-pill bg-indigo-600 text-white text-[11px] font-medium hover:bg-indigo-500"
              >
                <Check className="w-3 h-3" /> Salvar
              </button>
              <button
                onClick={handleCancelEdit}
                className="flex items-center gap-1 px-3 py-1 rounded-nest-pill bg-slate-800 text-slate-400 text-[11px] font-medium hover:text-slate-200"
              >
                <X className="w-3 h-3" /> Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className={`koaline-message-copy leading-relaxed mt-0.5 break-words ${isSelf ? 'is-self' : 'is-other'}`}>
            {message.replyTo && (
              <div className="koaline-reply-quote">
                <Reply className="h-3 w-3 shrink-0" />
                <span className="truncate"><strong>{message.replyTo.senderName}</strong>: {message.replyTo.content}</span>
              </div>
            )}
            {imageSource ? (
              <a href={imageSource} target="_blank" rel="noreferrer" aria-label="Abrir imagem em nova aba" className="inline-block">
                <img src={imageSource} alt="Imagem enviada" className="max-w-[300px] max-h-[300px] rounded-xl object-cover cursor-pointer" />
              </a>
            ) : audioSource ? (
              <AudioMessagePlayer src={audioSource} />
            ) : videoSource ? (
              <video src={videoSource} controls preload="metadata" className="max-h-[300px] max-w-[300px] rounded-xl object-cover" aria-label="Vídeo enviado" />
            ) : youtubeVideoId ? (
              <>
                {messageText && <p className="whitespace-pre-wrap">{messageText}</p>}
                <button type="button" onClick={() => setIsYouTubeModalOpen(true)} aria-label="Assistir no YouTube" className="relative mt-1 block w-[320px] max-w-full overflow-hidden rounded-xl bg-[var(--bg-elevated)] text-left transition-transform hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <img src={`https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`} alt="Miniatura do vídeo do YouTube" className="block aspect-video w-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/35">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/75 text-white shadow-lg">
                      <Play className="ml-0.5 h-5 w-5 fill-current" />
                    </span>
                  </span>
                  <span className="block px-3 py-2 text-xs font-medium text-primary">Assistir no YouTube</span>
                </button>
              </>
            ) : content.trim() ? (
              <p className={`message-content-text whitespace-pre-wrap ${!isExpanded && content.length > 400 ? 'is-collapsed' : ''}`}>{content}</p>
            ) : null}
            <time className="koaline-message-time" dateTime={message.timestamp} title={formatRelativeTime(message.timestamp)}>{timeLabel || ''}</time>
            {!imageSource && !audioSource && !videoSource && content.length > 400 && <button type="button" className="message-expand-button" onClick={() => setIsExpanded((expanded) => !expanded)}>{isExpanded ? 'Ver menos' : 'Ver mais'}</button>}
          </div>
        )}

        {isYouTubeModalOpen && youtubeVideoId && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4  animate-in fade-in duration-200" role="dialog" aria-modal="true" aria-label="Player do YouTube" onClick={() => setIsYouTubeModalOpen(false)}>
            <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-semibold text-white">YouTube</span>
                <button type="button" onClick={() => setIsYouTubeModalOpen(false)} aria-label="Fechar vídeo" className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" /></button>
              </div>
              <div className="aspect-video w-full bg-black">
                <iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}?autoplay=1`} title="Vídeo do YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
              </div>
            </div>
          </div>
        )}

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((att, i) => (
              att.type === 'image' ? (
                <a key={i} href={att.url} target="_blank" rel="noreferrer" aria-label="Abrir imagem em nova aba" className="inline-block">
                  <img src={att.url} alt={att.name || 'Imagem enviada'} className="max-w-[300px] max-h-[300px] rounded-xl object-cover cursor-pointer" />
                </a>
              ) : att.type === 'video' ? (
                <video key={i} src={att.url} controls preload="metadata" className="max-h-[300px] max-w-[300px] rounded-xl object-cover" aria-label={att.name || 'Vídeo enviado'} />
              ) : (
                <div
                  key={i}
                  className="koaline-attachment flex items-center gap-2 p-2 rounded-nest-sm bg-slate-900 border border-border text-xs"
                >
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <span className="font-medium text-slate-200">{att.name}</span>
                  <span className="text-[10px] text-slate-500">{att.size || '1.2 MB'}</span>
                </div>
              )
            ))}
          </div>
        )}

        {/* Inline Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="mt-2 p-2 rounded-nest-sm bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-xs animate-in fade-in">
            <span className="text-rose-400 font-medium">Deseja apagar esta mensagem?</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  deleteMessage(message.id);
                  setShowDeleteConfirm(false);
                }}
                className="px-2.5 py-1 rounded-nest-pill bg-rose-600 text-white font-medium text-[11px] hover:bg-rose-500"
              >
                Apagar
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-2 py-1 rounded-nest-pill text-slate-400 hover:text-slate-200 text-[11px]"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Reactions List */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {message.reactions.map((rx) => {
              const hasReacted = rx.users.includes(currentUser.id);
              return (
                <button
                  key={rx.emoji}
                  onClick={() => toggleReaction(message.id, rx.emoji)}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-nest-pill text-[11px] font-medium border transition-all active:scale-95 ${
                    hasReacted
                      ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300 font-semibold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span>{rx.emoji}</span>
                  <span>{rx.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Hover Actions Bar */}
      <div className="absolute right-4 -top-3 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-slate-700 shadow-xl rounded-nest-pill p-1 flex items-center gap-1 z-10">
        {/* Quick Emojis */}
        <div className="relative">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Adicionar reação"
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition-colors"
          >
            <Smile className="w-3.5 h-3.5" />
          </button>

          {showEmojiPicker && (
            <div className="absolute right-0 bottom-full mb-1 flex items-center gap-1 p-1 rounded-nest-pill bg-slate-900 border border-slate-700 shadow-xl z-20">
              {COMMON_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    toggleReaction(message.id, emoji);
                    setShowEmojiPicker(false);
                  }}
                  className="p-1 hover:scale-125 transition-transform text-sm"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reply */}
        <button
          onClick={() => onReply(message)}
          title="Responder"
          className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-indigo-400 transition-colors"
        >
          <Reply className="w-3.5 h-3.5" />
        </button>

        {/* Pin */}
        {canManagePins && <button
          onClick={() => togglePinMessage(message.id)}
          title={message.pinned ? 'Desafixar mensagem' : 'Fixar mensagem'}
          className={`p-1.5 rounded-full hover:bg-slate-800 transition-colors ${
            message.pinned ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Pin className="w-3.5 h-3.5" />
        </button>}

        {/* Edit */}
        {isSelf && (
          <button
            onClick={() => setIsEditing(true)}
            title="Editar mensagem"
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-sky-400 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Delete */}
        {isSelf && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            title="Apagar mensagem"
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};


