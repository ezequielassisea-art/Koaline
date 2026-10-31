import React, { useEffect, useState } from 'react';
import { Music, Pencil, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ConfirmModal } from '../common/ConfirmModal';
import { SoundDraft, SoundEditorModal } from '../call/SoundEditorModal';
import { getGroupSounds, saveGroupSounds } from '../../services/GroupSoundStore';

interface GroupAudioSettingsProps {
  communityId: string;
}

export const GroupAudioSettings: React.FC<GroupAudioSettingsProps> = ({ communityId }) => {
  const { theme, addToast } = useApp();
  const [sounds, setSounds] = useState<SoundDraft[]>([]);
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [editingSound, setEditingSound] = useState<SoundDraft | null>(null);
  const [soundToDelete, setSoundToDelete] = useState<SoundDraft | null>(null);

  useEffect(() => { void getGroupSounds(communityId).then(setSounds).catch(() => setSounds([])); }, [communityId]);

  const persistSounds = async (next: SoundDraft[]) => {
    try {
      await saveGroupSounds(communityId, next);
      setSounds(next);
      window.dispatchEvent(new CustomEvent('koaline:community-sounds-updated', { detail: { communityId, sounds: next } }));
      return true;
    } catch {
      addToast('Não foi possível salvar', 'Remova alguns sons ou escolha trechos menores.', 'warning');
      return false;
    }
  };

  const selectUpload = (file?: File) => {
    if (!file) return;
    const supported = /^audio\/(mpeg|mp3|wav|x-wav)$/.test(file.type) || /\.(mp3|wav)$/i.test(file.name);
    if (!supported || file.size > 5 * 1024 * 1024) {
      addToast('Arquivo inválido', 'Escolha um arquivo MP3 ou WAV com até 5 MB.', 'warning');
      return;
    }
    setEditingSound(null);
    setDraftFile(file);
  };

  const editSound = async (sound: SoundDraft) => {
    try {
      const response = await fetch(sound.url);
      if (!response.ok) throw new Error('Não foi possível abrir o áudio salvo.');
      const blob = await response.blob();
      const file = new File([blob], `${sound.name || 'som'}.wav`, { type: blob.type || 'audio/wav' });
      setEditingSound(sound);
      setDraftFile(file);
    } catch (error) {
      addToast('Não foi possível editar', error instanceof Error ? error.message : 'Tente novamente.', 'warning');
    }
  };

  const saveSound = (sound: SoundDraft) => {
    const next = editingSound
      ? sounds.map((item) => item.id === editingSound.id ? sound : item)
      : [...sounds, sound];
    void persistSounds(next).then((saved) => { if (!saved) return;
    setDraftFile(null);
    setEditingSound(null);
    addToast(editingSound ? 'Áudio atualizado' : 'Áudio adicionado', editingSound ? 'As alterações foram salvas para este grupo.' : 'O som já está disponível para os membros deste grupo.', 'success');
    });
  };

  const deleteSound = () => {
    if (!soundToDelete) return;
    void persistSounds(sounds.filter((item) => item.id !== soundToDelete.id)).then((deleted) => { if (deleted) addToast('Áudio excluído', 'O som foi removido deste grupo.', 'success'); });
    setSoundToDelete(null);
  };

  return <>
    <div className="admin-title">
      <div><h1>Áudios do grupo</h1><p>Os sons são compartilhados pelos membros e ficam disponíveis somente neste grupo.</p></div>
      <label className="admin-button primary"><Plus /> Adicionar áudio<input className="sr-only" type="file" accept="audio/mpeg,audio/wav,.mp3,.wav" onChange={(event) => { selectUpload(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} /></label>
    </div>
    <div className="admin-card">
      <h3>Biblioteca de sons</h3>
      <p>Envie MP3 ou WAV de até 5 MB. Você pode recortar de 1 a 10 segundos, escolher um nome e um emoji.</p>
      {sounds.length ? sounds.map((sound) => <div className="admin-category" key={sound.id}>
        <span className="min-w-0"><strong className="mr-2 text-lg">{sound.emoji || '🔊'}</strong>{sound.name}<small>Disponível no Soundboard deste grupo</small></span>
        <audio controls preload="none" src={sound.url} aria-label={`Prévia do som ${sound.name}`} className="max-w-[220px]" />
        <button type="button" className="admin-button" title={`Editar ${sound.name}`} aria-label={`Editar ${sound.name}`} onClick={() => void editSound(sound)}><Pencil /> Editar</button>
        <button type="button" className="admin-button danger" title={`Excluir ${sound.name}`} aria-label={`Excluir ${sound.name}`} onClick={() => setSoundToDelete(sound)}><Trash2 /> Excluir</button>
      </div>) : <div className="admin-muted flex items-center gap-2"><Music className="h-4 w-4" />Este grupo ainda não tem sons.</div>}
    </div>
    {draftFile && <SoundEditorModal file={draftFile} theme={theme.mode} initialSound={editingSound || undefined} onClose={() => { setDraftFile(null); setEditingSound(null); }} onSave={saveSound} />}
    <ConfirmModal isOpen={!!soundToDelete} title="Excluir áudio?" description={`O som ${soundToDelete?.name ? `“${soundToDelete.name}”` : ''} será removido do Soundboard deste grupo para todos os membros.`} confirmLabel="Sim, excluir" cancelLabel="Cancelar" isDestructive onConfirm={deleteSound} onCancel={() => setSoundToDelete(null)} />
  </>;
};
