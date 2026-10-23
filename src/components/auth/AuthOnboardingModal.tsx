import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { KoalineWordmark } from '../brand/KoalaMascot';
import { ParticleCanvas } from './ParticleCanvas';
import {
  Mail,
  Lock,
  ArrowRight,
  User,
  Eye,
  EyeOff,
  Globe
} from 'lucide-react';

export const AuthOnboardingModal: React.FC = () => {
  const {
    isLoggedIn,
    setIsLoggedIn,
    currentUser,
    updateCurrentUser,
    addToast
  } = useApp();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (isLoggedIn) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      updateCurrentUser({
        name: name.trim(),
        handle: name.toLowerCase().replace(/\s+/g, '_'),
      });
      setIsLoggedIn(true);
      addToast('Bem-vindo ao Koaline!', 'Sua sessão foi iniciada com sucesso.', 'success');
    }, 600);
  };

  const handleGuestLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      updateCurrentUser({
        name: 'Visitante Convidado',
        handle: 'guest_' + Math.floor(Math.random() * 8999 + 1000),
      });
      setIsLoggedIn(true);
      addToast('Acesso como Convidado', 'Explorando todos os canais e chamadas.');
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950 overflow-hidden select-none">
      {/* Dynamic Animated Particles in Background */}
      <ParticleCanvas particleCount={80} />

      {/* Decorative Glow Orbs */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Glassmorphic Auth Card */}
      <div className="relative z-10 w-full max-w-md p-8 rounded-nest-lg bg-slate-900/80 border border-slate-700/60 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-300">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <KoalineWordmark size="lg" className="mb-2" />
          <p className="text-xs text-slate-400">
            Plataforma moderna de comunicação, comunidade e voz
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 bg-slate-950/70 rounded-nest-sm border border-slate-800 mb-6">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`py-2 text-xs font-semibold rounded-nest-sm transition-all ${
              mode === 'login'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`py-2 text-xs font-semibold rounded-nest-sm transition-all ${
              mode === 'register'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Criar Conta
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Nome Completo
              </label>
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-nest-sm bg-slate-950/80 border border-slate-800 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
                <User className="w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome ou apelido"
                  className="w-full bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Email
            </label>
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-nest-sm bg-slate-950/80 border border-slate-800 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
              <Mail className="w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@exemplo.com"
                className="w-full bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Senha
              </label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => addToast('Recuperação de Senha', 'Link enviado para o email.')}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Esqueceu?
                </button>
              )}
            </div>
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-nest-sm bg-slate-950/80 border border-slate-800 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
              <Lock className="w-4 h-4 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 rounded-nest-sm bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>{mode === 'login' ? 'Entrar no Koaline' : 'Criar minha conta'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center my-5">
          <div className="h-px bg-slate-800 flex-1" />
          <span className="px-3 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
            ou continue com
          </span>
          <div className="h-px bg-slate-800 flex-1" />
        </div>

        {/* Social / Guest Options */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            type="button"
            onClick={handleGuestLogin}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-nest-sm bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 text-slate-200 text-xs font-medium transition-colors"
          >
            <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
            <span>GitHub</span>
          </button>

          <button
            type="button"
            onClick={handleGuestLogin}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-nest-sm bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 text-slate-200 text-xs font-medium transition-colors"
          >
            <Globe className="w-4 h-4 text-slate-400" />
            <span>Google</span>
          </button>
        </div>

        {/* Quick Guest Enter */}
        <button
          type="button"
          onClick={handleGuestLogin}
          className="w-full py-2 text-center text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          Entrar como visitante anônimo →
        </button>
      </div>
    </div>
  );
};
