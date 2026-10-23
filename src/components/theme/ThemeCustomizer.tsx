import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Palette,
  Type,
  Check,
  RotateCcw,
  Download,
  Upload
} from 'lucide-react';
import { ThemePreset, Density } from '../../types';

const PRESET_OPTIONS: Array<{ id: ThemePreset; name: string; color: string; desc: string }> = [
  { id: 'dark', name: 'Dark Slate (Padrão)', color: '#0F172A', desc: 'Fundo slate escuro e profissional' },
  { id: 'amoled', name: 'Preto AMOLED', color: '#000000', desc: 'Contraste máximo e pretos absolutos' },
  { id: 'light', name: 'Claro Clean', color: '#F8FAFC', desc: 'Modo claro com alto contraste' },
  { id: 'neon', name: 'Cyber Violet', color: '#8B5CF6', desc: 'Acentos roxos e estética futurista' },
  { id: 'minimalist', name: 'Minimalista Zinc', color: '#18181B', desc: 'Tons de cinza sóbrios e elegantes' },
];

const ACCENT_PRESETS = [
  '#6366F1', // Indigo Principal
  '#38BDF8', // Sky Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
];

export const ThemeCustomizer: React.FC = () => {
  const {
    theme,
    updateTheme,
    resetTheme,
    isThemeCustomizerOpen,
    setIsThemeCustomizerOpen,
    addToast
  } = useApp();

  if (!isThemeCustomizerOpen) return null;

  const handleExportTheme = () => {
    const json = JSON.stringify(theme, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `koaline-theme-${theme.preset}.json`;
    a.click();
    addToast('Tema Exportado', 'Arquivo de configuração salvo.');
  };

  const handleImportTheme = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          updateTheme(parsed);
          addToast('Tema Carregado', 'Preferências visuais aplicadas com sucesso.');
        } catch (err) {
          addToast('Erro', 'Arquivo JSON inválido.', 'warning');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in select-none">
      <div className="w-full max-w-xl max-h-[90vh] bg-slate-900 rounded-nest-lg border border-slate-700 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-nest-sm bg-indigo-500/15 text-indigo-400">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-title font-bold text-white">
                Personalizar Aparência
              </h3>
              <p className="text-xs text-slate-400">
                Ajuste temas, cores de destaque e densidade
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsThemeCustomizerOpen(false)}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable controls */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
              Tema Base
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PRESET_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => updateTheme({ preset: opt.id })}
                  className={`flex items-start gap-3 p-3 rounded-nest-sm text-left border transition-all ${
                    theme.preset === opt.id
                      ? 'border-indigo-500 bg-indigo-500/10 shadow-sm ring-1 ring-indigo-500/30'
                      : 'border-slate-800 bg-slate-950/60 hover:bg-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div
                    className="w-5 h-5 rounded-full border border-white/20 flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: opt.color }}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white">
                      {opt.name}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                      {opt.desc}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Cor de Destaque
            </label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {ACCENT_PRESETS.map((color) => (
                  <button
                    key={color}
                    onClick={() => updateTheme({ accentColor: color })}
                    className="w-7 h-7 rounded-full transition-transform hover:scale-110 flex items-center justify-center ring-2 ring-slate-900 shadow-sm"
                    style={{ backgroundColor: color }}
                  >
                    {theme.accentColor === color && (
                      <Check className="w-3.5 h-3.5 text-white drop-shadow" />
                    )}
                  </button>
                ))}
              </div>
              <input
                type="color"
                value={theme.accentColor}
                onChange={(e) => updateTheme({ accentColor: e.target.value })}
                title="Escolha uma cor personalizada"
                className="w-7 h-7 rounded-full cursor-pointer bg-transparent border-0"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Densidade da Interface
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['compact', 'comfortable', 'spacious'] as Density[]).map((d) => (
                <button
                  key={d}
                  onClick={() => updateTheme({ density: d })}
                  className={`py-2 px-3 rounded-nest-sm text-xs font-medium border text-center transition-all ${
                    theme.density === d
                      ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300 font-bold'
                      : 'border-slate-800 bg-slate-950/60 hover:bg-slate-800 text-slate-400'
                  }`}
                >
                  {d === 'compact' ? 'Compacta' : d === 'comfortable' ? 'Confortável' : 'Espaçosa'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-indigo-400" /> Escala do Texto
              </span>
              <span className="font-semibold text-slate-200">
                {Math.round(theme.fontScale * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.85"
              max="1.25"
              step="0.05"
              value={theme.fontScale}
              onChange={(e) => updateTheme({ fontScale: parseFloat(e.target.value) })}
              className="w-full accent-indigo-500"
            />
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-white">
                  Reduzir Animações
                </div>
                <div className="text-[10px] text-slate-400">
                  Desativa efeitos em movimento para máxima velocidade
                </div>
              </div>
              <input
                type="checkbox"
                checked={theme.reduceMotion}
                onChange={(e) => updateTheme({ reduceMotion: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 accent-indigo-600"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-white">
                  Alto Contraste
                </div>
                <div className="text-[10px] text-slate-400">
                  Bordas reforçadas para maior nitidez
                </div>
              </div>
              <input
                type="checkbox"
                checked={theme.highContrast}
                onChange={(e) => updateTheme({ highContrast: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 accent-indigo-600"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={resetTheme}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Resetar</span>
            </button>
            <span className="text-slate-700">|</span>
            <button
              onClick={handleExportTheme}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
            >
              <Download className="w-3 h-3" />
              <span>Exportar</span>
            </button>
            <label className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 cursor-pointer">
              <Upload className="w-3 h-3" />
              <span>Importar</span>
              <input type="file" accept=".json" onChange={handleImportTheme} className="hidden" />
            </label>
          </div>

          <button
            onClick={() => setIsThemeCustomizerOpen(false)}
            className="px-5 py-2 rounded-nest-pill bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md active:scale-95 transition-all"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
