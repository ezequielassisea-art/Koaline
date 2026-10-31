import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Music, Play, X } from 'lucide-react';
import { createPortal } from 'react-dom';
const EmojiPickerPopover = React.lazy(() => import('../common/EmojiPickerPopover').then((module) => ({ default: module.EmojiPickerPopover })));

export interface SoundDraft {
  id: string;
  name: string;
  emoji: string;
  url: string;
}

interface SoundEditorModalProps {
  file: File;
  theme: 'light' | 'dark';
  initialSound?: Pick<SoundDraft, 'id' | 'name' | 'emoji'>;
  onClose: () => void;
  onSave: (sound: SoundDraft) => void;
}

const makeAudioContext = () => {
  const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) throw new Error('Este navegador não oferece suporte à edição de áudio.');
  return new AudioContextCtor();
};

const encodeWav = (buffer: AudioBuffer, startSeconds: number, endSeconds: number) => {
  const sampleRate = buffer.sampleRate;
  const channels = buffer.numberOfChannels;
  const firstFrame = Math.floor(startSeconds * sampleRate);
  const lastFrame = Math.min(buffer.length, Math.floor(endSeconds * sampleRate));
  const frameCount = Math.max(0, lastFrame - firstFrame);
  const bytesPerSample = 2;
  const output = new ArrayBuffer(44 + frameCount * channels * bytesPerSample);
  const view = new DataView(output);
  const writeText = (offset: number, value: string) => { for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index)); };
  writeText(0, 'RIFF'); view.setUint32(4, output.byteLength - 8, true); writeText(8, 'WAVE');
  writeText(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bytesPerSample, true); view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, 16, true); writeText(36, 'data'); view.setUint32(40, frameCount * channels * bytesPerSample, true);
  const channelData = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  let offset = 44;
  for (let frame = firstFrame; frame < lastFrame; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][frame]));
      view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true);
      offset += bytesPerSample;
    }
  }
  return new Blob([output], { type: 'audio/wav' });
};

export const SoundEditorModal: React.FC<SoundEditorModalProps> = ({ file, theme, initialSound, onClose, onSave }) => {
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [name, setName] = useState(initialSound?.name || file.name.replace(/\.(mp3|wav)$/i, '').slice(0, 40));
  const [emoji, setEmoji] = useState(initialSound?.emoji || '🔊');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [fileUrl, setFileUrl] = useState('');
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const previewTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let audioContext: AudioContext | null = null;
    const decode = async () => {
      try {
        audioContext = makeAudioContext();
        const buffer = await audioContext.decodeAudioData(await file.arrayBuffer());
        if (cancelled) return;
        setAudioBuffer(buffer);
        setDuration(buffer.duration);
        setEnd(Math.min(buffer.duration, 10));
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Não foi possível abrir este áudio.');
      } finally {
        if (audioContext && audioContext.state !== 'closed') await audioContext.close();
        if (!cancelled) setLoading(false);
      }
    };
    void decode();
    return () => { cancelled = true; };
  }, [file]);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      if (previewTimerRef.current !== null) window.clearTimeout(previewTimerRef.current);
      previewRef.current?.pause();
    };
  }, [file]);

  const peaks = useMemo(() => {
    if (!audioBuffer) return [];
    const samples = audioBuffer.getChannelData(0);
    const bucketSize = Math.max(1, Math.floor(samples.length / 96));
    return Array.from({ length: 96 }, (_, bucket) => {
      let peak = 0;
      const limit = Math.min(samples.length, (bucket + 1) * bucketSize);
      for (let index = bucket * bucketSize; index < limit; index += 1) peak = Math.max(peak, Math.abs(samples[index]));
      return Math.max(8, peak * 100);
    });
  }, [audioBuffer]);

  const selectedDuration = end - start;
  const validDuration = selectedDuration >= 1 && selectedDuration <= 10;
  const formatTime = (value: number) => `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toFixed(1).padStart(4, '0')}`;

  const preview = () => {
    if (!duration || !fileUrl) return;
    const audio = previewRef.current || new Audio(fileUrl);
    previewRef.current = audio;
    audio.pause();
    audio.currentTime = start;
    setIsPreviewing(true);
    void audio.play().catch(() => setIsPreviewing(false));
    if (previewTimerRef.current !== null) window.clearTimeout(previewTimerRef.current);
    previewTimerRef.current = window.setTimeout(() => { audio.pause(); setIsPreviewing(false); }, Math.max(0, selectedDuration) * 1000);
  };

  const save = async () => {
    if (!audioBuffer || !validDuration || !name.trim()) return;
    try {
      const blob = encodeWav(audioBuffer, start, end);
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Não foi possível salvar o trecho.'));
        reader.onerror = () => reject(new Error('Não foi possível salvar o trecho.'));
        reader.readAsDataURL(blob);
      });
      onSave({ id: initialSound?.id || crypto.randomUUID(), name: name.trim(), emoji, url });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível recortar o áudio.');
    }
  };

  return createPortal(<div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="relative w-full max-w-xl overflow-visible rounded-2xl border border-slate-700 bg-slate-900 text-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="sound-editor-title">
      <header className="flex items-start justify-between border-b border-slate-800 px-5 py-4">
        <div><h2 id="sound-editor-title" className="text-base font-semibold">Adicionar som</h2><p className="mt-1 text-xs text-slate-400">Recorte um trecho de 1 a 10 segundos.</p></div>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" /></button>
      </header>
      <div className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2">
          <span className="flex min-w-0 items-center gap-2 text-xs text-slate-300"><Music className="h-4 w-4 shrink-0 text-cyan-400"/><span className="truncate">{file.name}</span></span>
          <button type="button" onClick={preview} disabled={loading || !duration} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50"><Play className="h-3.5 w-3.5"/>{isPreviewing ? 'Repetir trecho' : 'Ouvir trecho'}</button>
        </div>
        {loading ? <div className="flex h-24 items-center justify-center rounded-xl border border-slate-800 bg-slate-950 text-xs text-slate-400">Lendo forma de onda…</div> : <>
          <div className="flex h-24 items-center gap-[2px] overflow-hidden rounded-xl border border-slate-700 bg-slate-950 px-3" role="img" aria-label="Forma de onda do áudio">
            {peaks.map((peak, index) => {
              const time = (index / peaks.length) * duration;
              const selected = time >= start && time <= end;
              return <span key={index} className={`flex-1 rounded-full ${selected ? 'bg-cyan-400' : 'bg-slate-700'}`} style={{ height: `${peak}%` }} />;
            })}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="text-xs text-slate-300">Início <span className="text-slate-500">{formatTime(start)}</span><input type="range" min="0" max={Math.max(0, duration - 0.1)} step="0.1" value={start} onChange={(event) => { const nextStart = Number(event.target.value); setStart(nextStart); if (end - nextStart < 0.1) setEnd(Math.min(duration, nextStart + 0.1)); }} className="mt-2 w-full accent-cyan-400" /></label>
            <label className="text-xs text-slate-300">Fim <span className="text-slate-500">{formatTime(end)}</span><input type="range" min={Math.min(duration, start + 0.1)} max={duration} step="0.1" value={end} onChange={(event) => setEnd(Number(event.target.value))} className="mt-2 w-full accent-cyan-400" /></label>
          </div>
          <p className={`text-xs ${validDuration ? 'text-slate-400' : 'text-amber-300'}`} role="status">Trecho selecionado: {selectedDuration.toFixed(1)}s{!validDuration && (selectedDuration < 1 ? ' — escolha no mínimo 1 segundo.' : ' — o máximo permitido é 10 segundos.')}</p>
          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <label className="text-xs text-slate-300">Nome do som<input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} placeholder="Ex.: risada" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500" /></label>
            <div className="relative"><span className="mb-1.5 block text-xs text-slate-300">Emoji</span><button type="button" aria-label="Escolher emoji do som" aria-expanded={emojiPickerOpen} onClick={() => setEmojiPickerOpen((open) => !open)} className="grid h-10 w-12 place-items-center rounded-xl border border-slate-700 bg-slate-950 text-xl hover:border-cyan-500">{emoji}</button>{emojiPickerOpen && <React.Suspense fallback={<div className="absolute bottom-full right-0 z-[110] mb-2 rounded-xl border border-slate-700 bg-slate-900 p-4 text-xs text-slate-300">Carregando emojis…</div>}><EmojiPickerPopover theme={theme} onSelect={(value) => { setEmoji(value); setEmojiPickerOpen(false); }} onClose={() => setEmojiPickerOpen(false)} className="absolute bottom-full right-0 z-[110] mb-2 w-[min(22rem,calc(100vw-2rem))]" /></React.Suspense>}</div>
          </div>
        </>}
        {error && <p className="text-xs text-rose-300" role="alert">{error}</p>}
      </div>
      <footer className="flex justify-end gap-2 border-t border-slate-800 px-5 py-4">
        <button type="button" onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancelar</button>
        <button type="button" onClick={() => void save()} disabled={loading || !audioBuffer || !validDuration || !name.trim()} className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50">Salvar Som</button>
      </footer>
    </section>
  </div>, document.body);
};
