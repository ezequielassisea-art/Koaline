import React, { useEffect, useRef } from 'react';
import { Maximize2, Monitor, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const ScreenSharePiP: React.FC = () => {
  const { activeCall, currentUser, toggleScreenShare, stopWatchingScreen } = useApp();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = activeCall?.screenStream || null;
  }, [activeCall?.screenStream]);

  if (!activeCall?.isMinimized || !activeCall.isScreenSharing) return null;
  const watching = activeCall.isWatchingScreen && !!activeCall.screenStream;

  return <div className="fixed bottom-5 right-5 z-[80] w-72 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
    {watching ? <div className="relative aspect-video bg-black"><video ref={videoRef} autoPlay playsInline className="h-full w-full object-contain"/><div className="absolute right-2 top-2 flex gap-1"><button onClick={() => videoRef.current?.requestFullscreen?.()} aria-label="Tela cheia" title="Tela Cheia" className="rounded-lg bg-black/70 p-2 text-white"><Maximize2 className="h-4 w-4"/></button><button onClick={stopWatchingScreen} aria-label="Sair da transmissão" title="Sair da transmissão" className="rounded-lg bg-black/70 p-2 text-white"><X className="h-4 w-4"/></button></div></div> : <div className="flex items-center gap-3 p-4 text-white"><Monitor className="h-5 w-5 text-sky-400"/><div className="min-w-0 flex-1"><p className="text-xs font-semibold">Você está transmitindo</p><p className="text-[10px] text-slate-400">{currentUser.name}</p></div><button onClick={toggleScreenShare} className="rounded-lg bg-rose-600 px-2.5 py-2 text-[10px] font-semibold">Parar</button></div>}
    {watching && <div className="px-3 py-2 text-[10px] text-slate-400">Áudio da transmissão disponível apenas com LiveKit integrado</div>}
  </div>;
};

