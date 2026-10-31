import React, { useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { SolidCard } from '../common/SolidCard';
import { AuthLayout } from './AuthLayout';
import { AuthThemeToggle } from './AuthThemeToggle';
import { KoalineLogo } from './KoalineLogo';
import { requireSupabase } from '../../services/supabaseClient';
import { useApp } from '../../context/AppContext';

export const UpdatePasswordPage: React.FC = () => {
  const { addToast } = useApp();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8 || password !== confirmPassword) return;
    setIsSaving(true);
    try {
      const { error } = await requireSupabase().auth.updateUser({ password });
      if (error) throw error;
      addToast('Senha atualizada', 'Sua senha foi redefinida com sucesso.', 'success');
      window.history.replaceState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (error) {
      addToast('Não foi possível atualizar a senha', error instanceof Error ? error.message : 'O link pode ter expirado. Solicite outro e-mail.', 'error');
    } finally { setIsSaving(false); }
  };

  return <AuthLayout><AuthThemeToggle /><SolidCard className="auth-card" role="dialog" aria-modal="true" aria-labelledby="update-password-title"><KoalineLogo className="auth-logo" /><h1 id="update-password-title">Crie uma nova senha</h1><p className="auth-description">Escolha uma senha com pelo menos 8 caracteres.</p><form className="auth-form" onSubmit={submit}><Input id="new-password" label="Nova senha" startAdornment={<LockKeyhole />} type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /><Input id="confirm-new-password" label="Confirmar nova senha" startAdornment={<LockKeyhole />} type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /><p className={`auth-field-hint ${confirmPassword && password === confirmPassword ? 'is-success' : ''}`}>{confirmPassword ? password === confirmPassword ? 'As senhas conferem.' : 'As senhas não conferem.' : ' '}</p><Button type="submit" variant="primary" className="auth-submit-button" disabled={isSaving || password.length < 8 || password !== confirmPassword}>{isSaving ? 'Salvando…' : 'Salvar nova senha'}</Button></form></SolidCard></AuthLayout>;
};
