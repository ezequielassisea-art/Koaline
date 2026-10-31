import React from 'react';

type CoverImageProps = {
  src?: string | null;
  alt?: string;
  className?: string;
};

export const CoverImage: React.FC<CoverImageProps> = ({ src, alt = 'Capa do perfil', className = '' }) => <div
  role="img"
  aria-label={alt}
  className={`cover-image-component ${className}`}
  style={src ? { backgroundImage: `url("${src}")` } : undefined}
/>;

