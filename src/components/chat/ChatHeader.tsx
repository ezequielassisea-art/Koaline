import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Hash,
  Search,
  Pin,
  Users,
  Phone,
  Video,
  Archive
} from 'lucide-react';

interface ChatHeaderProps {
  onToggleSearch: () => void;
  isSearching: boolean;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ onToggleSearch, isSearching }) => {
  const {
    communities,
    currentCommunityId,
    currentChannelId,
    isDirectMessages,
    activeDmId,
    dms,
    isContextPanelOpen,
    setIsContextPanelOpen,
    startDirectCall,
    openUserProfile,
    toggleArchiveDm,
    addToast
  } = useApp();

  const activeCommunity = communities.find((c) => c.id === currentCommunityId) || communities[0];
  const activeChannel = activeCommunity.channels.find((c) => c.id === currentChannelId);
  const activeDm = dms.find((d) => d.id === activeDmId);

  return (
    <div className="h-14 px-4 border-b border-slate-800/60 bg-slate-900/70 backdrop-blur-md flex items-center justify-between sticky top-0 z-10 select-none">
      {/* Left: Channel / DM Info */}
      <div className="flex items-center gap-3 min-w-0">
        {isDirectMessages && activeDm ? (
          <div
            onClick={() => openUserProfile(activeDm.user)}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="relative">
              <img
                src={activeDm.user.avatar}
                alt={activeDm.user.name}
                className="w-8 h-8 rounded-full object-cover group-hover:ring-2 group-hover:ring-indigo-500 transition-all"
              />
              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-slate-900 ${
                activeDm.user.status === 'online' ? 'bg-emerald-500' : activeDm.user.status === 'idle' ? 'bg-amber-500' : 'bg-zinc-400'
              }`} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-title font-bold text-white group-hover:text-indigo-400 transition-colors">
                  {activeDm.user.name}
                </span>
                <span className="text-[10px] text-slate-400">@{activeDm.user.handle}</span>
              </div>
              <div className="text-[11px] text-emerald-400 font-medium">
                {activeDm.user.status === 'online' ? '● Online' : activeDm.user.status === 'idle' ? '● Ausente' : '○ Offline'}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
              <Hash className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-title font-bold text-white truncate">
                {activeChannel?.name || 'chat-geral'}
              </h2>
              {activeChannel?.topic && (
                <p className="text-[11px] text-slate-400 truncate hidden sm:block max-w-md">
                  {activeChannel.topic}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        {isDirectMessages && activeDm && (
          <>
            <button
              onClick={() => startDirectCall(activeDm.user, 'voice')}
              title="Chamada de voz"
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
            >
              <Phone className="w-4 h-4" />
            </button>
            <button
              onClick={() => startDirectCall(activeDm.user, 'video')}
              title="Chamada de vídeo"
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-indigo-400 transition-colors"
            >
              <Video className="w-4 h-4" />
            </button>
            <button
              onClick={() => toggleArchiveDm(activeDm.id)}
              title="Arquivar conversa"
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Archive className="w-4 h-4" />
            </button>
          </>
        )}

        {!isDirectMessages && (
          <button
            onClick={() => addToast('Mensagens Fixadas', 'Mensagens fixadas pelos moderadores.')}
            title="Mensagens fixadas"
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Pin className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={onToggleSearch}
          title="Buscar no canal"
          className={`p-2 rounded-lg transition-colors ${
            isSearching ? 'bg-indigo-600/20 text-indigo-400' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Search className="w-4 h-4" />
        </button>

        <button
          onClick={() => setIsContextPanelOpen(!isContextPanelOpen)}
          title="Painel de membros"
          className={`p-2 rounded-lg transition-colors ${
            isContextPanelOpen ? 'bg-indigo-600/20 text-indigo-400' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
