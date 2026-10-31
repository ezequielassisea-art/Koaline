import React from 'react';

export type ButtonVariant = 'primary' | 'outline' | 'ghost';
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant };

export const Button: React.FC<Props> = ({ variant = 'primary', className = '', type = 'button', ...props }) => (
  <button type={type} className={`ui-button ui-button-${variant} ${className}`.trim()} {...props} />
);
