import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
} from 'lucide-react';
import { ConfirmModal } from '../common/ConfirmModal';

export const CallDock: React.FC = () => {
  const {
    activeCall,
    leaveCall,
    toggleMute,
    toggleCamera,
    toggleMinimizeCall,
  } = useApp();

  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  if (!activeCall || !activeCall.isMinimized) return null;

  return (
    <>
      <div
        role="group"
        aria-label={`Chamada minimizada: ${activeCall.channelName}. Clique para expandir.`}
        onClick={toggleMinimizeCall}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleMinimizeCall(); } }}
        tabIndex={0}
        className="flex h-12 max-w-full items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-2 shadow-xl  transition-all duration-300 ease-out animate-in slide-in-from-top-2 cursor-pointer hover:border-slate-500"
      >
        <span className="ml-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400 animate-pulse" />
        <span className="max-w-28 truncate text-xs font-semibold text-white" title={activeCall.channelName}>{activeCall.channelName}</span>
        <span className="hidden text-[10px] text-slate-400 sm:inline">{activeCall.participants.length} na sala</span>
        <div onClick={(event) => event.stopPropagation()} className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={toggleMute} title={activeCall.isMicMuted ? 'Ativar microfone' : 'Mutar microfone'} aria-label={activeCall.isMicMuted ? 'Ativar microfone' : 'Mutar microfone'} className={`grid h-8 w-8 place-items-center rounded-full transition-colors ${activeCall.isMicMuted ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}>
            {activeCall.isMicMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <button type="button" onClick={toggleCamera} title={activeCall.isCameraOn ? 'Desligar câmera' : 'Ligar câmera'} aria-label={activeCall.isCameraOn ? 'Desligar câmera' : 'Ligar câmera'} className={`grid h-8 w-8 place-items-center rounded-full transition-colors ${activeCall.isCameraOn ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}>
            {activeCall.isCameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => setShowLeaveConfirm(true)} title="Sair da chamada" aria-label="Sair da chamada" className="grid h-8 w-8 place-items-center rounded-full bg-rose-600 text-white transition-colors hover:bg-rose-500">
            <PhoneOff className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={showLeaveConfirm}
        title="Desconectar da chamada?"
        description="Você sairá da sala de voz e vídeo."
        confirmLabel="Desconectar"
        isDestructive
        onConfirm={() => {
          setShowLeaveConfirm(false);
          leaveCall();
        }}
        onCancel={() => setShowLeaveConfirm(false)}
      />
    </>
  );
};


