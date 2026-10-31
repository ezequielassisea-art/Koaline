import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Send,
  Paperclip,
  Smile,
  AtSign,
  X,
  Reply,
  Mic,
  MicOff,
  StopCircle,
  Search,
  Loader2
} from 'lucide-react';
import { Message, User } from '../../types';
import { supabase } from '../../services/supabaseClient';
const EmojiPickerPopover = React.lazy(() => import('../common/EmojiPickerPopover').then((module) => ({ default: module.EmojiPickerPopover })));

interface MessageInputProps {
  replyTarget: Message | null;
  onClearReply: () => void;
}

const GIF_OPTIONS = [
  { label: 'Gato digitando', url: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif' },
  { label: 'Gato dançando', url: 'https://media.giphy.com/media/ICOgUNjpvO0PC/giphy.gif' },
  { label: 'Aplausos', url: 'https://media.giphy.com/media/3o6Zt6D0w8ad6V2bVA/giphy.gif' },
  { label: 'Comemoração', url: 'https://media.giphy.com/media/3o7aD4GrHwn8vsGBTa/giphy.gif' },
  { label: 'Surpresa', url: 'https://media.giphy.com/media/5VKbvrjxpVJCM/giphy.gif' },
  { label: 'Pensando', url: 'https://media.giphy.com/media/3o7btPCcdNniyf0ArS/giphy.gif' },
  { label: 'Joinha', url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif' },
  { label: 'Dança', url: 'https://media.giphy.com/media/l0HlPystfePnAI3G8/giphy.gif' },
  { label: 'Coração', url: 'https://media.giphy.com/media/26BRv0ThflsHCqDrG/giphy.gif' },
  { label: 'Risada', url: 'https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif' },
  { label: 'Aceno', url: 'https://media.giphy.com/media/3ohzdYJK1wAdPWVk88/giphy.gif' },
  { label: 'Festa', url: 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif' },
];

export const MessageInput: React.FC<MessageInputProps> = ({ replyTarget, onClearReply }) => {
  const {
    sendMessage,
    communities,
    currentCommunityId,
    currentChannelId,
    isDirectMessages,
    activeDmId,
    dms,
    setTypingStatus,
    addToast,
    theme,
  } = useApp();

  const [text, setText] = useState('');
  const lastTypingSentAtRef = useRef(0);
  const typingStopTimerRef = useRef<number | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMentionAutocomplete, setShowMentionAutocomplete] = useState(false);
  const [attachment, setAttachment] = useState<{ name: string; size: string; type: 'image' | 'video' | 'file'; url: string } | null>(null);
  const [isReadingAttachment, setIsReadingAttachment] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState('');
  const [gifResults, setGifResults] = useState(GIF_OPTIONS);
  const [gifLoading, setGifLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef(0);
  const recordingTimerRef = useRef<number | null>(null);
  const cursorPositionRef = useRef({ start: 0, end: 0 });

  useEffect(() => {
    if (!showGifPicker) return;
    const query = gifSearch.trim();
    if (!query) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setGifLoading(true);
      try {
        const apiKey = import.meta.env.VITE_TENOR_API_KEY?.trim();
        if (!apiKey) { setGifResults(GIF_OPTIONS); return; }
        const response = await fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${encodeURIComponent(apiKey)}&limit=12`, { signal: controller.signal });
        if (!response.ok) throw new Error('Tenor indisponível');
        const data = await response.json() as { results?: Array<{ id: string; content_description?: string; media_formats?: Record<string, { url?: string }> }> };
        const results = (data.results || []).map((item) => ({ label: item.content_description || 'GIF', url: item.media_formats?.gif?.url || item.media_formats?.mediumgif?.url || item.media_formats?.tinygif?.url || '' })).filter((item) => item.url);
        setGifResults(results.length ? results : GIF_OPTIONS);
      } catch {
        if (!controller.signal.aborted) setGifResults(GIF_OPTIONS);
      } finally {
        if (!controller.signal.aborted) setGifLoading(false);
      }
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [showGifPicker, gifSearch]);

  useEffect(() => {
    const insertMention = (event: Event) => {
      const handle = (event as CustomEvent<{ handle?: string }>).detail?.handle?.replace(/^@/, '').trim();
      if (!handle) return;
      const textarea = textareaRef.current;
      const start = textarea?.selectionStart ?? text.length;
      const end = textarea?.selectionEnd ?? text.length;
      const mention = `@${handle} `;
      const nextText = `${text.slice(0, start)}${mention}${text.slice(end)}`;
      setText(nextText);
      window.requestAnimationFrame(() => {
        textarea?.focus();
        const cursor = start + mention.length;
        textarea?.setSelectionRange(cursor, cursor);
        cursorPositionRef.current = { start: cursor, end: cursor };
      });
    };
    window.addEventListener('koaline:mention-user', insertMention);
    return () => window.removeEventListener('koaline:mention-user', insertMention);
  }, [text]);

  const activeCommunity = communities.find((c) => c && c.id === currentCommunityId) || communities[0] || null;
  const activeChannel = activeCommunity?.channels?.find((c) => c && c.id === currentChannelId) || null;
  const activeDm = dms.find((d) => d && d.id === activeDmId) || null;
  const typingTargetId = isDirectMessages ? activeDmId : currentChannelId;
  const memberSuggestions: User[] = [];

  const placeholderText = isDirectMessages
    ? (activeDm && activeDm.user ? `Conversar com @${activeDm.user.name}...` : 'Conversa privada...')
    : `Mensagem em #${activeChannel?.name || 'geral'}...`;

  const stopTyping = () => {
    if (typingStopTimerRef.current !== null) window.clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = null;
    if (typingTargetId) setTypingStatus(typingTargetId, false);
    lastTypingSentAtRef.current = 0;
  };

  const signalTyping = (value: string) => {
    if (!value.trim() || !typingTargetId) { stopTyping(); return; }
    const now = Date.now();
    if (now - lastTypingSentAtRef.current >= 2000) {
      setTypingStatus(typingTargetId, true);
      lastTypingSentAtRef.current = now;
    }
    if (typingStopTimerRef.current !== null) window.clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = window.setTimeout(stopTyping, 3000);
  };

  useEffect(() => () => {
    if (typingStopTimerRef.current !== null) window.clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = null;
    if (typingTargetId) setTypingStatus(typingTargetId, false);
  }, [typingTargetId]);

  const handleSend = async () => {
    if (isReadingAttachment || (!text.trim() && !attachment)) return;

    const attachmentsList = attachment
      ? [{ type: attachment.type, url: attachment.url, name: attachment.name, size: attachment.size }]
      : undefined;

    const replyData = replyTarget
      ? {
          id: replyTarget.id,
          senderName: replyTarget.sender.name,
          content: replyTarget.content,
        }
      : undefined;

    // Busca o usuário logado direto do Supabase no momento do envio
    if (supabase) {
      try {
        await supabase.auth.getUser();
      } catch {
        /* fallback gerenciado pelo AppContext */
      }
    }

    const sent = await sendMessage(text, replyData, attachmentsList);
    if (!sent) return;

    stopTyping();
    setText('');
    setAttachment(null);
    onClearReply();
    setShowEmojiPicker(false);
    setShowMentionAutocomplete(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? cursorPositionRef.current.start;
    const end = textarea?.selectionEnd ?? cursorPositionRef.current.end;
    const nextText = `${text.slice(0, start)}${emoji}${text.slice(end)}`;
    setText(nextText);
    setShowEmojiPicker(false);
    window.requestAnimationFrame(() => {
      if (!textarea) return;
      textarea.focus();
      const cursor = start + emoji.length;
      textarea.setSelectionRange(cursor, cursor);
      cursorPositionRef.current = { start: cursor, end: cursor };
    });
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    signalTyping(val);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }

    const lastWord = val.split(/\s+/).pop() || '';
    if (lastWord.startsWith('@')) {
      setShowMentionAutocomplete(true);
    } else {
      setShowMentionAutocomplete(false);
    }
  };

  const handleSelectMention = (user: User) => {
    const words = text.split(/\s+/);
    words.pop();
    setText([...words, `@${user.handle} `].join(' '));
    setShowMentionAutocomplete(false);
    if (textareaRef.current) textareaRef.current.focus();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const isImage = f.type.startsWith('image/');
    const isVideo = f.type === 'video/mp4' || /\.mp4$/i.test(f.name);
    const baseAttachment = {
      name: f.name,
      size: `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
      type: (isImage ? 'image' : isVideo ? 'video' : 'file') as 'image' | 'video' | 'file',
      url: '',
    };
    if (isImage || isVideo) {
      setIsReadingAttachment(true);
      const reader = new FileReader();
      reader.onload = () => { setAttachment({ ...baseAttachment, url: String(reader.result || '') }); setIsReadingAttachment(false); };
      reader.onerror = () => { setIsReadingAttachment(false); addToast('Não foi possível ler o arquivo', 'Tente selecionar a mídia novamente.', 'warning'); };
      reader.readAsDataURL(f);
    } else {
      setAttachment(baseAttachment);
    }
    e.target.value = '';
  };

  const handleRecordAudio = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      addToast('Gravação indisponível', 'Este navegador não oferece suporte à gravação de áudio.', 'warning');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) audioChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
        setIsRecording(false);
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (!audioBlob.size) return;
        const reader = new FileReader();
        reader.onload = () => {
          const replyData = replyTarget ? { id: replyTarget.id, senderName: replyTarget.sender.name, content: replyTarget.content } : undefined;
          sendMessage(String(reader.result || ''), replyData);
          onClearReply();
        };
        reader.onerror = () => addToast('Falha ao processar áudio', 'Tente gravar novamente.', 'warning');
        reader.readAsDataURL(audioBlob);
      };
      recorder.onerror = () => addToast('Falha na gravação', 'Verifique a permissão do microfone e tente novamente.', 'warning');
      recorder.start();
      recordingStartedAtRef.current = Date.now();
      setRecordingSeconds(0);
      setIsRecording(true);
      recordingTimerRef.current = window.setInterval(() => setRecordingSeconds(Math.floor((Date.now() - recordingStartedAtRef.current) / 1000)), 500);
    } catch {
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      mediaRecorderRef.current = null;
      addToast('Microfone não autorizado', 'Permita o acesso ao microfone para gravar uma mensagem.', 'warning');
    }
  };

  React.useEffect(() => () => {
    if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current);
    mediaRecorderRef.current?.stop();
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const formatRecordingTime = `${Math.floor(recordingSeconds / 60).toString().padStart(2, '0')}:${(recordingSeconds % 60).toString().padStart(2, '0')}`;

  return (
    <div className="p-3 border-t border-border relative select-none koaline-solid-panel">
      {/* Reply Banner */}
      {replyTarget && (
        <div className="mb-2 px-3 py-1.5 rounded-nest-sm bg-slate-900 border border-border flex items-center justify-between text-xs animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2 truncate">
            <Reply className="w-3.5 h-3.5 text-indigo-400 rotate-180" />
            <span className="font-semibold text-slate-200">
              Respondendo a {replyTarget.sender.name}:
            </span>
            <span className="text-slate-400 truncate">{replyTarget.content}</span>
          </div>
          <button
            onClick={onClearReply}
            className="p-1 rounded-full text-slate-400 hover:text-slate-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Attachment Pill */}
      {isReadingAttachment && <p className="mb-2 text-xs text-slate-400" role="status">Preparando mídia para envio…</p>}
      {attachment && (
        <div className="mb-2 flex w-fit items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-2 text-xs text-indigo-300">
          {attachment.type === 'image' && attachment.url ? <img src={attachment.url} alt="Prévia do anexo" className="h-10 w-10 rounded-lg object-cover" /> : attachment.type === 'video' && attachment.url ? <video src={attachment.url} className="h-10 w-14 rounded-lg object-cover" /> : <span aria-hidden="true">📎</span>}
          <span className="max-w-48 truncate">{attachment.name} ({attachment.size})</span>
          <button type="button" aria-label="Remover anexo" onClick={() => setAttachment(null)} className="ml-1 rounded-full p-1 hover:bg-slate-800 hover:opacity-75">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {isRecording && (
        <div className="mb-2 flex items-center gap-2 text-xs text-slate-300" role="status" aria-live="polite">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          <span>Gravando áudio</span>
          <span className="font-mono text-red-300">{formatRecordingTime}</span>
          <button type="button" onClick={handleRecordAudio} className="ml-1 inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 font-medium text-white hover:bg-red-500">
            <StopCircle className="h-3.5 w-3.5" /> Parar e enviar
          </button>
        </div>
      )}

      {/* Mention Autocomplete */}
      {showMentionAutocomplete && (
        <div className="absolute bottom-full left-4 mb-2 w-64 p-2 rounded-nest-sm bg-slate-900 border border-slate-700 shadow-2xl z-30 animate-in fade-in">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
            Mencionar membro
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {memberSuggestions.map((u) => (
              <button
                key={u.id}
                onClick={() => handleSelectMention(u as any)}
                className="w-full flex items-center gap-2 p-1.5 rounded-nest-sm hover:bg-slate-800 text-left text-xs text-slate-200"
              >
                <img src={u.avatar} alt={u.name} className="w-6 h-6 rounded-full object-cover" />
                <div className="truncate">
                  <div className="font-semibold truncate">{u.name}</div>
                  <div className="text-[10px] text-slate-400">@{u.handle}</div>
                </div>
              </button>
            ))}
            {memberSuggestions.length === 0 && <p className="px-2 py-3 text-xs text-slate-500">Nenhum membro para mencionar.</p>}
          </div>
        </div>
      )}

      {/* Emoji Picker */}
      {showEmojiPicker && <React.Suspense fallback={<div className="absolute bottom-full right-2 z-40 mb-2 rounded-xl border border-slate-700 bg-slate-900 p-4 text-xs text-slate-300">Carregando emojis…</div>}><EmojiPickerPopover theme={theme.mode} onSelect={insertEmoji} onClose={() => setShowEmojiPicker(false)} className="absolute bottom-full right-2 z-40 mb-2 w-[min(22rem,calc(100vw-2rem))] animate-in zoom-in-95" /></React.Suspense>}

      {showGifPicker && (
        <div className="absolute bottom-full right-4 z-30 mb-2 w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-2xl animate-in fade-in zoom-in-95" role="dialog" aria-label="Escolher GIF">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">Escolha um GIF</span>
            <button type="button" onClick={() => setShowGifPicker(false)} aria-label="Fechar GIFs" className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-3.5 w-3.5" /></button>
          </div>
          <label className="mb-2 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-slate-400">
            <Search className="h-4 w-4 shrink-0" />
            <input value={gifSearch} onChange={(event) => { const value = event.target.value; setGifSearch(value); if (!value.trim()) { setGifResults(GIF_OPTIONS); setGifLoading(false); } else setGifLoading(true); }} placeholder="Buscar GIFs" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-500" />
            {gifLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          </label>
          <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto">
            {gifResults.map((gif) => (
              <button key={gif.url} type="button" onClick={() => { sendMessage(gif.url); setShowGifPicker(false); onClearReply(); }} title={gif.label} aria-label={`Enviar GIF: ${gif.label}`} className="overflow-hidden rounded-lg border border-slate-700 bg-slate-800 transition-transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <img src={gif.url} alt={gif.label} loading="lazy" className="aspect-square w-full object-cover" />
              </button>
            ))}
            {!gifLoading && gifResults.length === 0 && <p className="col-span-3 py-6 text-center text-xs text-slate-500">Nenhum GIF encontrado.</p>}
          </div>
        </div>
      )}

      {/* Main Input Box */}
      <div className="flex items-end gap-2 p-2 rounded-nest bg-surface-sunken border border-border focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*,video/mp4,*/*"
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Anexar arquivo"
          className="p-2 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={handleTextChange}
          onSelect={(event) => { cursorPositionRef.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }; }}
          onKeyDown={handleKeyDown}
          placeholder={placeholderText}
          className="flex-1 bg-transparent border-0 resize-none py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none max-h-32"
        />

        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setText((prev) => prev + '@');
              setShowMentionAutocomplete(true);
            }}
            title="Mencionar pessoa"
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <AtSign className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); }}
            title="Escolher emoji"
            aria-label="Escolher emoji"
            aria-expanded={showEmojiPicker}
            className="p-1.5 rounded-full text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
          >
            <Smile className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => { if (!showGifPicker) { setGifSearch(''); setGifResults(GIF_OPTIONS); setGifLoading(false); } setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); }}
            title="Escolher GIF"
            aria-label="Escolher GIF"
            aria-expanded={showGifPicker}
            className="rounded-full px-1.5 py-1 text-[10px] font-bold text-slate-400 transition-colors hover:bg-slate-800 hover:text-indigo-300"
          >
            GIF
          </button>

          <button
            type="button"
            onClick={handleRecordAudio}
            title={isRecording ? 'Parar e enviar áudio' : 'Gravar mensagem de áudio'}
            aria-label={isRecording ? 'Parar e enviar áudio' : 'Gravar mensagem de áudio'}
            className={`rounded-full p-1.5 transition-colors ${isRecording ? 'bg-red-500/15 text-red-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
          >
            {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>

          <button
            onClick={handleSend}
            disabled={isReadingAttachment || (!text.trim() && !attachment)}
            title="Enviar mensagem"
            className={`p-2 rounded-full transition-all active:scale-95 ${
              (!isReadingAttachment && text.trim()) || attachment
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};



