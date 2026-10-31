import React from 'react';
import { Check, Moon, RotateCcw, Sun, Type, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const ThemeCustomizer: React.FC = () => {
  const {
    theme,
    updateTheme,
    resetTheme,
    isThemeCustomizerOpen,
    setIsThemeCustomizerOpen,
  } = useApp();

  if (!isThemeCustomizerOpen) return null;

  const panelStyle: React.CSSProperties = {
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-elevated)',
    borderColor: 'var(--border)',
  };

  const modeButtonStyle = (selected: boolean): React.CSSProperties => ({
    backgroundColor: selected ? 'var(--accent)' : 'var(--bg-secondary)',
    color: selected ? 'var(--accent-text)' : 'var(--text-primary)',
    borderColor: selected ? 'var(--accent)' : 'var(--border)',
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60  animate-in fade-in"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setIsThemeCustomizerOpen(false);
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-customizer-title"
        className="w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden rounded-nest-lg border shadow-2xl animate-in zoom-in-95"
        style={panelStyle}
      >
        <header className="flex items-center justify-between gap-4 border-b px-6 py-4" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 id="theme-customizer-title" className="text-base font-title font-bold">
              Personalizar aparência
            </h2>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              Escolha o tema e ajuste a leitura.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsThemeCustomizerOpen(false)}
            aria-label="Fechar personalização de aparência"
            className="rounded-full p-2 transition-colors hover:bg-slate-800"
            style={{ color: 'var(--text-secondary)' }}
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-7 overflow-y-auto p-6">
          <fieldset>
            <legend className="mb-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              Tema
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                aria-pressed={theme.mode === 'light'}
                onClick={() => updateTheme({ mode: 'light' })}
                className="flex min-h-14 items-center justify-center gap-2 rounded-nest-sm border px-4 py-3 text-sm font-semibold transition-colors"
                style={modeButtonStyle(theme.mode === 'light')}
              >
                <Sun className="h-4 w-4" />
                Claro
                {theme.mode === 'light' && <Check aria-hidden="true" className="h-4 w-4" />}
              </button>
              <button
                type="button"
                aria-pressed={theme.mode === 'dark'}
                onClick={() => updateTheme({ mode: 'dark' })}
                className="flex min-h-14 items-center justify-center gap-2 rounded-nest-sm border px-4 py-3 text-sm font-semibold transition-colors"
                style={modeButtonStyle(theme.mode === 'dark')}
              >
                <Moon className="h-4 w-4" />
                Escuro
                {theme.mode === 'dark' && <Check aria-hidden="true" className="h-4 w-4" />}
              </button>
            </div>
          </fieldset>

          <section aria-labelledby="font-scale-label">
            <div className="mb-2 flex items-center justify-between gap-3">
              <label id="font-scale-label" htmlFor="theme-font-scale" className="flex items-center gap-2 text-sm font-semibold">
                <Type className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                Escala da fonte
              </label>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {theme.fontScale}%
              </span>
            </div>
            <input
              id="theme-font-scale"
              type="range"
              min="80"
              max="150"
              step="5"
              value={theme.fontScale}
              onChange={(event) => updateTheme({ fontScale: Number(event.target.value) })}
              className="w-full cursor-pointer"
              style={{ accentColor: 'var(--accent)' }}
            />
            <div className="mt-1 flex items-center justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
              <span>80%</span>
              <button
                type="button"
                onClick={() => updateTheme({ fontScale: 100 })}
                className="rounded px-2 py-1 font-medium hover:bg-slate-800"
              >
                Voltar para 100%
              </button>
              <span>150%</span>
            </div>
          </section>

          <section className="flex items-center justify-between gap-4 border-t pt-5" style={{ borderColor: 'var(--border)' }}>
            <div>
              <h3 className="text-sm font-semibold">Reduzir animações</h3>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                Reduz transições e movimentos da interface.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={theme.reduceMotion}
              aria-label="Reduzir animações"
              onClick={() => updateTheme({ reduceMotion: !theme.reduceMotion })}
              className="relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none"
              style={{
                backgroundColor: theme.reduceMotion ? 'var(--accent)' : 'var(--border-strong)',
              }}
            >
              <span
                className="absolute left-1 top-1 h-5 w-5 rounded-full shadow-sm transition-transform"
                style={{
                  backgroundColor: theme.reduceMotion ? 'var(--accent-text)' : 'var(--bg-elevated)',
                  transform: theme.reduceMotion ? 'translateX(20px)' : 'translateX(0)',
                }}
              />
            </button>
          </section>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t px-6 py-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-secondary)' }}>
          <button
            type="button"
            onClick={resetTheme}
            className="flex items-center gap-2 rounded-nest-sm border px-3 py-2 text-xs font-semibold transition-colors hover:bg-slate-800"
            style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Resetar tema
          </button>
          <button
            type="button"
            onClick={() => setIsThemeCustomizerOpen(false)}
            className="rounded-nest-sm px-5 py-2 text-xs font-semibold transition-colors"
            style={{ color: 'var(--accent-text)', backgroundColor: 'var(--accent)' }}
          >
            Concluir
          </button>
        </footer>
      </section>
    </div>
  );
};

