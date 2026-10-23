import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Plus, Hash, MessageSquare, UserPlus, X } from 'lucide-react';

export const QuickActionsFAB: React.FC = () => {
  const {
    setIsCreateChannelModalOpen,
    setIsDirectMessages,
    addToast
  } = useApp();

  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-40 select-none">
      {/* Expanded quick items */}
      {isOpen && (
        <div className="flex flex-col gap-2 mb-3 animate-in slide-in-from-bottom-3 duration-200">
          <button
            onClick={() => {
              setIsCreateChannelModalOpen(true);
              setIsOpen(false);
            }}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-nest-pill bg-surface-elevated border border-border shadow-nest-elevated hover:bg-surface text-xs font-semibold text-text-main transition-all group"
          >
            <div className="p-1 rounded-full bg-eucalyptus/20 text-eucalyptus group-hover:scale-110 transition-transform">
              <Hash className="w-3.5 h-3.5" />
            </div>
            <span>Criar canal</span>
          </button>

          <button
            onClick={() => {
              setIsDirectMessages(true);
              setIsOpen(false);
              addToast('Nova conversa', 'Escolha um membro na lista para bater papo!');
            }}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-nest-pill bg-surface-elevated border border-border shadow-nest-elevated hover:bg-surface text-xs font-semibold text-text-main transition-all group"
          >
            <div className="p-1 rounded-full bg-coral-amber/20 text-coral-amber group-hover:scale-110 transition-transform">
              <MessageSquare className="w-3.5 h-3.5" />
            </div>
            <span>Nova conversa direta</span>
          </button>

          <button
            onClick={() => {
              addToast('Link de Convite', 'Link copiado para a área de transferência! Convide seus amigos 🐨');
              setIsOpen(false);
            }}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-nest-pill bg-surface-elevated border border-border shadow-nest-elevated hover:bg-surface text-xs font-semibold text-text-main transition-all group"
          >
            <div className="p-1 rounded-full bg-amber-500/20 text-amber-500 group-hover:scale-110 transition-transform">
              <UserPlus className="w-3.5 h-3.5" />
            </div>
            <span>Convidar pessoa</span>
          </button>
        </div>
      )}

      {/* Main Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Ações Rápidas"
        className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-nest-elevated hover:scale-105 active:scale-95 transition-all duration-200 ${
          isOpen
            ? 'bg-charcoal hover:bg-black rotate-45'
            : 'bg-coral-amber hover:bg-coral-amber/90 shadow-glow-coral'
        }`}
      >
        <Plus className="w-6 h-6 transition-transform" />
      </button>
    </div>
  );
};
