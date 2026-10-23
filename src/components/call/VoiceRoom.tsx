import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  Minimize2,
  PhoneOff,
  ChevronDown,
  Volume2
} from 'lucide-react';
import { EmptyState } from '../common/EmptyState';

export const VoiceRoom: React.FC = () => {
  const {
    activeCall,
    leaveCall,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    toggleMinimizeCall,
    switchCallChannel,
    communities,
    currentCommunityId,
    openUserProfile
  } = useApp();

  const [controlsVisible, setControlsVisible] = useState(true);
  const [showChannelDropdown, setShowChannelDropdown] = useState(false);

  useEffect(() => {
    let timeout: any;
    const handleMove = () => {
      setControlsVisible(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setControlsVisible(false);
      }, 3500);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchstart', handleMove);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchstart', handleMove);
    };
  }, []);

  if (!activeCall) return null;

  const currentComm = communities.find((c) => c.id === currentCommunityId) || communities[0];
  const voiceChannels = currentComm.channels.filter((c) => c.type === 'voice');

  const participants = activeCall.participants;
  const pCount = participants.length;
  let gridColsClass = 'grid-cols-1 md:grid-cols-2';
  if (pCount === 1) gridColsClass = 'grid-cols-1 max-w-md';
  else if (pCount === 2) gridColsClass = 'grid-cols-1 md:grid-cols-2 max-w-2xl';
  else if (pCount >= 3 && pCount <= 4) gridColsClass = 'grid-cols-2 max-w-3xl';
  else if (pCount >= 5) gridColsClass = 'grid-cols-2 lg:grid-cols-3 max-w-5xl';

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between p-6 bg-slate-950 overflow-hidden select-none">
      {/* Top Bar: Channel Switcher */}
      <div className="relative z-20 flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setShowChannelDropdown(!showChannelDropdown)}
            className="flex items-center gap-2 px-4 py-2 rounded-nest-pill bg-slate-900/90 border border-slate-700 shadow-xl hover:border-indigo-500/50 transition-all text-xs font-semibold text-white"
          >
            <Volume2 className="w-4 h-4 text-indigo-400 animate-pulse" />
            <span>{activeCall.channelName}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showChannelDropdown && (
            <div className="absolute top-full left-0 mt-2 w-56 p-2 rounded-nest-sm bg-slate-900 border border-slate-700 shadow-2xl z-30 animate-in fade-in zoom-in-95">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
                Trocar de Sala
              </div>
              {voiceChannels.map((vc) => (
                <button
                  key={vc.id}
                  onClick={() => {
                    switchCallChannel(vc);
                    setShowChannelDropdown(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-nest-sm text-left text-xs ${
                    vc.id === activeCall.channelId
                      ? 'bg-indigo-600/20 text-indigo-300 font-bold'
                      : 'hover:bg-slate-800 text-slate-200'
                  }`}
                >
                  <span className="truncate">{vc.name}</span>
                  <span className="text-[10px] text-slate-400">
                    {vc.connectedUsers?.length || 0} online
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={toggleMinimizeCall}
          title="Minimizar chamada"
          className="p-2 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white shadow-md transition-colors"
        >
          <Minimize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Screen Sharing Viewer */}
      {activeCall.isScreenSharing && (
        <div className="w-full max-w-4xl my-3 flex-1 rounded-nest bg-black/90 border border-indigo-500/40 shadow-2xl flex flex-col items-center justify-center p-6 text-center text-white relative overflow-hidden">
          <Monitor className="w-12 h-12 text-indigo-400 mb-3 animate-pulse" />
          <h4 className="text-base font-title font-bold">Você está compartilhando sua tela</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            Transmissão ativa em tempo real para os membros da chamada.
          </p>
          <button
            onClick={toggleScreenShare}
            className="mt-4 px-4 py-1.5 rounded-nest-pill bg-rose-600 hover:bg-rose-500 text-xs font-semibold"
          >
            Parar Transmissão
          </button>
        </div>
      )}

      {/* Center Participants Grid */}
      {!activeCall.isScreenSharing && (
        <div className="flex-1 w-full flex items-center justify-center py-6 overflow-y-auto">
          {participants.length === 0 ? (
            <EmptyState type="voice-empty" />
          ) : (
            <div className={`grid ${gridColsClass} gap-6 w-full justify-items-center items-center`}>
              {participants.map((p, idx) => (
                <div
                  key={idx}
                  onClick={() => openUserProfile(p.user)}
                  className="group relative flex flex-col items-center p-5 rounded-nest bg-slate-900/70 border border-slate-800 hover:border-indigo-500/50 shadow-xl transition-all cursor-pointer w-full max-w-xs"
                >
                  <div className="relative mb-3">
                    <img
                      src={p.user.avatar}
                      alt={p.user.name}
                      className={`w-24 h-24 rounded-full object-cover transition-all duration-200 ${
                        p.isSpeaking
                          ? 'ring-4 ring-indigo-500 shadow-glow-speaking scale-105'
                          : p.isMuted
                          ? 'ring-2 ring-slate-800 opacity-60'
                          : 'ring-2 ring-slate-700'
                      }`}
                    />

                    {p.isMuted && (
                      <span className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-slate-800 border border-slate-700 shadow-md flex items-center justify-center text-rose-400">
                        <MicOff className="w-3.5 h-3.5" />
                      </span>
                    )}

                    {p.isSpeaking && (
                      <span className="absolute -top-1 right-1 px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[9px] font-bold uppercase tracking-wider shadow-sm animate-pulse">
                        Falando
                      </span>
                    )}
                  </div>

                  <span className="text-xs font-title font-bold text-white truncate max-w-[180px]">
                    {p.user.name}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">
                    @{p.user.handle}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Floating Bottom Control Bar */}
      <div
        className={`relative z-20 flex items-center gap-3 px-5 py-3 rounded-nest-pill bg-slate-900/95 border border-slate-700 shadow-2xl backdrop-blur-xl transition-all duration-300 ${
          controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'
        }`}
      >
        <button
          onClick={toggleMute}
          title={activeCall.isMicMuted ? 'Ativar microfone' : 'Silenciar'}
          className={`p-3 rounded-full transition-all active:scale-95 ${
            activeCall.isMicMuted
              ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
              : 'bg-slate-800 hover:bg-slate-700 text-indigo-400'
          }`}
        >
          {activeCall.isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <button
          onClick={toggleCamera}
          title={activeCall.isCameraOn ? 'Desligar câmera' : 'Ligar câmera'}
          className={`p-3 rounded-full transition-all active:scale-95 ${
            activeCall.isCameraOn
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          }`}
        >
          {activeCall.isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        <button
          onClick={toggleScreenShare}
          title={activeCall.isScreenSharing ? 'Parar tela' : 'Compartilhar tela'}
          className={`p-3 rounded-full transition-all active:scale-95 ${
            activeCall.isScreenSharing
              ? 'bg-sky-500 text-white shadow-md'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          }`}
        >
          <Monitor className="w-5 h-5" />
        </button>

        <button
          onClick={toggleMinimizeCall}
          title="Minimizar para Call Dock"
          className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <Minimize2 className="w-5 h-5" />
        </button>

        <button
          onClick={leaveCall}
          title="Sair da sala"
          className="p-3 px-5 rounded-nest-pill bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs shadow-md transition-all active:scale-95 flex items-center gap-2"
        >
          <PhoneOff className="w-4 h-4" />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );
};
