import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Camera,
  Image as ImageIcon,
  Check,
  RotateCcw
} from 'lucide-react';
import { UserStatus } from '../../types';

export const ProfileEditor: React.FC = () => {
  const {
    currentUser,
    updateCurrentUser,
    isProfileEditorOpen,
    setIsProfileEditorOpen
  } = useApp();

  const [name, setName] = useState(currentUser.name);
  const [handle, setHandle] = useState(currentUser.handle);
  const [bio, setBio] = useState(currentUser.bio || '');
  const [statusText, setStatusText] = useState(currentUser.customStatus?.text || '');
  const [statusEmoji, setStatusEmoji] = useState(currentUser.customStatus?.emoji || '⚡');
  const [status, setStatus] = useState<UserStatus>(currentUser.status);
  const [pronouns, setPronouns] = useState(currentUser.pronouns || '');
  const [avatar, setAvatar] = useState(currentUser.avatar);
  const [banner, setBanner] = useState(currentUser.banner || '');
  const [interests, setInterests] = useState<string[]>(currentUser.interests || []);
  const [newInterest, setNewInterest] = useState('');

  if (!isProfileEditorOpen) return null;

  const handleSave = () => {
    updateCurrentUser({
      name,
      handle,
      bio,
      status,
      customStatus: { emoji: statusEmoji, text: statusText },
      pronouns,
      avatar,
      banner,
      interests,
    });
    setIsProfileEditorOpen(false);
  };

  const handleAddInterest = () => {
    if (newInterest.trim() && !interests.includes(newInterest.trim())) {
      setInterests([...interests, newInterest.trim()]);
      setNewInterest('');
    }
  };

  const handleRemoveInterest = (item: string) => {
    setInterests(interests.filter((i) => i !== item));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in select-none">
      <div className="w-full max-w-xl max-h-[90vh] bg-slate-900 rounded-nest-lg border border-slate-700 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-title font-bold text-white">
              Editar Perfil
            </h3>
            <p className="text-xs text-slate-400">
              Personalize sua identidade e disponibilidade
            </p>
          </div>
          <button
            onClick={() => setIsProfileEditorOpen(false)}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Banner & Avatar Preview */}
          <div>
            <div className="relative h-28 rounded-nest-sm bg-gradient-to-r from-indigo-600 via-indigo-700 to-slate-800 overflow-hidden group">
              {banner && (
                <img src={banner} alt="Banner" className="w-full h-full object-cover" />
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => {
                    const newUrl = prompt('Insira o link da imagem para seu banner:', banner);
                    if (newUrl) setBanner(newUrl);
                  }}
                  className="px-3 py-1.5 rounded-nest-pill bg-slate-900 text-xs font-semibold text-slate-200 shadow-md flex items-center gap-1.5"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Trocar Banner</span>
                </button>
              </div>

              {/* Avatar position */}
              <div className="absolute bottom-2 left-4 group/avatar">
                <div className="relative">
                  <img
                    src={avatar}
                    alt={name}
                    className="w-14 h-14 rounded-full object-cover ring-4 ring-slate-900 shadow-xl"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newAv = prompt('Insira o link da imagem para seu avatar:', avatar);
                      if (newAv) setAvatar(newAv);
                    }}
                    className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center text-white opacity-0 group-hover/avatar:opacity-100 transition-opacity"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">
                Nome de Exibição
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-nest-sm bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">
                Identificador (@handle)
              </label>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                className="w-full px-3 py-2 rounded-nest-sm bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">
                Disponibilidade
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as UserStatus)}
                className="w-full px-3 py-2 rounded-nest-sm bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="online">🟢 Online</option>
                <option value="idle">🟡 Ausente</option>
                <option value="dnd">🔴 Não Perturbe</option>
                <option value="offline">⚪ Invisível</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-400 mb-1">
                Status Personalizado
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={statusEmoji}
                  onChange={(e) => setStatusEmoji(e.target.value)}
                  maxLength={2}
                  className="w-12 text-center py-2 rounded-nest-sm bg-slate-950 border border-slate-800 text-sm text-white"
                />
                <input
                  type="text"
                  value={statusText}
                  onChange={(e) => setStatusText(e.target.value)}
                  placeholder="O que você está fazendo?"
                  className="flex-1 px-3 py-2 rounded-nest-sm bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">
              Biografia
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Descreva suas habilidades, atuação e o que você gosta de construir..."
              className="w-full px-3 py-2 rounded-nest-sm bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">
              Interesses & Tecnologias
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {interests.map((item) => (
                <span
                  key={item}
                  className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 font-medium border border-indigo-500/20"
                >
                  <span>{item}</span>
                  <button onClick={() => handleRemoveInterest(item)} className="hover:opacity-75">
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newInterest}
                onChange={(e) => setNewInterest(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddInterest())}
                placeholder="Adicionar tag (Enter)"
                className="flex-1 px-3 py-1.5 rounded-nest-sm bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddInterest}
                className="px-3 py-1.5 rounded-nest-sm bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setName(currentUser.name);
              setBio(currentUser.bio || '');
            }}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Resetar</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsProfileEditorOpen(false)}
              className="px-4 py-2 rounded-nest-pill text-xs font-medium text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-nest-pill bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Salvar Alterações</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
