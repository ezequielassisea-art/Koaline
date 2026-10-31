import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, AtSign, Check, Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AuthThemeToggle } from './AuthThemeToggle';
import { AuthLayout } from './AuthLayout';
import { KoalineLogo } from './KoalineLogo';
import { Button } from '../common/Button';
import { SolidCard } from '../common/SolidCard';
import { Input } from '../common/Input';
import { requireSupabase } from '../../services/supabaseClient';

type AuthMode = 'home' | 'login' | 'register';
type AuthDraft = { mode: AuthMode; step: number; handle: string; email: string; loginIdentifier: string };
const DRAFT_KEY = 'koaline:auth-draft';
const HANDLE_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
const readJson = <T,>(key: string, fallback: T): T => {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
  catch { return fallback; }
};

const emailNickSuggestions = (email: string) => {
  const [localPart, domain] = email.trim().toLowerCase().split('@');
  if (!localPart || !domain || !/(gmail|outlook|hotmail|yahoo|icloud|live)\./.test(domain)) return [];
  const parts = localPart.normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[._+-]+/).filter(Boolean);
  const candidates = [parts.join(''), parts.length > 1 ? `${parts[0]}${parts.at(-1)?.[0] || ''}` : `${parts[0]}_`, parts.length > 1 ? `${parts.at(-1)}${parts[0]}` : `${parts[0]}_oficial`];
  return [...new Set(candidates)].filter((candidate) => HANDLE_PATTERN.test(candidate));
};

export const AuthOnboardingModal: React.FC = () => {
  const { isLoggedIn, currentUser, addToast } = useApp();
  const [draft] = useState<AuthDraft>(() => readJson(DRAFT_KEY, { mode: 'login', step: 1, handle: '', email: '', loginIdentifier: '' }));
  const [mode, setMode] = useState<AuthMode>(draft.mode === 'home' ? 'login' : draft.mode);
  const [step, setStep] = useState(Math.min(3, Math.max(1, draft.step || 1)));
  const [handle, setHandle] = useState(draft.handle || '');
  const [email, setEmail] = useState(draft.email || '');
  const [loginIdentifier, setLoginIdentifier] = useState(draft.loginIdentifier || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (mode === 'home') return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ mode, step, handle, email, loginIdentifier })); }
    catch { /* A etapa continua disponível na sessão mesmo sem armazenamento. */ }
  }, [mode, step, handle, email, loginIdentifier]);

  if (isLoggedIn) return null;

  const normalizedHandle = handle.trim().replace(/^@/, '').toLowerCase();
  const handleValid = HANDLE_PATTERN.test(normalizedHandle);
  const handleTaken = currentUser.handle.toLowerCase() === normalizedHandle && !!currentUser.email && currentUser.email.toLowerCase() !== email.trim().toLowerCase();
  const handleMessage = !handle ? 'Exemplo: @seunome' : !handleValid ? 'Use de 3 a 20 letras, números ou _.' : handleTaken ? 'Esse identificador já está em uso.' : 'Identificador disponível';
  const suggestions = emailNickSuggestions(email);
  const strength = [password.length >= 8, /[A-Z]/.test(password) && /[a-z]/.test(password), /\d/.test(password) || /[^a-zA-Z0-9]/.test(password)].filter(Boolean).length;
  const strengthLabel = ['', 'Fraca', 'Boa', 'Forte'][strength];
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const enterLogin = () => { setMode('login'); setPassword(''); };
  const enterRegister = () => { setMode('register'); setStep(1); setPassword(''); setConfirmPassword(''); };
  const loginWithGoogle = async () => {
    try {
      const { error } = await requireSupabase().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
      if (error) addToast('Erro ao conectar com Google.', error.message, 'error');
    } catch (error) {
      addToast('Erro ao conectar com Google.', error instanceof Error ? error.message : 'Tente novamente.', 'error');
    }
  };

  const finishLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!loginIdentifier.trim() || !password) return;
    setIsLoading(true);
    try {
      const client = requireSupabase();
      const { error } = await client.auth.signInWithPassword({ email: loginIdentifier.trim(), password });
      if (error) throw error;
      localStorage.removeItem(DRAFT_KEY);
    } catch (error) { addToast('Falha no login', /invalid login credentials/i.test(error instanceof Error ? error.message : '') ? 'E-mail ou senha incorretos.' : error instanceof Error ? error.message : 'Tente novamente.', 'error'); }
    finally { setIsLoading(false); }
  };

  const finishRegister = (event: React.FormEvent) => {
    event.preventDefault();
    if (!handleValid || handleTaken || !email.trim() || !passwordsMatch || strength < 2) return;
    const displayName = name.trim() || normalizedHandle;
    setIsLoading(true);
    void (async () => {
      try {
        const client = requireSupabase();
        const { data, error } = await client.auth.signUp({ email: email.trim(), password, options: { data: { username: normalizedHandle, full_name: displayName, avatar_url: currentUser.avatar || null } } });
        if (error) throw error;
        if (data.user) await client.from('profiles').upsert({ id: data.user.id, username: normalizedHandle, full_name: displayName, avatar_url: currentUser.avatar || null }, { onConflict: 'id' });
        localStorage.removeItem(DRAFT_KEY);
        if (!data.session) addToast('Confirme seu e-mail', 'Enviamos um link de confirmação antes de entrar.', 'success');
      } catch (error) { addToast('Não foi possível criar a conta', /already registered|already exists/i.test(error instanceof Error ? error.message : '') ? 'Este e-mail já está cadastrado.' : error instanceof Error ? error.message : 'Tente novamente.', 'error'); }
      finally { setIsLoading(false); }
    })();
  };

  const back = () => {
    if (mode === 'register' && step > 1) { setStep(step - 1); return; }
    setMode('home');
  };

  return <AuthLayout>
    <AuthThemeToggle />
    <SolidCard className="auth-card" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <KoalineLogo className="auth-logo" />
      <h1 id="auth-title">{mode === 'home' ? 'Converse do seu jeito.' : mode === 'login' ? 'Que bom ter você de volta.' : 'Crie sua conta.'}</h1>
      <p className="auth-description">{mode === 'home' ? 'Seu espaço para conversar, compartilhar e estar junto.' : mode === 'login' ? 'Entre com seu identificador ou email.' : 'Alguns passos rápidos para começar.'}</p>

      {mode === 'register' && <div className="auth-progress" aria-label={`Etapa ${step} de 3`}>
        {[1, 2, 3].map((item) => <React.Fragment key={item}><span className={`auth-progress-dot ${step >= item ? 'is-active' : ''}`} aria-current={step === item ? 'step' : undefined}>{step > item ? <Check aria-hidden="true" /> : item}</span>{item < 3 && <span className={`auth-progress-line ${step > item ? 'is-active' : ''}`} />}</React.Fragment>)}
      </div>}

      {mode === 'home' && <div className="auth-home-actions">
        <Button variant="primary" className="auth-large-button" onClick={enterRegister}><UserRound aria-hidden="true" />Criar conta<ArrowRight aria-hidden="true" /></Button>
        <Button variant="outline" className="auth-large-button" onClick={enterLogin}><ArrowRight aria-hidden="true" />Entrar</Button>
        <div className="auth-divider"><span>ou continue com</span></div>
        <div className="auth-social-grid">
          <Button variant="outline" onClick={() => void loginWithGoogle()}><span className="auth-google-mark" aria-hidden="true">G</span>Google</Button>
        </div>
      </div>}

      {mode === 'login' && <form className="auth-form" onSubmit={finishLogin}>
        <Input id="auth-login-identifier" label="E-mail" startAdornment={<AtSign />} type="email" autoComplete="username" required value={loginIdentifier} onChange={(event) => setLoginIdentifier(event.target.value)} />
        <div className="auth-label-row"><span className="auth-label">Senha</span><button type="button" className="auth-inline-link" onClick={() => addToast('Recuperação de senha', 'Conecte o fluxo de recuperação ao backend de autenticação.', 'warning')}>Esqueceu a senha?</button></div>
        <Input id="auth-login-password" label="Senha" startAdornment={<LockKeyhole />} type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onCopy={(event) => event.preventDefault()} onCut={(event) => event.preventDefault()} onChange={(event) => setPassword(event.target.value)} endAdornment={<button type="button" className="auth-icon-button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button>} />
        <Button type="submit" variant="primary" className="auth-submit-button" disabled={isLoading}>{isLoading ? 'Entrando…' : 'Entrar'}<ArrowRight aria-hidden="true" /></Button>
        <p className="auth-switch-copy">Ainda não tem conta? <button type="button" className="auth-inline-link" onClick={enterRegister}>Criar conta</button></p>
        <div className="auth-divider"><span>ou entre com</span></div>
        <Button variant="outline" className="auth-google-button" onClick={() => void loginWithGoogle()}><span className="auth-google-mark" aria-hidden="true">G</span>Continuar com Google</Button>
      </form>}

      {mode === 'register' && <form className="auth-form" onSubmit={step < 3 ? (event) => { event.preventDefault(); if (step === 1 && (!handleValid || handleTaken)) return; if (step === 2 && !email.trim()) return; setStep(step + 1); } : finishRegister}>
        <button type="button" className="auth-back-button" onClick={back}><ArrowLeft aria-hidden="true" />{step > 1 ? 'Etapa anterior' : 'Voltar'}</button>
        {step === 1 && <>
          <Input id="auth-handle" label="Nome de usuário" startAdornment={<AtSign />} autoComplete="username" autoFocus required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" value={handle} onChange={(event) => setHandle(event.target.value.replace(/^@/, ''))} aria-describedby="auth-handle-help" aria-invalid={!!handle && (!handleValid || handleTaken)} />
          <p id="auth-handle-help" className={`auth-field-hint ${handle && handleValid && !handleTaken ? 'is-success' : ''}`}>{handleMessage}</p>
          <Button type="submit" variant="primary" className="auth-submit-button" disabled={!handleValid || handleTaken}>Continuar<ArrowRight aria-hidden="true" /></Button>
        </>}
        {step === 2 && <>
          <Input id="auth-register-email" label="Email" startAdornment={<Mail />} type="email" autoComplete="email" autoFocus required value={email} onChange={(event) => setEmail(event.target.value)} />
          {suggestions.length > 0 && <div className="auth-suggestions"><p>Ideias de usuário para seu email</p><div>{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => setHandle(suggestion)} aria-label={`Usar identificador ${suggestion}`}>@{suggestion}</button>)}</div></div>}
          <Button type="submit" variant="primary" className="auth-submit-button">Continuar<ArrowRight aria-hidden="true" /></Button>
        </>}
        {step === 3 && <>
          <Input id="auth-display-name" label="Nome de exibição (opcional)" startAdornment={<UserRound />} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
          <Input id="auth-register-password" label="Senha" startAdornment={<LockKeyhole />} type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} required value={password} onCopy={(event) => event.preventDefault()} onCut={(event) => event.preventDefault()} onChange={(event) => setPassword(event.target.value)} endAdornment={<button type="button" className="auth-icon-button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button>} />
          <div className="auth-strength" aria-live="polite"><span className={`strength-${strength}`} /><span>Força: {strengthLabel || 'digite sua senha'}</span></div>
          <Input id="auth-confirm-password" label="Repetir senha" startAdornment={<LockKeyhole />} type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" required value={confirmPassword} onCopy={(event) => event.preventDefault()} onCut={(event) => event.preventDefault()} onChange={(event) => setConfirmPassword(event.target.value)} aria-describedby="auth-password-match" endAdornment={<button type="button" className="auth-icon-button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label={showConfirmPassword ? 'Ocultar senha repetida' : 'Mostrar senha repetida'}>{showConfirmPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button>} />
          <p id="auth-password-match" className={`auth-field-hint ${passwordsMatch ? 'is-success' : ''}`}>{confirmPassword ? passwordsMatch ? 'As senhas conferem.' : 'As senhas ainda não conferem.' : ' '}</p>
          <Button type="submit" variant="primary" className="auth-submit-button" disabled={isLoading || !passwordsMatch || strength < 2}>{isLoading ? 'Criando conta…' : 'Criar minha conta'}<ArrowRight aria-hidden="true" /></Button>
        </>}
      </form>}
    </SolidCard>
  </AuthLayout>;
};


