import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Message } from '../../types';
import { formatRelativeTime } from '../../utils/time';
import { canModerateCommunity } from '../admin/adminAccess';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Button,
} from '@/components/ui/button';
import {
  Smile,
  Reply,
  Edit2,
  Trash2,
  Pin,
  Check,
  CheckCheck,
  X,
  FileText,
  Play,
  Pause,
  Volume2,
  MoreHorizontal,
} from 'lucide-react';

interface MessageItemProps {
  message: Message;
  isGrouped?: boolean;
  isUnread?: boolean;
  timeLabel?: string;
  onReply: (message: Message) => void;
  onEdit?: (message: Message) => void;
  readStatus?: 'sent' | 'delivered' | 'read';
}

const COMMON_EMOJIS = ['🔥', '⚡', '✨', '🚀', '👍', '❤️', '👀'];
const YOUTUBE_URL_REGEX = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i;

const renderLinkedText = (value: string, isMine: boolean) => {
  const parts: React.ReactNode[] = [];
  const matcher = /https?:\/\/[^\s<>"']+/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(value))) {
    let url = match[0];
    let punctuation = '';
    while (/[.,!?;:)\]]$/.test(url)) { punctuation = url.slice(-1) + punctuation; url = url.slice(0, -1); }
    if (match.index > lastIndex) parts.push(value.slice(lastIndex, match.index));
    parts.push(<a key={`${match.index}-${url}`} href={url} target="_blank" rel="noopener noreferrer" style={{ color: isMine ? '#FFFFFF' : 'var(--primary)', textDecoration: 'underline' }} className="hover:opacity-80">{url}</a>, punctuation);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < value.length) parts.push(value.slice(lastIndex));
  return parts;
};

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

export const MessageItem: React.FC<MessageItemProps> = ({ message, isGrouped = false, isUnread = false, timeLabel, onReply, onEdit, readStatus }) => {
  const {
    currentUser,
    openUserMenu,
    editMessage,
    deleteMessage,
    toggleReaction,
    togglePinMessage,
    communities,
    currentCommunityId,
    acceptCommunityInvite,
  } = useApp();

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
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
  let inviteCard: { type: 'invite_card'; communityId: string; communityName?: string; message?: string; notificationId?: string; system_log?: boolean } | null = null;
  if (content.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(content);
      if (parsed?.type === 'invite_card' && typeof parsed.communityId === 'string') inviteCard = parsed;
    } catch { /* Mensagem comum em texto. */ }
  }
  const isSystemInvite = !!inviteCard?.system_log;
  const imageSource = getImageSource(content);
  const audioSource = getMediaSource(content, 'audio');
  const videoSource = getMediaSource(content, 'video');
  const youtubeMatch = content.match(YOUTUBE_URL_REGEX);
  const youtubeVideoId = youtubeMatch?.[1];
  const messageText = youtubeMatch
    ? content.replace(/https?:\/\/(?=(?:www\.)?(?:youtube\.com|youtu\.be))/i, '').replace(youtubeMatch[0], '').trim()
    : content.trim();
  const senderName = sender?.name || 'Membro Koaline';
  const senderInitials = senderName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '◇';

  useEffect(() => {
    if (!isYouTubeModalOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setIsYouTubeModalOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isYouTubeModalOpen]);

  const handleDelete = () => {
    deleteMessage(message.id);
    setShowDeleteDialog(false);
  };

  if (message.isDeleted) {
    return (
      <div className="flex w-full mb-4 justify-center px-4">
        <div className="px-4 py-1.5 text-xs italic text-slate-500 flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          <span>Mensagem apagada</span>
        </div>
      </div>
    );
  }

  return (
    <div
      id={`message-${message.id}`}
      className={`flex w-full mb-4 ${isSelf ? 'justify-end' : 'justify-start'}`}
    >
      {/* AVATAR DO OUTRO (Esquerda) - apenas se não for minha mensagem e não agrupado */}
      {!isSelf && !isGrouped && !isSystemInvite && (
        <button
          type="button"
          aria-label={`Abrir opções de ${sender.name}`}
          onClick={(event) => openUserMenu(sender, event)}
          className="flex-shrink-0 mr-2 mt-1 block rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          {sender.avatar
            ? <img src={sender.avatar} alt="" className="w-10 h-10 rounded-full object-cover cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all ring-1 ring-border shadow-sm" />
            : <span className="grid w-10 h-10 place-items-center rounded-full bg-slate-700 text-white font-semibold">{senderInitials}</span>}
        </button>
      )}

      {/* COLUNA DE CONTEÚDO (Nome + Balão) */}
      <div className={`flex flex-col max-w-[75%] ${isSelf ? 'items-end' : 'items-start'}`}>

        {/* NOME DO AUTOR (Apenas para mensagens dos outros, não agrupadas) */}
        {!isSelf && !isGrouped && !isSystemInvite && (
          <span className="text-xs text-slate-500 mb-1 ml-1">{senderName}</span>
        )}

        {/* BALÃO DA MENSAGEM */}
        <div className={`relative group w-fit px-4 py-2 rounded-2xl ${isSelf ? 'bg-[#3B82F6] text-white rounded-tr-sm' : 'bg-[#F1F5F9] text-[#0F172A] rounded-tl-sm'}`}>

          {/* MENU DE AÇÕES (DropdownMenu do shadcn) - Botão de três pontinhos no canto superior direito do balão */}
          <div className="absolute -top-8 right-0 -translate-y-1/2">
            <DropdownMenu>
              <DropdownMenuTrigger>
                <button
                  className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                  aria-label="Ações da mensagem"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" sideOffset={5} className="min-w-[160px] z-50">
                <DropdownMenuItem onClick={() => onReply(message)} className="flex items-center gap-2">
                  <Reply className="w-4 h-4" />
                  Responder
                </DropdownMenuItem>
                {onEdit && isSelf && (
                  <DropdownMenuItem onClick={() => onEdit(message)} className="flex items-center gap-2">
                    <Edit2 className="w-4 h-4" />
                    Editar
                  </DropdownMenuItem>
                )}
                {isSelf && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="flex items-center gap-2 text-red-600 focus:text-red-600">
                      <Trash2 className="w-4 h-4" />
                      Apagar
                    </DropdownMenuItem>
                  </>
                )}
                {canManagePins && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => togglePinMessage(message.id)} className="flex items-center gap-2">
                      <Pin className="w-4 h-4" />
                      {message.pinned ? 'Desafixar' : 'Fixar'}
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="flex items-center gap-2">
                  <Smile className="w-4 h-4" />
                  Reagir
                </DropdownMenuItem>

                {/* Emoji Picker dentro do DropdownMenu */}
                {showEmojiPicker && (
                  <div className="p-2 flex gap-1 border-t border-slate-200 dark:border-slate-700">
                    {COMMON_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          toggleReaction(message.id, emoji);
                          setShowEmojiPicker(false);
                        }}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors text-xl"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* CONTEÚDO DA MENSAGEM */}
          <div className="break-words text-base leading-relaxed">
            {/* Reply Quote */}
            {message.replyTo && (
              <div className="mb-2 px-3 py-2 rounded-lg border-l-2 border-current/50 bg-current/10 text-sm">
                <div className="flex items-center gap-1.5 mb-1">
                  <Reply className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="font-semibold truncate">{message.replyTo.senderName}</span>
                </div>
                <span className="truncate block opacity-80">{message.replyTo.content}</span>
              </div>
            )}

            {/* Invite Card */}
            {inviteCard ? (
              <div className={`my-2 max-w-lg p-5 ${isSystemInvite ? 'w-full rounded-xl border-y border-dashed border-slate-700 bg-slate-900/40 text-center' : 'rounded-2xl border border-[var(--primary)]/60 bg-[var(--surface)] shadow-lg'}`}>
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">{isSystemInvite ? `Convite personalizado de ${sender.name}` : 'Convite para comunidade'}</div>
                <h3 className="text-lg font-bold text-white">{inviteCard.communityName || communities.find((item) => item.id === inviteCard?.communityId)?.name || 'Comunidade Koaline'}</h3>
                {inviteCard.message && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{inviteCard.message}</p>}
                <button type="button" onClick={() => void acceptCommunityInvite(inviteCard!.communityId, inviteCard!.notificationId)} className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white transition hover:brightness-110">Entrar na Comunidade</button>
              </div>
            ) : imageSource ? (
              <a href={imageSource} target="_blank" rel="noreferrer" aria-label="Abrir imagem em nova aba" className="inline-block">
                <img src={imageSource} alt="Imagem enviada" className="max-w-[300px] max-h-[300px] rounded-xl object-cover cursor-pointer" />
              </a>
            ) : audioSource ? (
              <AudioMessagePlayer src={audioSource} />
            ) : videoSource ? (
              <video src={videoSource} controls preload="metadata" className="max-h-[300px] max-w-[300px] rounded-xl object-cover" aria-label="Vídeo enviado" />
            ) : youtubeVideoId ? (
              <>
                {messageText && <p className="whitespace-pre-wrap mb-2">{messageText}</p>}
                <button type="button" onClick={() => setIsYouTubeModalOpen(true)} aria-label="Assistir no YouTube" className="relative block w-[320px] max-w-full overflow-hidden rounded-xl bg-slate-900/50 text-left transition-transform hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-indigo-500">
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
              <p className={`whitespace-pre-wrap ${!isExpanded && content.length > 400 ? 'is-collapsed' : ''}`}>{renderLinkedText(content, isSelf)}</p>
            ) : null}

            {/* HORÁRIO E CHECKS - Canto inferior direito DENTRO do balão */}
            <div className={`flex items-center justify-end gap-1.5 mt-2 text-[11px] ${isSelf ? 'text-blue-200' : 'text-slate-500'}`}>
              <time dateTime={message.timestamp} title={formatRelativeTime(message.timestamp)}>{timeLabel || ''}</time>
              {isSelf && readStatus && (
                <span className="flex items-center gap-0.5" aria-label={readStatus === 'read' ? 'Lida' : readStatus === 'delivered' ? 'Entregue' : 'Enviada'}>
                  {readStatus === 'read' ? (
                    <CheckCheck className="w-4 h-4 text-blue-300" />
                  ) : (
                    <Check className="w-4 h-4 text-blue-200/70" />
                  )}
                </span>
              )}
            </div>

            {/* Ver mais/menos para textos longos */}
            {!imageSource && !audioSource && !videoSource && content.length > 400 && (
              <button
                type="button"
                className={`text-[11px] mt-1 hover:underline ${isSelf ? 'text-blue-200' : 'text-indigo-400'}`}
                onClick={() => setIsExpanded((expanded) => !expanded)}
              >
                {isExpanded ? 'Ver menos' : 'Ver mais'}
              </button>
            )}
          </div>

        </div>
      </div>

      {/* AVATAR DO USUÁRIO LOGADO (Direita) - apenas se for minha mensagem e não agrupado */}
      {isSelf && !isGrouped && !isSystemInvite && (
        <button
          type="button"
          aria-label={`Abrir opções de ${sender.name}`}
          onClick={(event) => openUserMenu(sender, event)}
          className="flex-shrink-0 ml-2 mt-1 block rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          {sender.avatar
            ? <img src={sender.avatar} alt="" className="w-10 h-10 rounded-full object-cover cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all ring-1 ring-border shadow-sm" />
            : <span className="grid w-10 h-10 place-items-center rounded-full bg-slate-700 text-white font-semibold">{senderInitials}</span>}
        </button>
      )}

      {/* YouTube Modal */}
      {isYouTubeModalOpen && youtubeVideoId && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4 animate-in fade-in duration-200" role="dialog" aria-modal="true" aria-label="Player do YouTube" onClick={() => setIsYouTubeModalOpen(false)}>
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
        <div className={`mt-2 flex flex-wrap gap-2 ${isSelf ? 'justify-end' : 'justify-start'}`}>
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

      {/* Reactions List */}
      {message.reactions && message.reactions.length > 0 && (
        <div className={`flex flex-wrap gap-1.5 mt-2 ${isSelf ? 'justify-end' : 'justify-start'}`}>
          {message.reactions.map((rx) => {
            const hasReacted = rx.users.includes(currentUser.id);
            return (
              <button
                key={rx.emoji}
                onClick={() => toggleReaction(message.id, rx.emoji)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all active:scale-95 ${
                  hasReacted
                    ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 font-semibold'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-400'
                }`}
              >
                <span>{rx.emoji}</span>
                <span>{rx.count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog (shadcn Dialog) */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apagar mensagem</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja apagar esta mensagem? Ela será removida para todos os participantes da conversa.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Apagar para todos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};