import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Hash, Volume2 } from 'lucide-react';

export const CreateChannelModal: React.FC = () => {
  const {
    isCreateChannelModalOpen,
    setIsCreateChannelModalOpen,
    createChannel,
    communities,
    currentCommunityId
  } = useApp();

  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState<'text' | 'voice'>('text');

  const activeCommunity = communities.find((c) => c.id === currentCommunityId) || communities[0];
  const defaultCategory = activeCommunity?.categories[0]?.id || '';
  const [categoryId, setCategoryId] = useState(defaultCategory);

  if (!isCreateChannelModalOpen || !activeCommunity) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (channelName.trim()) {
      createChannel(channelName, channelType, categoryId);
      setChannelName('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60  animate-in fade-in select-none">
      <div className="w-full max-w-md bg-slate-900 rounded-nest-lg border border-slate-700 shadow-2xl overflow-hidden animate-in zoom-in-95">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-base font-title font-bold text-white">
            Criar Novo Canal
          </h3>
          <button
            onClick={() => setIsCreateChannelModalOpen(false)}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Tipo de Canal
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setChannelType('text')}
                className={`flex items-center gap-2.5 p-3 rounded-nest-sm border text-left transition-all ${
                  channelType === 'text'
                    ? 'border-indigo-500 bg-indigo-500/15 text-indigo-400 font-bold'
                    : 'border-slate-800 bg-slate-950 text-slate-400'
                }`}
              >
                <Hash className="w-4 h-4" />
                <div className="text-xs">
                  <div>Texto</div>
                  <div className="text-[10px] opacity-75 font-normal">Mensagens e arquivos</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setChannelType('voice')}
                className={`flex items-center gap-2.5 p-3 rounded-nest-sm border text-left transition-all ${
                  channelType === 'voice'
                    ? 'border-sky-500 bg-sky-500/15 text-sky-400 font-bold'
                    : 'border-slate-800 bg-slate-950 text-slate-400'
                }`}
              >
                <Volume2 className="w-4 h-4" />
                <div className="text-xs">
                  <div>Voz & Vídeo</div>
                  <div className="text-[10px] opacity-75 font-normal">Chamadas ao vivo</div>
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">
              Nome do Canal
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-500 text-xs">
                {channelType === 'text' ? '#' : '🔊'}
              </span>
              <input
                type="text"
                required
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="novo-canal"
                className="w-full pl-8 pr-3 py-2 rounded-nest-sm bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">
              Categoria
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 rounded-nest-sm bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              {activeCommunity.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsCreateChannelModalOpen(false)}
              className="px-4 py-2 rounded-nest-pill text-xs font-medium text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-nest-pill bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md active:scale-95 transition-all"
            >
              Criar Canal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

