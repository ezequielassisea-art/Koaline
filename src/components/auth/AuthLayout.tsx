import React from 'react';

export const AuthLayout: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className = '' }) => (
  <div className={`auth-layout ${className}`.trim()}>{children}</div>
);

