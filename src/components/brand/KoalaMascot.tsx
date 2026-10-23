import React from 'react';

export const KoalineWordmark: React.FC<{ className?: string; size?: 'sm' | 'md' | 'lg' }> = ({
  className = '',
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl'
  };

  return (
    <div className={`flex items-center select-none ${className}`}>
      <span className={`font-title font-extrabold ${sizeClasses[size]} tracking-tight text-white`}>
        Koal<span className="text-primary bg-gradient-to-r from-violet-500 to-violet-400 bg-clip-text text-transparent">ine</span>
      </span>
    </div>
  );
};
