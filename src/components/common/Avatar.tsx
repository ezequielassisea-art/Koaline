import React, { useState } from 'react';

type AvatarProps = {
  src?: string | null;
  name: string;
  className?: string;
  size?: number;
};

export const Avatar: React.FC<AvatarProps> = ({ src, name, className = '', size }) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imageFailed = failedSrc === src;
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '◇';
  return <div role="img" aria-label={`Avatar de ${name || 'usuário'}`} className={`avatar-component ${className}`} style={size ? { width: size, height: size } : undefined}>
    {src && !imageFailed ? <img src={src} alt="" onError={() => setFailedSrc(src)} className="h-full w-full rounded-[inherit] object-cover" /> : <span aria-hidden="true">{initials}</span>}
  </div>;
};

