import React, { useEffect, useState } from 'react';
import { AtSign, Camera, Check, ImagePlus, UserRound } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Avatar } from '../common/Avatar';
import { ImageCropperModal } from '../common/ImageCropperModal';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { requireSupabase } from '../../services/supabaseClient';

type CropTarget = 'avatar' | 'cover';

export const ProfileOnboarding: React.FC = () => {
  const { currentUser, completeOnboarding, addToast } = useApp();
  const [avatar, setAvatar] = useState(currentUser.avatar || '');
  const [cover, setCover] = useState('');
  const [cropImage, setCropImage] = useState('');
  const [cropTarget, setCropTarget] = useState<CropTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [handle, setHandle] = useState(currentUser.handle.replace(/^@/, ''));
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const [checkingHandle, setCheckingHandle] = useState(false);
  const normalizedHandle = handle.trim().replace(/^@/, '').toLowerCase();
  const validHandle = /^[a-z0-9_]{3,20}$/.test(normalizedHandle);
  useEffect(() => {
    if (!validHandle) { setHandleAvailable(null); setCheckingHandle(false); return; }
    let active = true;
    setCheckingHandle(true);
    const timer = window.setTimeout(async () => {
      try {
        const { data, error } = await requireSupabase().from('profiles').select('id').eq('username', normalizedHandle).neq('id', currentUser.id).limit(1);
        if (!active) return;
        if (error) throw error;
        setHandleAvailable(!data?.length);
      } catch { if (active) setHandleAvailable(null); }
      finally { if (active) setCheckingHandle(false); }
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [normalizedHandle, validHandle, currentUser.id]);

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

  const finish = async () => {
    if (!validHandle || handleAvailable !== true) return;
    setSaving(true);
    await completeOnboarding({ handle: normalizedHandle, avatar, banner: cover });
    setSaving(false);
  };

  return <div className="auth-layout">
    <div className="auth-card" role="dialog" aria-modal="true" aria-labelledby="profile-onboarding-title">
      <div className="auth-logo"><UserRound className="w-10 h-10 mx-auto text-primary" /></div>
      <h1 id="profile-onboarding-title" className="auth-title">Personalize seu perfil</h1>
      <p className="auth-description">Uma foto e uma capa ajudam sua comunidade a reconhecer você. Você pode trocar depois.</p>

      <Input id="onboarding-username" label="Seu @username" variant="auth" startAdornment={<AtSign />} required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" value={handle} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setHandle(event.target.value.replace(/^@/, ''))} aria-describedby="handle-help" aria-invalid={!!handle && (!validHandle || handleAvailable === false)} />
      <p id="handle-help" className={`auth-field-hint ${handleAvailable === true ? 'is-success' : handleAvailable === false ? '' : ''}`}>{checkingHandle ? 'Verificando @…' : handleAvailable === true ? '✅ @ disponível' : handleAvailable === false ? '❌ @ já em uso' : 'Escolha um @ único (3–20 letras, números ou _).'}</p>

      <section className="profile-onboarding-preview" aria-label="Prévia do perfil">
        <div className="profile-onboarding-cover" role="img" aria-label={cover ? 'Prévia da capa do perfil escolhida' : 'Espaço opcional para capa do perfil'} style={cover ? { backgroundImage: `url("${cover}")` } : undefined}>
          {!cover && <span className="profile-onboarding-cover-placeholder">Capa opcional</span>}
        </div>
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

      <Button type="button" variant="auth-primary" disabled={saving || checkingHandle || !validHandle || handleAvailable !== true} onClick={finish}>{saving ? 'Salvando…' : 'Concluir'}<Check aria-hidden="true" /></Button>
    </div>
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

