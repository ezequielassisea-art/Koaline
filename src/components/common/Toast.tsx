import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertCircle, Info, X, Zap } from 'lucide-react';

export const Toast: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-5 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none">
      {toasts.map((toast) => {
        let Icon = Zap;
        let accentClass = 'text-indigo-400';
        let borderClass = 'border-indigo-500/20';
        let glowClass = '';

        if (toast.type === 'success') {
          Icon = CheckCircle2;
          accentClass = 'text-emerald-400';
          borderClass = 'border-emerald-500/25';
        } else if (toast.type === 'warning') {
          Icon = AlertCircle;
          accentClass = 'text-amber-400';
          borderClass = 'border-amber-500/25';
        } else if (toast.type === 'info') {
          Icon = Info;
          accentClass = 'text-sky-400';
          borderClass = 'border-sky-500/25';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl bg-slate-900/95 border ${borderClass} shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-300`}
          >
            <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${accentClass}`} />
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-title font-bold text-white leading-tight truncate">
                {toast.title}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-500 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
