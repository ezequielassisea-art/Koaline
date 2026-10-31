import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme, updateTheme } = useApp();
  const nextTheme = theme.mode === 'dark' ? 'light' : 'dark';
  return <button type="button" className={`theme-toggle-button ${className}`.trim()}
    onClick={() => updateTheme({ mode: nextTheme })}
    aria-label={`Ativar tema ${nextTheme === 'dark' ? 'escuro' : 'claro'}`}
    aria-pressed={theme.mode === 'dark'} title={`Ativar tema ${nextTheme === 'dark' ? 'escuro' : 'claro'}`}>
    {theme.mode === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
  </button>;
};

