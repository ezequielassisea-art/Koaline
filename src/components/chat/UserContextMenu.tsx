import React, { useEffect, useRef, useState } from 'react';
import {
  AtSign, Check, ChevronDown, Copy, MessageSquare, Phone, ShieldAlert,
  UserRoundPlus, UserRoundX, Video, VolumeX, X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getFriendshipState, manageCommunityMember, toggleFriendship, type FriendshipState } from '../../services/userContextService';

const statusLabels = { online: 'Online', idle: 'Ausente', dnd: 'Não perturbe', offline: 'Offline' } as const;

export const UserContextMenu: React.FC = () => {
  const {
    activeUserMenu, closeUserMenu, openUserProfile, openDirectMessage,
    currentUser, currentCommunityId, communities, members, isDirectMessages, activeCall, addToast, startDirectCall,
  } = useApp();
  const menuRef = useRef<HTMLDivElement>(null);
  const addToastRef = useRef(addToast);
  addToastRef.current = addToast;
  const [friendship, setFriendship] = useState<FriendshipState>('none');
  const [friendshipLoading, setFriendshipLoading] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'kick' | 'ban' | null>(null);
  const [moderationLoading, setModerationLoading] = useState(false);

  useEffect(() => {
    if (!activeUserMenu) return;
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) closeUserMenu();
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') closeUserMenu(); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [activeUserMenu, closeUserMenu]);

  useEffect(() => {
    let active = true;
    setFriendship('none');
    if (!activeUserMenu || !activeUserMenu.user.id || activeUserMenu.user.id === currentUser.id) return;
    void getFriendshipState(activeUserMenu.user.id)
      .then((state) => { if (active) setFriendship(state); })
      .catch(() => {
        if (!active) return;
        setFriendship('none');
      });
    return () => { active = false; };
  }, [activeUserMenu?.user.id, currentUser.id]);

  if (!activeUserMenu) return null;
  const { user, position } = activeUserMenu;
  const community = communities.find((item) => item.id === currentCommunityId);
  const isSelf = user.id === currentUser.id;
  const actorRole = members.find((member) => member.communityId === community?.id && member.userId === currentUser.id)?.role
    || (community?.ownerId === currentUser.id || community?.creatorId === currentUser.id ? 'owner' : 'member');
  const canModerate = !isSelf && !isDirectMessages && !!community
    && (actorRole === 'owner' || actorRole === 'admin' || actorRole === 'moderator');
  const userInActiveCall = !!activeCall?.participants.some((participant) => participant.user.id === user.id);

  const mention = () => {
    window.dispatchEvent(new CustomEvent('koaline:mention-user', { detail: { handle: user.handle || user.name } }));
    closeUserMenu();
  };

  const handleFriendAction = async () => {
    if (friendshipLoading) return;
    setFriendshipLoading(true);
    try {
      const next = await toggleFriendship(user.id);
      setFriendship(next);
      const label = next === 'accepted' ? 'Pedido aceito' : next === 'pending_sent' ? 'Pedido enviado' : 'Amizade removida';
      addToast(label, next === 'pending_sent' ? `Pedido de amizade enviado para ${user.name}.` : next === 'accepted' ? `${user.name} agora está na sua lista de amigos.` : `A conexão com ${user.name} foi removida.`, 'success');
    } catch (error) {
      addToast('Não foi possível atualizar a amizade', explainUserActionError(error), 'warning');
    } finally { setFriendshipLoading(false); }
  };

  const handleModeration = async () => {
    if (!community || !confirmAction || moderationLoading) return;
    setModerationLoading(true);
    try {
      await manageCommunityMember({ communityId: community.id, userId: user.id, action: confirmAction });
      addToast(confirmAction === 'kick' ? 'Membro expulso' : 'Membro banido', `${user.name} foi removido de ${community.name}.`, 'success');
      closeUserMenu();
    } catch (error) {
      addToast('Ação de moderação não concluída', error instanceof Error ? error.message : 'Verifique suas permissões e tente novamente.', 'warning');
    } finally { setModerationLoading(false); setConfirmAction(null); }
  };

  const handleRoleChange = async (role: 'admin' | 'moderator' | 'member') => {
    if (!community) return;
    setModerationLoading(true);
    try {
      await manageCommunityMember({ communityId: community.id, userId: user.id, action: 'role', role });
      addToast('Cargo atualizado', `${user.name} agora é ${role === 'admin' ? 'admin' : role === 'moderator' ? 'moderador' : 'membro'}.`, 'success');
      setRoleMenuOpen(false);
      closeUserMenu();
    } catch (error) {
      addToast('Não foi possível mudar o cargo', error instanceof Error ? error.message : 'Verifique suas permissões e tente novamente.', 'warning');
    } finally { setModerationLoading(false); }
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(user.id);
      addToast('ID copiado', 'O UUID foi copiado para a área de transferência.', 'success');
    } catch {
      addToast('Não foi possível copiar', 'A área de transferência não está disponível neste navegador.', 'warning');
    }
    closeUserMenu();
  };

  const friendshipLabel = friendship === 'accepted' ? 'Amigos'
    : friendship === 'pending_received' ? 'Aceitar Pedido'
      : friendship === 'pending_sent' ? 'Pendente' : 'Adicionar Amigo';

  return (
    <div
      ref={menuRef}
      style={{ top: position.y, left: position.x, background: 'var(--surface)', borderColor: 'var(--border)', maxHeight: 'calc(100vh - 24px)' }}
      className="fixed z-[100] w-[min(320px,calc(100vw-24px))] overflow-y-auto rounded-2xl border p-3 text-[var(--text-primary)] shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-150"
      role="dialog"
      aria-label={`Menu de ${user.name}`}
    >
      <div className="mb-2 flex items-start gap-3 border-b border-[var(--border)] pb-3">
        {user.avatar ? <img src={user.avatar} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-[var(--primary)]/30" /> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--bg-elevated)] text-lg font-bold">{(user.name || '?').slice(0, 1).toUpperCase()}</span>}
        <div className="min-w-0 flex-1 pt-0.5">
          <strong className="block truncate text-sm font-bold">{user.name}</strong>
          <span className="block truncate text-xs text-[var(--text-muted)]">@{user.handle || 'usuario'}</span>
          <span className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]"><i className={`h-2 w-2 rounded-full ${user.id === currentUser.id || user.statusKnown ? user.status === 'online' ? 'bg-emerald-400' : user.status === 'idle' ? 'bg-amber-400' : user.status === 'dnd' ? 'bg-rose-400' : 'bg-slate-500' : 'bg-slate-500'}`} />{user.id === currentUser.id || user.statusKnown ? statusLabels[user.status || 'offline'] : 'Status indisponível'}</span>
          {user.communityRole && <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--primary)]">{user.communityRole === 'owner' ? 'Dono' : user.communityRole === 'admin' ? 'Administrador' : user.communityRole === 'moderator' ? 'Moderador' : 'Membro'}</span>}
        </div>
        <button type="button" onClick={closeUserMenu} className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-hover)]" aria-label="Fechar menu"><X size={16} /></button>
      </div>

      <button type="button" onClick={() => openUserProfile(user)} className="mb-2 w-full rounded-lg px-2 py-1.5 text-left text-xs font-medium text-[var(--primary)] hover:bg-[var(--bg-hover)]">Ver Perfil Completo</button>

      <div className="space-y-0.5 border-t border-[var(--border)] pt-2">
        <MenuAction icon={<MessageSquare size={16} />} label="Mensagem Direta" onClick={() => { closeUserMenu(); openDirectMessage(user); }} />
        {!isSelf && <>
          <MenuAction icon={<Phone size={16} />} label="Ligar por voz" onClick={() => { closeUserMenu(); startDirectCall(user, 'voice'); }} />
          <MenuAction icon={<Video size={16} />} label="Ligar por vídeo" onClick={() => { closeUserMenu(); startDirectCall(user, 'video'); }} />
        </>}
        {!isSelf && <MenuAction icon={<UserRoundPlus size={16} />} label={friendshipLoading ? 'Atualizando…' : friendshipLabel} disabled={friendshipLoading} onClick={() => void handleFriendAction()} />}
        {!isSelf && friendship === 'pending_received' && <span className="block px-2 pb-1 text-[10px] text-[var(--text-muted)]">Pedido de amizade recebido</span>}
        <MenuAction icon={<AtSign size={16} />} label="Mencionar" onClick={mention} />
        <MenuAction icon={<Copy size={16} />} label="Copiar ID" onClick={() => void copyId()} />
      </div>

      {canModerate && <div className="mt-2 space-y-0.5 border-t border-[var(--border)] pt-2">
        <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Moderação · {community?.name}</p>
        {userInActiveCall && <MenuAction icon={<VolumeX size={16} />} label="Silenciar para mim na call" onClick={() => { window.dispatchEvent(new CustomEvent('koaline:mute-user-local', { detail: { userId: user.id } })); addToast('Áudio silenciado', `${user.name} foi silenciado apenas para você.`, 'info'); closeUserMenu(); }} />}
        <div className="relative">
          <MenuAction icon={<ChevronDown size={16} />} label="Mudar Cargo" onClick={() => setRoleMenuOpen((open) => !open)} />
          {roleMenuOpen && <div className="ml-7 mt-1 space-y-0.5 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-1">
            <RoleAction label="Administrador" onClick={() => void handleRoleChange('admin')} disabled={moderationLoading} />
            <RoleAction label="Moderador" onClick={() => void handleRoleChange('moderator')} disabled={moderationLoading} />
            <RoleAction label="Membro" onClick={() => void handleRoleChange('member')} disabled={moderationLoading} />
          </div>}
        </div>
        <MenuAction destructive icon={<UserRoundX size={16} />} label="Expulsar do Servidor" onClick={() => setConfirmAction('kick')} />
        <MenuAction destructive icon={<ShieldAlert size={16} />} label="Banir do Servidor" onClick={() => setConfirmAction('ban')} />
      </div>}

      {confirmAction && <div className="fixed inset-0 z-[110] grid place-items-center bg-black/60 p-4" onPointerDown={(event) => { if (event.target === event.currentTarget) setConfirmAction(null); }}>
        <section className="w-full max-w-sm rounded-2xl border border-rose-500/30 bg-[var(--surface)] p-5 shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="user-menu-confirm-title">
          <h2 id="user-menu-confirm-title" className="mb-2 font-semibold">{confirmAction === 'kick' ? 'Expulsar membro?' : 'Banir membro?'}</h2>
          <p className="mb-4 text-sm text-[var(--text-secondary)]">{confirmAction === 'kick' ? `${user.name} poderá entrar novamente por um convite da comunidade.` : `${user.name} será removido e não poderá voltar a esta comunidade.`}</p>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setConfirmAction(null)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">Cancelar</button><button type="button" disabled={moderationLoading} onClick={() => void handleModeration()} className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-60">{moderationLoading ? 'Aguarde…' : confirmAction === 'kick' ? 'Expulsar' : 'Banir'}</button></div>
        </section>
      </div>}
    </div>
  );
};

const MenuAction: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; destructive?: boolean; disabled?: boolean }> = ({ icon, label, onClick, destructive, disabled }) => (
  <button type="button" disabled={disabled} onClick={onClick} className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-xs transition-colors disabled:opacity-50 ${destructive ? 'text-rose-400 hover:bg-rose-500/10' : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'}`}>
    <span className={destructive ? 'text-rose-400' : 'text-[var(--text-secondary)]'}>{icon}</span>{label}
  </button>
);

const RoleAction: React.FC<{ label: string; onClick: () => void; disabled?: boolean }> = ({ label, onClick, disabled }) => (
  <button type="button" disabled={disabled} onClick={onClick} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-[var(--bg-hover)] disabled:opacity-50"><Check size={13} className="opacity-40" />{label}</button>
);

function explainUserActionError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const result = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const message = [result.message, result.details, result.hint].filter((value): value is string => typeof value === 'string' && value.trim().length > 0).join(' — ');
    if (message) {
      if (result.code === 'PGRST202' || result.code === '42883' || result.code === 'PGRST205' || result.code === '42P01') return `${message}. Confirme se a migration de amizades foi aplicada no Supabase.`;
      return result.code ? `${message} (${String(result.code)})` : message;
    }
  }
  return typeof error === 'string' && error ? error : 'Ocorreu um erro inesperado. Tente novamente.';
}
