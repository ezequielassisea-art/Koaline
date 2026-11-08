import React from 'react';

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'auth-primary' | 'auth-outline' | 'auth-large' | 'auth-google' | 'auth-back' | 'auth-icon';
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant };

export const Button: React.FC<Props> = ({ variant = 'primary', className = '', type = 'button', ...props }) => {
  const authVariants = ['auth-primary', 'auth-outline', 'auth-large', 'auth-google', 'auth-back', 'auth-icon'];
  const isAuth = authVariants.includes(variant);
  const baseClass = isAuth ? `auth-button auth-button-${variant.replace('auth-', '')}` : `ui-button ui-button-${variant}`;
  return (
    <button type={type} className={`${baseClass} ${className}`.trim()} {...props} />
  );
};
