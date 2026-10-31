import React, { useState } from 'react';
import { Camera, Check, ImagePlus, UserRound } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Avatar } from '../common/Avatar';
import { CoverImage } from '../common/CoverImage';
import { ImageCropperModal } from '../common/ImageCropperModal';
import { AuthThemeToggle } from '../auth/AuthThemeToggle';

type CropTarget = 'avatar' | 'cover';

export const ProfileOnboarding: React.FC = () => {
  const { currentUser, updateCurrentUser, addToast } = useApp();
  const [avatar, setAvatar] = useState(currentUser.avatar || '');
  const [cover, setCover] = useState(currentUser.banner || '');
  const [cropImage, setCropImage] = useState('');
  const [cropTarget, setCropTarget] = useState<CropTarget | null>(null);
  const [saving, setSaving] = useState(false);

  const chooseImage = (event: React.ChangeEvent<HTMLInputElement>, target: CropTarget) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      addToast('Imagem inválida', 'Escolha um arquivo de imagem.', 'warning');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addToast('Arquivo muito grande', 'A imagem deve ter no máximo 5 MB.', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      setCropImage(reader.result);
      setCropTarget(target);
    };
    reader.onerror = () => addToast('Falha ao abrir imagem', 'Tente selecionar o arquivo novamente.', 'warning');
    reader.readAsDataURL(file);
  };

  const finish = () => {
    setSaving(true);
    updateCurrentUser({ avatar, banner: cover, onboarding_completed: true });
    setSaving(false);
  };

  return <div className="auth-experience auth-onboarding-overlay">
    <AuthThemeToggle />
    <main className="auth-card auth-onboarding-card" role="dialog" aria-modal="true" aria-labelledby="profile-onboarding-title">
      <div className="auth-brand-mark" aria-hidden="true"><UserRound /></div>
      <p className="auth-eyebrow">SEU PERFIL</p>
      <h1 id="profile-onboarding-title">Personalize seu perfil</h1>
      <p className="auth-description">Uma foto e uma capa ajudam sua comunidade a reconhecer você. Você pode trocar depois.</p>

      <section className="profile-onboarding-preview" aria-label="Prévia do perfil">
        <CoverImage src={cover} alt="Prévia da capa do perfil" className="profile-onboarding-cover" />
        <div className="profile-onboarding-avatar"><Avatar src={avatar} name={currentUser.name} className="profile-onboarding-avatar-image" /></div>
      </section>

      <div className="profile-onboarding-upload-grid">
        <section className="profile-onboarding-upload">
          <div><h2>Foto de perfil</h2><p>Quadrada, com recorte circular.</p></div>
          <label className="auth-secondary-button profile-upload-button" htmlFor="onboarding-avatar-upload"><Camera aria-hidden="true" />{avatar ? 'Trocar foto' : 'Adicionar foto'}</label>
          <input id="onboarding-avatar-upload" className="auth-visually-hidden" type="file" accept="image/*" onChange={(event) => chooseImage(event, 'avatar')} />
        </section>
        <section className="profile-onboarding-upload">
          <div><h2>Capa do perfil</h2><p>Formato panorâmico 16:6.</p></div>
          <label className="auth-secondary-button profile-upload-button" htmlFor="onboarding-cover-upload"><ImagePlus aria-hidden="true" />{cover ? 'Trocar capa' : 'Adicionar capa'}</label>
          <input id="onboarding-cover-upload" className="auth-visually-hidden" type="file" accept="image/*" onChange={(event) => chooseImage(event, 'cover')} />
        </section>
      </div>

      <div className="profile-onboarding-footer">
        <button type="button" className="auth-back-button" onClick={() => updateCurrentUser({ onboarding_completed: true })}>Pular por agora</button>
        <button type="button" className="auth-primary-button auth-submit-button" disabled={saving} onClick={finish}>{saving ? 'Salvando…' : 'Concluir'}<Check aria-hidden="true" /></button>
      </div>
    </main>
    <ImageCropperModal
      open={!!cropTarget && !!cropImage}
      imageSrc={cropImage}
      aspectRatio={cropTarget === 'cover' ? 16 / 6 : 1}
      cropShape={cropTarget === 'avatar' ? 'round' : 'rect'}
      targetWidth={cropTarget === 'cover' ? 1600 : 512}
      targetHeight={cropTarget === 'cover' ? 600 : 512}
      onCancel={() => { setCropTarget(null); setCropImage(''); }}
      onConfirm={(cropped) => { if (cropTarget === 'cover') setCover(cropped); else setAvatar(cropped); setCropTarget(null); setCropImage(''); }}
    />
  </div>;
};

