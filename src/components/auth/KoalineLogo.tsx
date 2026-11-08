import React from 'react';

export const KoalineLogo: React.FC<{ className?: string }> = ({ className = '' }) => (
  <h1 className={`flex items-center justify-center whitespace-nowrap text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900 mb-8 ${className}`.trim()} aria-label="Koaline!">
    Koaline<span className="text-blue-600">!</span>
  </h1>
);

