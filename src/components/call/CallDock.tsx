import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  Maximize2,
  PhoneOff,
} from 'lucide-react';
import { ConfirmModal } from '../common/ConfirmModal';

export const CallDock: React.FC = () => {
  const {
    activeCall,
    leaveCall,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    toggleMinimizeCall,
  } = useApp();

  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  if (!activeCall || !activeCall.isMinimized) return null;

  return (
    <>
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-5 duration-300">
        <div
          onClick={toggleMinimizeCall}
          className="flex items-center gap-3 sm:gap-4 px-4 py-2.5 rounded-nest-pill bg-slate-900/90 backdrop-blur-xl border border-indigo-500/30 shadow-2xl hover:border-indigo-500/60 transition-all cursor-pointer group"
        >
          {/* Channel Name & Speaking Status */}
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div className="flex flex-col">
              <span className="text-xs font-title font-bold text-white leading-tight">
                {activeCall.channelName}
              </span>
              <span className="text-[10px] text-slate-400">
                {activeCall.participants.length} conectados
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800 hidden sm:block" />

          {/* Mini Avatars */}
          <div className="flex items-center -space-x-2">
            {activeCall.participants.slice(0, 4).map((p, idx) => (
              <div key={idx} className="relative">
                <img
                  src={p.user.avatar}
                  alt={p.user.name}
                  className={`w-7 h-7 rounded-full object-cover ring-2 transition-all ${
                    p.isSpeaking
                      ? 'ring-indigo-500 shadow-glow-speaking scale-105'
                      : 'ring-slate-900'
                  }`}
                />
                {p.isMuted && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-slate-800 flex items-center justify-center text-[8px] text-slate-400 ring-1 ring-slate-700">
                    ✕
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="h-6 w-px bg-slate-800" />

          {/* Inline Quick Controls */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5"
          >
            <button
              onClick={toggleMute}
              title={activeCall.isMicMuted ? 'Desmutar' : 'Mutar microfone'}
              className={`p-2 rounded-full transition-colors ${
                activeCall.isMicMuted
                  ? 'bg-rose-500/20 text-rose-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
            >
              {activeCall.isMicMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-indigo-400" />}
            </button>

            <button
              onClick={toggleCamera}
              title={activeCall.isCameraOn ? 'Desligar câmera' : 'Ligar câmera'}
              className={`p-2 rounded-full transition-colors ${
                activeCall.isCameraOn
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
            >
              {activeCall.isCameraOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={toggleScreenShare}
              title={activeCall.isScreenSharing ? 'Parar tela' : 'Compartilhar tela'}
              className={`p-2 rounded-full transition-colors hidden sm:flex ${
                activeCall.isScreenSharing
                  ? 'bg-sky-500/20 text-sky-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={toggleMinimizeCall}
              title="Expandir chamada"
              className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setShowLeaveConfirm(true)}
              title="Encerrar chamada"
              className="p-2 rounded-full bg-rose-600 text-white hover:bg-rose-500 shadow-sm transition-colors"
            >
              <PhoneOff className="w-3.5 h-3.5" />
            </button>
          </div>
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
