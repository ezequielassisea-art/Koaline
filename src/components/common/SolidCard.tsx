import React from 'react';

export const SolidCard: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...props }) => (
  <div className={`solid-card ${className}`.trim()} {...props} />
);
