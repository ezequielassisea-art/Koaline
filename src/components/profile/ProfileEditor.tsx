import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Camera,
  Image as ImageIcon,
  Check,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { UserStatus } from '../../types';
import { ImageCropperModal } from '../common/ImageCropperModal';
import { Avatar } from '../common/Avatar';
import { CoverImage } from '../common/CoverImage';
import { requireSupabase } from '../../services/supabaseClient';

export const ProfileEditor: React.FC = () => {
  const {
    currentUser,
    updateCurrentUser,
    isProfileEditorOpen,
    setIsProfileEditorOpen,
    addToast
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
  const [cropImage, setCropImage] = useState('');
  const [cropTarget, setCropTarget] = useState<'avatar' | 'banner' | null>(null);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const deleteOwnAccount = async () => {
    if (deleteConfirmation !== 'EXCLUIR' || isDeletingAccount) return;
    setIsDeletingAccount(true);
    try {
      const client = requireSupabase();
      const { error } = await client.rpc('delete_own_account');
      if (error) throw error;
      await client.auth.signOut();
      localStorage.removeItem('koaline:current-user');
      setIsDeleteAccountOpen(false);
      setIsProfileEditorOpen(false);
      addToast('Conta excluída', 'Sua conta e os dados associados foram removidos.', 'success');
    } catch (error) {
      addToast('Erro ao excluir conta', error instanceof Error ? error.message : 'Tente novamente.', 'error');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleImageFile = (event: React.ChangeEvent<HTMLInputElement>, target: 'avatar' | 'banner') => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return addToast('Imagem inválida', 'Escolha uma imagem válida.', 'warning');
    if (file.size > 5 * 1024 * 1024) return addToast('Imagem muito grande', 'Imagem muito grande (máx 5MB).', 'warning');
    const reader = new FileReader();
    reader.onerror = () => addToast('Falha ao carregar imagem', 'Não foi possível carregar a imagem.', 'warning');
    reader.onload = () => {
      if (typeof reader.result !== 'string') return addToast('Falha ao carregar imagem', 'Não foi possível carregar a imagem.', 'warning');
      setCropImage(reader.result);
      setCropTarget(target);
    };
    try { reader.readAsDataURL(file); }
    catch { addToast('Falha ao carregar imagem', 'Não foi possível carregar a imagem.', 'warning'); }
  };

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

  return <>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60  animate-in fade-in select-none">
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
            <div className="relative mb-10 h-24 rounded-nest-sm profile-banner-gradient group">
              <CoverImage src={banner} alt="Capa do perfil" className="absolute inset-0 h-full w-full" />
              <input type="file" accept="image/*" className="hidden" aria-label="Escolher banner" onChange={(event) => handleImageFile(event, 'banner')} id="profile-banner-file" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => document.getElementById('profile-banner-file')?.click()}
                  className="px-3 py-1.5 rounded-nest-pill bg-slate-900 text-xs font-semibold text-slate-200 shadow-md flex items-center gap-1.5"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Trocar Banner</span>
                </button>
              </div>

              {/* Avatar position */}
              <div className="absolute bottom-0 left-1/2 z-20 -translate-x-1/2 translate-y-1/2 group/avatar">
                <div className="relative">
                  <Avatar src={avatar} name={name} className="w-20 h-20 rounded-full ring-4 ring-slate-900 shadow-xl" />
                  <input type="file" accept="image/*" className="hidden" aria-label="Escolher avatar" onChange={(event) => handleImageFile(event, 'avatar')} id="profile-avatar-file" />
                  <button
                    type="button"
                    onClick={() => document.getElementById('profile-avatar-file')?.click()}
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

          <section className="rounded-xl border border-rose-500/30 bg-rose-950/10 p-4">
            <h4 className="text-sm font-bold text-rose-300">Zona de Perigo</h4>
            <p className="mt-1 text-xs text-slate-400">A exclusão da conta é permanente e não pode ser desfeita.</p>
            <button type="button" onClick={() => { setDeleteConfirmation(''); setIsDeleteAccountOpen(true); }} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-500">
              <Trash2 className="h-4 w-4" />Excluir minha conta
            </button>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
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
  {isDeleteAccountOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-account-title"><div className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-slate-950 p-6 text-white shadow-2xl"><h2 id="delete-account-title" className="text-lg font-bold text-rose-300">Excluir minha conta?</h2><p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-950/40 p-3 text-sm font-semibold text-rose-100">Esta ação é permanente. Todas as suas mensagens, amizades e comunidades serão apagadas.</p><label htmlFor="delete-account-confirmation" className="mt-4 block text-xs text-slate-300">Digite <strong>EXCLUIR</strong> para confirmar</label><input id="delete-account-confirmation" autoFocus value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-rose-500"/><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={isDeletingAccount} onClick={() => setIsDeleteAccountOpen(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-300 hover:bg-slate-800">Cancelar</button><button type="button" disabled={deleteConfirmation !== 'EXCLUIR' || isDeletingAccount} onClick={() => void deleteOwnAccount()} className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50">{isDeletingAccount ? 'Excluindo…' : 'Excluir permanentemente'}</button></div></div></div>}
  <ImageCropperModal open={!!cropTarget && !!cropImage} imageSrc={cropImage} aspectRatio={cropTarget === 'banner' ? 16 / 6 : 1} cropShape={cropTarget === 'banner' ? 'rect' : 'round'} targetWidth={cropTarget === 'banner' ? 1600 : 512} targetHeight={cropTarget === 'banner' ? 600 : 512} onCancel={() => { setCropTarget(null); setCropImage(''); }} onConfirm={(cropped) => { if (cropTarget === 'banner') { setBanner(cropped); updateCurrentUser({ banner: cropped }); } else { setAvatar(cropped); updateCurrentUser({ avatar: cropped }); } setCropTarget(null); setCropImage(''); }} />
  </>;
};

