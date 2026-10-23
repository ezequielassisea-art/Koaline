import React, { useEffect, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { useApp } from '../../context/AppContext';
import { X } from 'lucide-react';

type Props = {
  open: boolean;
  imageSrc: string;
  aspectRatio: number;
  cropShape: 'round' | 'rect';
  targetWidth: number;
  targetHeight: number;
  onCancel: () => void;
  onConfirm: (croppedBase64: string) => void;
};

async function getCroppedImg(imageSrc: string, area: Area, targetW: number, targetH: number) {
  const image = new Image();
  image.src = imageSrc;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Image load failed'));
  });
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, targetW, targetH);
  let result = canvas.toDataURL('image/jpeg', 0.9);
  if (result.length > 500 * 1024) result = canvas.toDataURL('image/jpeg', 0.7);
  return result;
}

export const ImageCropperModal: React.FC<Props> = ({ open, imageSrc, aspectRatio, cropShape, targetWidth, targetHeight, onCancel, onConfirm }) => {
  const { addToast } = useApp();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onCancel]);

  if (!open) return null;

  const save = async () => {
    if (!pixels) return;
    setSaving(true);
    try {
      onConfirm(await getCroppedImg(imageSrc, pixels, targetWidth, targetHeight));
    } catch {
      addToast('Erro ao processar imagem', 'Não foi possível gerar o recorte. Tente outra imagem.', 'warning');
    } finally { setSaving(false); }
  };

  return <div className="image-cropper-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <section className="image-cropper-modal" role="dialog" aria-modal="true" aria-label="Recortar imagem">
      <header><strong>Recortar imagem</strong><button onClick={onCancel} aria-label="Cancelar recorte"><X /></button></header>
      <div className="image-cropper-stage"><Cropper image={imageSrc} crop={crop} zoom={zoom} aspect={aspectRatio} cropShape={cropShape} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, areaPixels) => setPixels(areaPixels)} zoomWithScroll restrictPosition={false} /></div>
      <label className="image-cropper-zoom">Zoom <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
      <footer><button type="button" onClick={onCancel}>Cancelar</button><button type="button" autoFocus disabled={!pixels || saving} onClick={save}>{saving ? 'Salvando…' : 'Salvar'}</button></footer>
    </section>
  </div>;
};
