import React, { useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Phone, Video, X, Loader2 } from 'lucide-react';
import { Avatar } from '../common/Avatar';

// Simple ringtone using Web Audio API
const playRingtone = (): { stop: () => void } | null => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
    oscillator.frequency.setValueAtTime(554, audioContext.currentTime + 0.3); // C#5
    oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.6); // E5
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime + 0.9); // A4

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 2);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 2);

    // Repeat every 3 seconds
    const intervalId = window.setInterval(() => {
      if (audioContext.state === 'closed') return;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, audioContext.currentTime);
      osc.frequency.setValueAtTime(554, audioContext.currentTime + 0.3);
      osc.frequency.setValueAtTime(659, audioContext.currentTime + 0.6);
      osc.frequency.setValueAtTime(440, audioContext.currentTime + 0.9);
      gain.gain.setValueAtTime(0.1, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 2);
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start();
      osc.stop(audioContext.currentTime + 2);
    }, 3000);

    return {
      stop: () => {
        clearInterval(intervalId);
        oscillator.stop();
        audioContext.close();
      }
    };
  } catch {
    return null;
  }
};

export const IncomingCallCard: React.FC = () => {
  const { incomingCall, outgoingCall, acceptIncomingCall, rejectIncomingCall, addToast } = useApp();
  const ringtoneRef = useRef<{ stop: () => void } | null>(null);

  // Play ringtone when incoming call appears
  useEffect(() => {
    if (incomingCall && !ringtoneRef.current) {
      ringtoneRef.current = playRingtone();
    }
    if (!incomingCall && ringtoneRef.current) {
      ringtoneRef.current.stop();
      ringtoneRef.current = null;
    }
    return () => {
      if (ringtoneRef.current) {
        ringtoneRef.current.stop();
        ringtoneRef.current = null;
      }
    };
  }, [incomingCall]);

  // Handle incoming call (receiving a call)
  if (incomingCall) {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] w-full max-w-md animate-in slide-in-from-top-4 duration-300">
        <div className="rounded-2xl border border-indigo-500/30 bg-slate-900/95 backdrop-blur-xl p-4 shadow-2xl ring-1 ring-indigo-500/20">
          <div className="flex items-center gap-4">
            {/* Caller Avatar */}
            <div className="relative flex-shrink-0">
              <Avatar
                src={incomingCall.callerAvatar}
                name={incomingCall.callerName}
                className="h-16 w-16 rounded-full ring-4 ring-indigo-500/50"
              />
              {/* Call type indicator */}
              <span className={`absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full ${incomingCall.type === 'video' ? 'bg-sky-500' : 'bg-indigo-500'}`}>
                {incomingCall.type === 'video' ? (
                  <Video className="h-3 w-3 text-white" />
                ) : (
                  <Phone className="h-3 w-3 text-white" />
                )}
              </span>
            </div>

            {/* Caller Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                Chamada de {incomingCall.callerName}
              </p>
              <p className="text-xs text-slate-400 truncate">
                @{incomingCall.callerHandle}
              </p>
              <p className="mt-1 text-xs text-indigo-300 flex items-center gap-1">
                {incomingCall.type === 'video' ? (
                  <>
                    <Video className="h-3 w-3" />
                    Chamada de vídeo
                  </>
                ) : (
                  <>
                    <Phone className="h-3 w-3" />
                    Chamada de voz
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex items-center justify-end gap-3">
            <button
              onClick={() => rejectIncomingCall()}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 transition-colors"
              title="Recusar"
              aria-label="Recusar chamada"
            >
              <X className="h-5 w-5" />
            </button>
            <button
              onClick={() => acceptIncomingCall()}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-colors active:scale-95"
              title="Aceitar"
              aria-label="Aceitar chamada"
            >
              {incomingCall.type === 'video' ? (
                <Video className="h-5 w-5" />
              ) : (
                <Phone className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Handle outgoing call (calling someone - waiting for them to answer)
  if (outgoingCall) {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] w-full max-w-md animate-in slide-in-from-top-4 duration-300">
        <div className="rounded-2xl border border-sky-500/30 bg-slate-900/95 backdrop-blur-xl p-4 shadow-2xl ring-1 ring-sky-500/20">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-slate-800 flex items-center justify-center ring-4 ring-sky-500/50 animate-pulse">
                <Loader2 className="h-8 w-8 text-sky-400 animate-spin" />
              </div>
              <span className={`absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full ${outgoingCall.type === 'video' ? 'bg-sky-500' : 'bg-indigo-500'}`}>
                {outgoingCall.type === 'video' ? (
                  <Video className="h-3 w-3 text-white" />
                ) : (
                  <Phone className="h-3 w-3 text-white" />
                )}
              </span>
            </div>

            <div>
              <p className="text-sm font-semibold text-white">
                Ligando para {outgoingCall.targetUserName}...
              </p>
              <p className="text-xs text-slate-400">
                {outgoingCall.type === 'video' ? 'Chamada de vídeo' : 'Chamada de voz'}
              </p>
            </div>

            <button
              onClick={() => {
                // Cancel the outgoing call
                // The leaveCall will handle cleanup
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 transition-colors"
              title="Cancelar"
              aria-label="Cancelar chamada"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};