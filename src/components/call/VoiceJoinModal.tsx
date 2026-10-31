import React, { useState } from 'react';
import { Headphones, VolumeX, Users, X } from 'lucide-react';
import { Channel } from '../../types';

interface VoiceJoinModalProps {
  channel: Channel;
  onClose: () => void;
  onJoin: (isDeafened: boolean) => void;
}

export const VoiceJoinModal: React.FC<VoiceJoinModalProps> = ({ channel, onClose, onJoin }) => {
  const [isDeafened, setIsDeafened] = useState(false);
  const participants = channel.connectedUsers || [];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 " role="dialog" aria-modal="true" aria-labelledby="voice-join-title">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between border-b border-slate-800 p-5">
          <div>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10 text-sky-300">
              <Headphones className="h-5 w-5" />
            </div>
            <h2 id="voice-join-title" className="text-lg font-semibold text-white">{channel.name}</h2>
            <p className="mt-1 text-sm text-slate-400">{channel.topic || 'Sala de voz da comunidade'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-300">
            <Users className="h-4 w-4 text-slate-400" />
            <span>{participants.length} {participants.length === 1 ? 'pessoa na sala' : 'pessoas na sala'}</span>
          </div>
          {participants.length ? (
            <div className="flex flex-wrap gap-2">
              {participants.map((user) => (
                <div key={user.id} title={user.name} className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 py-1 pl-1 pr-3 text-xs text-slate-200">
                  {user.avatar ? <img src={user.avatar} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-700 font-semibold">{user.name.trim().charAt(0).toUpperCase() || '◇'}</span>}
                  <span className="max-w-32 truncate">{user.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-700 px-4 py-5 text-center text-sm text-slate-500">Ninguém entrou ainda. Seja a primeira pessoa.</p>
          )}

          <button type="button" onClick={() => setIsDeafened((value) => !value)} aria-pressed={isDeafened} className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${isDeafened ? 'border-rose-500/40 bg-rose-500/10 text-rose-300' : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'}`}>
            <VolumeX className="h-4 w-4" />
            {isDeafened ? 'Sala mutada — clique para ouvir' : 'Mutar Sala'}
          </button>
          <button type="button" onClick={() => onJoin(isDeafened)} className="mt-3 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-950/30 transition-all hover:bg-indigo-500 active:scale-[0.99]">
            Entrar na chamada
          </button>
        </div>
      </div>
    </div>
  );
};

