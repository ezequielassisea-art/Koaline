import React, { useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  User,
  MessageSquare,
  Phone,
  Video,
  VolumeX,
  UserX,
  Flag,
  Edit2
} from 'lucide-react';

export const UserOptionsMenu: React.FC = () => {
  const {
    activeUserMenu,
    closeUserMenu,
    openUserProfile,
    startDirectCall,
    addToast
  } = useApp();

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeUserMenu();
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  if (!activeUserMenu) return null;

  const { user, position } = activeUserMenu;

  return (
    <div
      ref={menuRef}
      style={{ top: position.y, left: position.x }}
      className="fixed z-50 w-56 p-1.5 rounded-nest-sm bg-slate-900 border border-slate-700 shadow-2xl animate-in fade-in zoom-in-95 select-none"
    >
      <div className="px-3 py-2 border-b border-slate-800 mb-1">
        <div className="font-bold text-xs text-white truncate">
          {user.name}
        </div>
        <div className="text-[10px] text-slate-400">@{user.handle}</div>
      </div>

      <div className="space-y-0.5 text-xs">
        <button
          onClick={() => {
            openUserProfile(user);
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-nest-sm text-left hover:bg-slate-800 text-slate-200 transition-colors"
        >
          <User className="w-3.5 h-3.5 text-indigo-400" />
          <span>Ver perfil</span>
        </button>

        <button
          onClick={() => {
            closeUserMenu();
            addToast('Conversa Direta', `Abrindo conversa privada com ${user.name}`);
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-nest-sm text-left hover:bg-slate-800 text-slate-200 transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
          <span>Enviar mensagem direta</span>
        </button>

        <button
          onClick={() => {
            closeUserMenu();
            startDirectCall(user, 'voice');
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-nest-sm text-left hover:bg-slate-800 text-slate-200 transition-colors"
        >
          <Phone className="w-3.5 h-3.5 text-emerald-400" />
          <span>Chamar (voz)</span>
        </button>

        <button
          onClick={() => {
            closeUserMenu();
            startDirectCall(user, 'video');
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-nest-sm text-left hover:bg-slate-800 text-slate-200 transition-colors"
        >
          <Video className="w-3.5 h-3.5 text-indigo-400" />
          <span>Chamar (vídeo)</span>
        </button>

        <div className="my-1 border-t border-slate-800" />

        <button
          onClick={() => {
            closeUserMenu();
            addToast('Apelido', `Definir apelido para ${user.name}`);
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-nest-sm text-left hover:bg-slate-800 text-slate-300 transition-colors"
        >
          <Edit2 className="w-3.5 h-3.5 text-slate-400" />
          <span>Adicionar apelido</span>
        </button>

        <button
          onClick={() => {
            closeUserMenu();
            addToast('Silenciado', `${user.name} foi silenciado.`);
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-nest-sm text-left hover:bg-slate-800 text-slate-300 transition-colors"
        >
          <VolumeX className="w-3.5 h-3.5 text-slate-400" />
          <span>Silenciar</span>
        </button>

        <div className="my-1 border-t border-slate-800" />

        <button
          onClick={() => {
            closeUserMenu();
            addToast('Bloqueado', `${user.name} foi bloqueado.`);
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-nest-sm text-left hover:bg-rose-500/15 text-rose-400 transition-colors"
        >
          <UserX className="w-3.5 h-3.5" />
          <span>Bloquear</span>
        </button>

        <button
          onClick={() => {
            closeUserMenu();
            addToast('Denúncia enviada', 'Nossa equipe de moderação irá avaliar.');
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-nest-sm text-left hover:bg-rose-500/15 text-rose-400 transition-colors"
        >
          <Flag className="w-3.5 h-3.5" />
          <span>Denunciar</span>
        </button>
      </div>
    </div>
  );
};

