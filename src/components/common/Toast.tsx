import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const appearance = {
  success: { Icon: CheckCircle2, className: 'notification-success' },
  error: { Icon: XCircle, className: 'notification-error' },
  warning: { Icon: AlertTriangle, className: 'notification-warning' },
  info: { Icon: Info, className: 'notification-info' },
} as const;

export const Toast: React.FC = () => {
  const { toasts, removeToast, pauseToast, resumeToast } = useApp();
  const toast = toasts[0];
  if (!toast) return null;
  const { Icon, className } = appearance[toast.type];

  return (
    <div className="fixed top-5 left-1/2 z-[120] w-[min(calc(100vw-2rem),24rem)] -translate-x-1/2 pointer-events-none" onMouseEnter={pauseToast} onMouseLeave={resumeToast} onFocus={pauseToast} onBlur={resumeToast}>
      <div
        key={toast.id}
        role="status"
        aria-live="polite"
        className={`notification-toast ${className} pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-200`}
      >
        <Icon aria-hidden="true" className="notification-icon" />
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold leading-tight">{toast.title}</h4>
          <p className="mt-0.5 text-xs leading-snug text-text-muted">{toast.message}</p>
        </div>
        <button type="button" onClick={() => removeToast(toast.id)} aria-label="Fechar notificação" className="notification-close">
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

