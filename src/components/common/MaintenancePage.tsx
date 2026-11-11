import React from 'react';
import { Settings, Loader2 } from 'lucide-react';

export const MaintenancePage: React.FC = () => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50 min-h-screen w-full">
      <div className="relative z-10 w-full max-w-md px-6">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-10 text-center">
          <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-100 mb-6">
            <Loader2 className="w-10 h-10 text-slate-600 animate-spin" />
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-3">Em Manutenção</h1>
          <p className="text-slate-600 text-base leading-relaxed">
            Estamos trabalhando para melhorar sua experiência. Voltamos em breve!
          </p>
        </div>

        <div className="mt-8 text-center text-slate-400 text-sm">
          <p>Koaline • Volte mais tarde</p>
        </div>
      </div>
    </div>
  );
};