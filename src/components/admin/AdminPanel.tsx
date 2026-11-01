import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowDown, ArrowUp, Ban, Check, Copy, Crown, GripVertical, Loader2,
  ImagePlus, LockKeyhole, LogOut, Music, Plus, Search, Settings, Shield, Trash2, UserMinus, UserPlus, Users, X,
  Mail, CheckCircle, XCircle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Channel, User } from '../../types';
import { ConfirmModal } from '../common/ConfirmModal';
import { GroupAudioSettings } from './GroupAudioSettings';
import { canDeleteCommunityChannel } from './adminAccess';
import { supabase } from '../../services/supabaseClient';
import './AdminPanel.css';

type Tab = 'Geral' | 'Canais' | 'Áudios' | 'Membros' | 'Cargos' | 'Convites' | 'Logs / Auditoria' | 'Perigo';
type Permission = 'channels' | 'members' | 'roles' | 'kick' | 'ban' | 'audit';
type Role = { id: string; name: string; color: string; permissions: Permission[] };
type Invite = { id: string; code: string; expiresAt: number | null; maxUses: number | null; uses: number; revoked: boolean };
type Audit = { id: string; actor: string; action: string; target: string; time: number; type: string };
type Persisted = {
  ownerId: string; memberRoles: Record<string, string[]>; roles: Role[]; banned: Array<{ id: string; reason: string; time: number }>;
  invites: Invite[]; audit: Audit[]; archived: string[]; channelOrder: string[]; defaultRole: string;
};

const permissions: Array<{ id: Permission; label: string }> = [
  { id: 'channels', label: 'Gerenciar canais' }, { id: 'members', label: 'Gerenciar membros' },
  { id: 'roles', label: 'Gerenciar cargos' }, { id: 'kick', label: 'Expulsar membros' },
  { id: 'ban', label: 'Banir membros' }, { id: 'audit', label: 'Ver audit log' },
];
const blank: Persisted = { ownerId: '', memberRoles: {}, roles: [], banned: [], invites: [], audit: [], archived: [], channelOrder: [], defaultRole: '' };
const readState = (id: string): Persisted => {
  try { return { ...blank, ...JSON.parse(localStorage.getItem(`koaline:admin:${id}`) || '{}') }; } catch { return blank; }
};
const saveImage = (file: File, setter: (value: string) => void) => {
  if (!file.type.startsWith('image/')) return;
  const reader = new FileReader(); reader.onload = () => setter(String(reader.result)); reader.readAsDataURL(file);
};
const encodeCommunityBanner = async (file: File): Promise<string> => {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 600;
  const context = canvas.getContext('2d');
  if (!context) { bitmap.close(); throw new Error('Não foi possível preparar a imagem.'); }
  const scale = Math.max(canvas.width / bitmap.width, canvas.height / bitmap.height);
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;
  context.drawImage(bitmap, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
  if (!blob) throw new Error('Não foi possível converter a imagem.');
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Imagem inválida.'));
    reader.onerror = () => reject(new Error('Falha ao ler a imagem.'));
    reader.readAsDataURL(blob);
  });
};
const fmt = (timestamp: number) => new Date(timestamp).toLocaleString('pt-BR');
const nowMs = () => Date.now();
const describeError = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return fallback;
};
const inviteCode = () => Math.random().toString(36).slice(2, 10);
const joinedDate = (userId: string, communityId: string, members: Array<{ communityId: string; userId: string; joinedAt: string }>) => {
  const member = members.find((item) => item.communityId === communityId && item.userId === userId);
  return member ? new Date(member.joinedAt).toLocaleDateString('pt-BR') : '—';
};

export const AdminPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { currentUser, communities, members, currentCommunityId, updateCommunity, updateChannel, deleteChannel, removeCommunity, leaveCommunity, setIsCreateChannelModalOpen, openUserProfile, addToast } = useApp();
  const community = communities.find((item) => item.id === currentCommunityId);
  const [state, setState] = useState<Persisted>(() => {
    const initial = readState(currentCommunityId);
    return { ...initial, ownerId: initial.ownerId || community?.ownerId || community?.creatorId || '' };
  });
  const [tab, setTab] = useState<Tab>('Geral');
  const [name, setName] = useState(community?.name || '');
  const [description, setDescription] = useState(community?.description || community?.tagline || '');
  const [icon, setIcon] = useState(community?.icon || '◇');
  const [banner, setBanner] = useState(community?.banner || '');
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [memberFilter, setMemberFilter] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [roleName, setRoleName] = useState('');
  const [roleColor, setRoleColor] = useState(() => getComputedStyle(document.documentElement).getPropertyValue('--primary').trim());
  const [rolePerms, setRolePerms] = useState<Permission[]>([]);
  const [expiry, setExpiry] = useState('never');
  const [uses, setUses] = useState('unlimited');
  const [dangerInput, setDangerInput] = useState('');
  const [transferId, setTransferId] = useState('');
  const [confirmTransfer, setConfirmTransfer] = useState(false);
  const [isDeleteCommunityOpen, setIsDeleteCommunityOpen] = useState(false);
  const [deleteCommunityName, setDeleteCommunityName] = useState('');
  const [isDeletingCommunity, setIsDeletingCommunity] = useState(false);
  const [isLeaveCommunityOpen, setIsLeaveCommunityOpen] = useState(false);
  const [memberToKick, setMemberToKick] = useState<User | null>(null);
  const [editingChannel, setEditingChannel] = useState<string | null>(null);
  const [channelToDelete, setChannelToDelete] = useState<Channel | null>(null);
  const [channelDraft, setChannelDraft] = useState({ name: '', topic: '', categoryId: '', isPrivate: false });
  const [communityUsers, setCommunityUsers] = useState<User[]>([]);
  const [communityRoles, setCommunityRoles] = useState<Record<string, 'admin' | 'moderator' | 'member'>>({});
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteMatches, setInviteMatches] = useState<Array<{ id: string; username: string; full_name?: string | null; avatar_url?: string | null }>>([]);
  const [inviteTarget, setInviteTarget] = useState<{ id: string; username: string; full_name?: string | null; avatar_url?: string | null } | null>(null);
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  useEffect(() => {
    if (!supabase || !currentCommunityId) { setCommunityUsers([]); return; }
    let active = true;
    void supabase.from('community_members')
      .select('user_id, role, profiles:user_id (username, avatar_url)')
      .eq('community_id', currentCommunityId)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) { addToast('Não foi possível carregar os membros', error.message, 'error'); return; }
        const loaded = (data || []).map((row: any) => {
          const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
          const username = profile?.username && !/^[0-9a-f-]{30,}$/i.test(profile.username) ? profile.username : '';
          return {
            ...currentUser,
            id: row.user_id,
            name: username || 'Membro Koaline',
            handle: username || 'koaline',
            avatar: profile?.avatar_url || '',
            status: 'offline' as const,
          };
        });
        setCommunityRoles(Object.fromEntries((data || []).map((row: any) => [row.user_id, row.role])));
        setCommunityUsers(loaded);
      });
    return () => { active = false; };
  }, [currentCommunityId, currentUser.id]);
  useEffect(() => {
    if (!inviteModalOpen || !supabase || inviteQuery.trim().replace(/^@/, '').length < 2) { setInviteMatches([]); return; }
    let active = true;
    const timer = window.setTimeout(async () => {
      const term = inviteQuery.trim().replace(/^@/, '');
      const { data } = await supabase!.from('profiles').select('id,username,full_name,avatar_url').ilike('username', `%${term}%`).limit(6);
      if (active) setInviteMatches((data || []).filter((profile) => profile.id !== currentUser.id));
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [inviteModalOpen, inviteQuery, currentUser.id]);
  const users = useMemo(() => communityUsers.length ? communityUsers : (members.some((member) => member.communityId === currentCommunityId && member.userId === currentUser.id) ? [currentUser] : []), [communityUsers, members, currentCommunityId, currentUser]);
  const isOwner = state.ownerId === currentUser.id;
  const myRoleIds = state.memberRoles[currentUser.id] || [];
  const myRoles = state.roles.filter((role) => myRoleIds.includes(role.id));
  const myPerms = new Set(myRoles.flatMap((role) => role.permissions));
  const isAdmin = isOwner || communityRoles[currentUser.id] === 'admin' || myRoles.some((role) => /^(adm|admin|administrador)$/i.test(role.name.trim()));
  const canAccess = isAdmin || myRoles.some((role) => role.permissions.length > 0);
  const can = (permission: Permission) => isAdmin || myPerms.has(permission);
  const canDeleteChannel = (channel: Channel) => !!community && canDeleteCommunityChannel(currentCommunityId, currentUser, community.ownerId || community.creatorId, channel.ownerId);
  const allowedTabs = isAdmin ? ['Geral', 'Canais', 'Áudios', 'Membros', 'Cargos', 'Convites', 'Logs / Auditoria', 'Perigo'] as Tab[] : (['Canais', 'Áudios', 'Membros', 'Cargos', 'Logs / Auditoria'] as Tab[]).filter((item) => item === 'Canais' ? myPerms.has('channels') : item === 'Áudios' ? myPerms.has('channels') || myPerms.has('members') : item === 'Membros' ? myPerms.has('members') : item === 'Cargos' ? myPerms.has('roles') : myPerms.has('audit'));
  const visibleTab = allowedTabs.includes(tab) ? tab : allowedTabs[0] || tab;

  const persist = (next: Persisted) => {
    setState(next);
    localStorage.setItem(`koaline:admin:${currentCommunityId}`, JSON.stringify(next));
    try {
      const stored = JSON.parse(localStorage.getItem('koaline:invites') || '[]') as Array<{ communityId?: string }>;
      localStorage.setItem('koaline:invites', JSON.stringify([...stored.filter((item) => item.communityId !== currentCommunityId), ...next.invites.map((invite) => ({ ...invite, communityId: currentCommunityId }))]));
    } catch { /* O estado do painel continua salvo na chave própria da comunidade. */ }
  };
  const log = (action: string, target: string, type = action, updates: Partial<Persisted> = {}) => {
    const latest = readState(currentCommunityId);
    const now = new Date(nowMs());
    const next = { ...latest, ...updates, ownerId: latest.ownerId || community?.ownerId || state.ownerId, audit: [{ id: crypto.randomUUID(), actor: currentUser.name, action, target, time: now.getTime(), type }, ...latest.audit] };
    persist(next);
    try {
      const stored = JSON.parse(localStorage.getItem('koaline:logs') || '[]') as Array<Record<string, unknown>>;
      localStorage.setItem('koaline:logs', JSON.stringify([{ id: crypto.randomUUID(), communityId: currentCommunityId, userId: currentUser.id, action, targetId: target, metadata: { type }, createdAt: now.toISOString() }, ...stored]));
    } catch { /* O painel continua funcional se o armazenamento local estiver indisponível. */ }
  };
  const updateState = (updates: Partial<Persisted>) => {
    persist({ ...state, ...updates });
    if (updates.channelOrder && community) {
      const rank = new Map(updates.channelOrder.map((id, index) => [id, index]));
      updateCommunity(community.id, { channels: [...community.channels].sort((a, b) => (rank.get(a.id) ?? 9999) - (rank.get(b.id) ?? 9999)) });
    }
  };
  const visibleChannels = (community?.channels || []).filter((channel) => !state.archived.includes(channel.id));
  const orderedChannels = [...visibleChannels].sort((a, b) => {
    const ai = state.channelOrder.indexOf(a.id); const bi = state.channelOrder.indexOf(b.id);
    return (ai < 0 ? 9999 : ai) - (bi < 0 ? 9999 : bi);
  });
  const memberRows = users.filter((user) => !state.banned.some((entry) => entry.id === user.id) && `${user.name} ${user.handle}`.toLowerCase().includes(memberSearch.toLowerCase()));
  const setMemberRole = (userId: string, roleId: string, assign: boolean) => {
    if (userId === state.ownerId) return;
    const old = state.memberRoles[userId] || [];
    const next = { ...state.memberRoles, [userId]: assign ? [...new Set([...old, roleId])] : old.filter((id) => id !== roleId) };
    const target = users.find((user) => user.id === userId)?.name || userId;
    log(assign ? 'Cargo atribuído' : 'Cargo removido', target, 'role', { memberRoles: next });
  };
  const updateCommunityRole = async (targetUserId: string, newRole: 'admin' | 'moderator' | 'member') => {
    if (!supabase || !isAdmin || targetUserId === state.ownerId) return;
    setUpdatingMemberId(targetUserId);
    const { error } = await supabase.from('community_members')
      .update({ role: newRole })
      .eq('user_id', targetUserId)
      .eq('community_id', currentCommunityId);
    setUpdatingMemberId(null);
    if (error) {
      addToast('Falha ao atualizar cargo', error.message, 'error');
      return;
    }
    setCommunityRoles((previous) => ({ ...previous, [targetUserId]: newRole }));
    addToast('Cargo atualizado com sucesso', 'O novo cargo foi salvo.', 'success');
  };
  const sendInvite = async () => {
    if (!supabase || !isAdmin || !inviteTarget || !community || inviteSending) return;
    setInviteSending(true);
    try {
      const notificationId = crypto.randomUUID();
      const { error } = await supabase.from('notifications').insert({
        id: notificationId,
        user_id: inviteTarget.id,
        sender_id: currentUser.id,
        type: 'community_invite',
        payload: {
          community_id: community.id,
          community_name: community.name,
          inviter_id: currentUser.id,
          inviter_name: currentUser.name,
          custom_message: inviteMessage.trim(),
          community_icon: community.icon,
          community_banner: community.banner,
        },
      });
      if (error) throw error;
      addToast('Convite enviado', `@${inviteTarget.username} receberá o convite para ${community.name}.`, 'success');
      setInviteModalOpen(false);
      setInviteQuery(''); setInviteTarget(null); setInviteMessage('');
    } catch (error) {
      addToast('Convite não enviado', describeError(error, 'Tente novamente.'), 'error');
    } finally { setInviteSending(false); }
  };
  const openKickConfirmation = (user: User) => {
    setMemberToKick(user);
  };

  const confirmKickMember = async () => {
    if (!memberToKick || !supabase || !isAdmin) return;
    const targetUser = memberToKick;
    setMemberToKick(null);
    try {
      const { error } = await supabase
        .from('community_members')
        .delete()
        .eq('community_id', currentCommunityId)
        .eq('user_id', targetUser.id);
      if (error) throw error;
      // Atualizar estado local: remover da lista de membros
      setCommunityUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
      setCommunityRoles((prev) => {
        const next = { ...prev };
        delete next[targetUser.id];
        return next;
      });
      log('Membro expulso', targetUser.name, 'kick');
      addToast('Membro expulso', `${targetUser.name} foi removido da comunidade.`, 'success');
    } catch (error) {
      addToast('Erro ao expulsar', error instanceof Error ? error.message : 'Tente novamente.', 'error');
    }
  };

  const changeMemberStatus = (user: User, action: 'kick' | 'ban') => {
    if (user.id === state.ownerId || user.id === currentUser.id) return;
    if (action === 'kick') {
      openKickConfirmation(user);
      return;
    }
    const banReason = window.prompt('Motivo do banimento (opcional):') || '';
    const updates = { banned: [...state.banned, { id: user.id, reason: banReason, time: nowMs() }] };
    log('Membro banido', user.name, 'ban', updates);
  };
  const upload = (setter: (value: string) => void) => (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) saveImage(file, setter); };
  const uploadBanner = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    if (!allowedTypes.includes(file.type.toLowerCase()) && !allowedExtensions.includes(extension || '')) {
      addToast('Formato não suportado', 'Escolha uma imagem JPG, PNG ou WEBP.', 'warning');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addToast('Imagem muito grande', 'O banner deve ter no máximo 5 MB.', 'warning');
      return;
    }
    void encodeCommunityBanner(file).then(setBanner).catch(() => addToast('Falha ao carregar banner', 'Não foi possível processar essa imagem. Tente outro arquivo.', 'warning'));
  };
  const saveGeneral = () => {
    if (!name.trim()) return addToast('Nome obrigatório', 'Informe o nome da comunidade.', 'warning');
    updateCommunity(currentCommunityId, { name: name.trim(), tagline: description, description, icon, banner });
    log('Comunidade editada', name.trim(), 'community'); addToast('Alterações salvas', 'Informações da comunidade atualizadas.', 'success');
  };
  const createRole = () => {
    if (!roleName.trim()) return;
    const role = { id: crypto.randomUUID(), name: roleName.trim(), color: roleColor, permissions: rolePerms };
    log('Cargo criado', role.name, 'role', { roles: [...state.roles, role], defaultRole: state.defaultRole || role.id }); setRoleName(''); setRolePerms([]);
  };
  const createInvite = () => {
    const durations: Record<string, number | null> = { never: null, '1h': 3600000, '1d': 86400000, '7d': 604800000, '30d': 2592000000 };
    const limits: Record<string, number | null> = { unlimited: null, '1': 1, '5': 5, '10': 10, '25': 25 };
    const invite = { id: crypto.randomUUID(), communityId: currentCommunityId, createdBy: currentUser.id, code: inviteCode(), expiresAt: durations[expiry] ? nowMs() + durations[expiry] : null, maxUses: limits[uses], uses: 0, revoked: false };
    log('Convite criado', invite.code, 'invite', { invites: [invite, ...state.invites] });
  };
  const confirmDeleteChannel = () => {
    if (!channelToDelete || !community) return;
    const channel = community.channels.find((item) => item.id === channelToDelete.id);
    if (!channel || !canDeleteChannel(channel)) {
      setChannelToDelete(null);
      addToast('Acesso negado', 'Somente o dono do canal ou um administrador pode excluí-lo.', 'warning');
      return;
    }
    if (!deleteChannel(channel.id)) {
      setChannelToDelete(null);
      addToast('Canal não excluído', 'Você não tem permissão para excluir este canal.', 'warning');
      return;
    }
    log('Canal excluído', channel.name, 'channel', {
      archived: state.archived.filter((id) => id !== channel.id),
      channelOrder: state.channelOrder.filter((id) => id !== channel.id),
    });
    addToast('Canal excluído', `#${channel.name} foi removido com sucesso.`, 'success');
    setChannelToDelete(null);
  };
  const moveChannel = (id: string, direction: -1 | 1) => {
    const order = orderedChannels.map((channel) => channel.id); const index = order.indexOf(id); const target = index + direction;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]]; updateState({ channelOrder: order }); log('Ordem de canais alterada', id, 'channel');
  };
  const moveToCategory = (channelId: string, categoryId: string) => {
    updateChannel(channelId, { categoryId }); const channel = community?.channels.find((item) => item.id === channelId); log('Canal movido', channel?.name || channelId, 'channel');
  };
  const addCategory = () => {
    if (!categoryName.trim() || !community) return;
    const category = { id: crypto.randomUUID(), communityId: community.id, name: categoryName.trim() };
    updateCommunity(community.id, { categories: [...community.categories, category] }); log('Categoria criada', category.name, 'channel'); setCategoryName('');
  };
  const saveChannel = (channel: Channel) => {
    const clean = channelDraft.name.trim().toLowerCase().replace(/\s+/g, '-');
    if (!/^[a-z0-9_-]+$/.test(clean)) return addToast('Nome inválido', 'Use letras, números, hífen ou sublinhado.', 'warning');
    if (community?.channels.some((item) => item.id !== channel.id && item.name === clean)) return addToast('Nome em uso', 'Já existe um canal com esse nome.', 'warning');
    updateChannel(channel.id, { name: clean, topic: channelDraft.topic, categoryId: channelDraft.categoryId, isPrivate: channelDraft.isPrivate });
    log('Canal editado', clean, 'channel'); setEditingChannel(null);
  };

  if (!community || !canAccess) return <div className="admin-guard"><div><LockKeyhole /><h2>Acesso restrito</h2><p>Somente administradores e moderadores autorizados podem acessar este painel.</p><button onClick={onClose}>Voltar</button></div></div>;
  const field = 'admin-field';
  const button = 'admin-button';
  const input = (value: string, change: (value: string) => void, placeholder = '') => <input className={field} value={value} onChange={(event) => change(event.target.value)} placeholder={placeholder} />;
  const imageControl = (label: string, value: string, change: (value: string) => void) => <label className="admin-upload"><span>{label}</span><input type="file" accept="image/*" onChange={upload(change)} />{value ? <img src={value} alt="Prévia da imagem" /> : <span className="admin-upload-empty"><ImagePlus /> Escolher imagem</span>}<small>Prévia centralizada com recorte para a proporção do espaço.</small></label>;

  return <>
  <div className="admin-overlay" role="dialog" aria-modal="true" aria-label="Painel de administração">
    <section className="admin-panel">
      <header className="admin-header"><div className="admin-heading-icon"><Settings /></div><div><strong>Administração</strong><span>{community.name} · modo local — em produção, sincroniza com Supabase</span></div><button className="admin-icon-button" onClick={onClose} aria-label="Fechar painel"><X /></button></header>
      <div className="admin-layout"><nav className="admin-nav">{allowedTabs.map((item) => <button key={item} className={visibleTab === item ? 'active' : ''} onClick={() => setTab(item)}>{item === 'Áudios' ? <Music /> : item === 'Membros' ? <Users /> : item === 'Logs / Auditoria' ? <Activity /> : item === 'Perigo' ? <Ban /> : item === 'Cargos' ? <Shield /> : <Settings />}{item}</button>)}</nav>
        <main className="admin-content">
          {visibleTab === 'Geral' && <><div className="admin-title"><div><h1>Configurações gerais</h1><p>Identidade e informações da comunidade.</p></div></div><div className="admin-card"><label>Nome da comunidade{input(name, setName, 'Nome')}</label><label>Descrição<textarea className={field} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Sobre esta comunidade" /></label><div className="admin-grid"><label>Ícone da comunidade{imageControl('Imagem do ícone', icon.startsWith('data:') ? icon : '', setIcon)}{!icon.startsWith('data:') && <input className={field} value={icon} onChange={(event) => setIcon(event.target.value)} aria-label="Símbolo geométrico" />}</label><div className="admin-banner-editor"><span className="admin-banner-label">Banner da comunidade</span><div className={`admin-banner-preview ${banner ? 'has-image' : ''}`} style={{ backgroundImage: banner ? `linear-gradient(0deg, rgba(4, 15, 24, .72), rgba(4, 15, 24, .08) 78%), url("${banner}")` : undefined }}><div className="admin-banner-caption"><strong>{community.name}</strong><span>Prévia da capa</span></div></div><input ref={bannerInputRef} className="admin-banner-input" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={uploadBanner} aria-label="Escolher banner JPG, PNG ou WEBP" /><div className="admin-banner-actions"><button type="button" className={button} onClick={() => bannerInputRef.current?.click()}><ImagePlus /> Alterar Banner</button>{banner && <button type="button" className={`${button} admin-remove-banner`} onClick={() => setBanner('')}><X /> Remover Banner</button>}<small>JPG, PNG ou WEBP · Máximo de 5 MB</small></div></div></div><button className={`${button} primary`} onClick={saveGeneral}><Check /> Salvar</button></div>{!isOwner && <div className="admin-card admin-danger" style={{marginTop: '1rem'}}><h3>Sair da Comunidade</h3><p>Ao sair, você perderá acesso a todos os canais e conversas desta comunidade.</p><button className={`${button} danger`} onClick={() => setIsLeaveCommunityOpen(true)}><LogOut /> Sair da Comunidade</button></div>}</>}

          {visibleTab === 'Áudios' && <GroupAudioSettings communityId={currentCommunityId} />} {visibleTab === 'Canais' && <><div className="admin-title"><div><h1>Canais e categorias</h1><p>Organize conversas e salas da comunidade.</p></div><button className={`${button} primary`} onClick={() => setIsCreateChannelModalOpen(true)}><Plus /> Novo canal</button></div><div className="admin-card"><h3>Criar categoria</h3><div className="admin-inline">{input(categoryName, setCategoryName, 'Nome da categoria')}<button className={button} onClick={addCategory}><Plus /> Criar</button></div>{community.categories.map((category) => <div className="admin-category" key={category.id}><strong>{category.name}</strong><span>{community.channels.filter((channel) => channel.categoryId === category.id && !state.archived.includes(channel.id)).length} canais</span></div>)}</div><div className="admin-card"><h3>Canais ativos</h3>{orderedChannels.map((channel, index) => <div className="admin-channel" key={channel.id} draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', channel.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const dragged = event.dataTransfer.getData('text/plain'); const order = orderedChannels.map((item) => item.id); const from = order.indexOf(dragged); const to = order.indexOf(channel.id); if (from >= 0 && to >= 0) { order.splice(to, 0, ...order.splice(from, 1)); updateState({ channelOrder: order }); log('Ordem de canais alterada', channel.name, 'channel'); } }}><GripVertical /><div className="admin-channel-main"><strong>{channel.type === 'text' ? '#' : '◉'} {channel.name}</strong>{editingChannel === channel.id ? <div className="admin-edit-grid">{input(channelDraft.name, (value) => setChannelDraft({ ...channelDraft, name: value }), 'Nome')}<input className={field} value={channelDraft.topic} onChange={(event) => setChannelDraft({ ...channelDraft, topic: event.target.value })} placeholder="Tópico" /><select className={field} value={channelDraft.categoryId} onChange={(event) => setChannelDraft({ ...channelDraft, categoryId: event.target.value })}>{community.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><label className="admin-check"><input type="checkbox" checked={channelDraft.isPrivate} onChange={(event) => setChannelDraft({ ...channelDraft, isPrivate: event.target.checked })} /> Privado</label><button className={button} onClick={() => saveChannel(channel)}>Salvar</button><button className={button} onClick={() => setEditingChannel(null)}>Cancelar</button></div> : <span>{channel.topic || 'Sem tópico'} · {community.categories.find((item) => item.id === channel.categoryId)?.name || 'Sem categoria'}{channel.isPrivate ? ' · Privado' : ''}</span>}</div><div className="admin-actions">{index > 0 && <button title="Mover para cima" onClick={() => moveChannel(channel.id, -1)}><ArrowUp /></button>}{index < orderedChannels.length - 1 && <button title="Mover para baixo" onClick={() => moveChannel(channel.id, 1)}><ArrowDown /></button>}<select aria-label={`Mover ${channel.name} de categoria`} onChange={(event) => moveToCategory(channel.id, event.target.value)} value={channel.categoryId}>{community.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button title="Editar canal" onClick={() => { setEditingChannel(channel.id); setChannelDraft({ name: channel.name, topic: channel.topic || '', categoryId: channel.categoryId, isPrivate: !!channel.isPrivate }); }}>Editar</button><button title="Arquivar canal" onClick={() => { updateState({ archived: [...state.archived, channel.id] }); updateChannel(channel.id, { isArchived: true }); log('Canal arquivado', channel.name, 'channel'); }}>Arquivar</button>{canDeleteChannel(channel) && <button className={`${button} danger`} title="Excluir canal" aria-label={`Excluir canal ${channel.name}`} onClick={() => setChannelToDelete(channel)}><Trash2 /> Excluir Canal</button>}</div></div>)}{orderedChannels.length === 0 && <p className="admin-muted">Nenhum canal ativo.</p>}</div><div className="admin-card"><h3>Arquivados</h3>{state.archived.map((id) => { const channel = community.channels.find((item) => item.id === id); return channel && <div className="admin-category" key={id}><span>{channel.name}</span><button className={button} onClick={() => { updateState({ archived: state.archived.filter((item) => item !== id) }); updateChannel(id, { isArchived: false }); log('Canal reativado', channel.name, 'channel'); }}>Reativar</button></div>; })}</div></>}

          {visibleTab === 'Membros' && <><div className="admin-title"><div><h1>Membros</h1><p>Gerencie acesso, cargos e moderação.</p></div>{isAdmin && <button className={`${button} primary`} onClick={() => { setInviteModalOpen(true); setInviteTarget(null); setInviteQuery(''); setInviteMessage(''); }}><Plus /> Convidar Amigo</button>}</div><label className="admin-search"><Search />{input(memberSearch, setMemberSearch, 'Buscar membro por nome ou @handle')}</label><div className="admin-card admin-table-wrap"><table className="admin-table"><thead><tr><th>Membro</th><th>Cargo</th><th>Entrada</th><th>Último acesso</th><th>Ações</th></tr></thead><tbody>{memberRows.map((user) => <tr key={user.id}><td><button className="admin-person" onClick={() => openUserProfile(user)}>{user.avatar ? <img src={user.avatar} alt="" /> : <span className="admin-avatar-fallback">{user.name.trim().charAt(0).toUpperCase() || '◇'}</span>}<span>{user.name}<small>@{user.handle}</small></span></button>{user.id === state.ownerId && <span className="admin-owner"><Crown /> Proprietário</span>}</td><td>{state.roles.filter((role) => (state.memberRoles[user.id] || []).includes(role.id)).map((role) => <span key={role.id} className="admin-role-chip" style={{ '--role-color': role.color } as React.CSSProperties}>{role.name}</span>)}{user.id !== state.ownerId && can('roles') && <select aria-label={`Cargo para ${user.name}`} value="" onChange={(event) => event.target.value && void updateCommunityRole(user.id, event.target.value as 'admin' | 'moderator' | 'member')}><option value="">Mudar Cargo</option><option value="member">Membro</option><option value="moderator">Moderador</option><option value="admin">Admin</option></select>}</td><td>{joinedDate(user.id, currentCommunityId, members)}</td><td><span className={'admin-presence ' + (user.status === 'online' ? 'is-online' : user.status === 'idle' ? 'is-idle' : 'is-offline')}><i aria-hidden="true" />{user.status === 'online' ? 'Online agora' : user.status === 'idle' ? 'Ausente' : 'Offline'}</span></td><td className="admin-actions"><button onClick={() => openUserProfile(user)}>Perfil</button>{isAdmin && user.id !== state.ownerId && <span className="inline-flex items-center gap-1">{updatingMemberId === user.id && <Loader2 className="h-3 w-3 animate-spin" />}<select aria-label={`Mudar cargo de ${user.name}`} disabled={updatingMemberId === user.id} value={communityRoles[user.id] || 'member'} onChange={(event) => void updateCommunityRole(user.id, event.target.value as 'admin' | 'moderator' | 'member')}><option value="member">Membro</option><option value="moderator">Moderador</option><option value="admin">Admin</option></select></span>}{user.id !== state.ownerId && user.id !== currentUser.id && <>{can('roles') && <select aria-label={`Remover cargo de ${user.name}`} value="" onChange={(event) => event.target.value && setMemberRole(user.id, event.target.value, false)}><option value="">Remover cargo…</option>{state.roles.filter((role) => (state.memberRoles[user.id] || []).includes(role.id)).map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select>}{can('kick') && <button title="Expulsar membro" onClick={() => openKickConfirmation(user)}><UserMinus /></button>}{can('ban') && <button title="Banir membro" onClick={() => changeMemberStatus(user, 'ban')}><Ban /></button>}</>}</td></tr>)}</tbody></table></div><div className="admin-card"><h3>Banidos</h3>{state.banned.length === 0 && <p className="admin-muted">Nenhum membro banido.</p>}{state.banned.map((entry) => <div className="admin-category" key={entry.id}><span>{users.find((user) => user.id === entry.id)?.name || entry.id} · {entry.reason || 'Sem motivo'}</span>{can('ban') && <button className={button} onClick={() => { updateState({ banned: state.banned.filter((item) => item.id !== entry.id) }); log('Membro desbanido', entry.id, 'ban'); }}>Desbanir</button>}</div>)}</div></>}

          {visibleTab === 'Cargos' && <><div className="admin-title"><div><h1>Cargos e permissões</h1><p>Defina permissões e a hierarquia da comunidade.</p></div></div><div className="admin-card"><h3>Criar cargo</h3><div className="admin-inline">{input(roleName, setRoleName, 'Nome do cargo')}<input aria-label="Cor do cargo" type="color" value={roleColor} onChange={(event) => setRoleColor(event.target.value)} /><button className={`${button} primary`} onClick={createRole}><Plus /> Criar cargo</button></div><div className="admin-permissions">{permissions.map((permission) => <label key={permission.id}><input type="checkbox" checked={rolePerms.includes(permission.id)} onChange={(event) => setRolePerms(event.target.checked ? [...rolePerms, permission.id] : rolePerms.filter((item) => item !== permission.id))} />{permission.label}</label>)}</div></div><div className="admin-card"><h3>Hierarquia</h3>{state.roles.map((role, index) => <div className="admin-role-row" key={role.id}><span className="admin-role-chip" style={{ '--role-color': role.color } as React.CSSProperties}>{role.name}</span><span>{role.permissions.length} permissões</span><button disabled={index === 0} onClick={() => { const roles = [...state.roles]; [roles[index - 1], roles[index]] = [roles[index], roles[index - 1]]; updateState({ roles }); }}>↑</button><button disabled={index === state.roles.length - 1} onClick={() => { const roles = [...state.roles]; [roles[index + 1], roles[index]] = [roles[index], roles[index + 1]]; updateState({ roles }); }}>↓</button><button onClick={() => { if (window.confirm(`Apagar o cargo ${role.name}?`)) updateState({ roles: state.roles.filter((item) => item.id !== role.id), memberRoles: Object.fromEntries(Object.entries(state.memberRoles).map(([uid, ids]) => [uid, ids.filter((id) => id !== role.id)])), defaultRole: state.defaultRole === role.id ? '' : state.defaultRole }); }}>Remover</button></div>)}</div><div className="admin-card"><label>Cargo padrão de novos membros<select className={field} value={state.defaultRole} onChange={(event) => updateState({ defaultRole: event.target.value })}><option value="">Sem cargo padrão</option>{state.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label></div></>}

          {visibleTab === 'Convites' && <><div className="admin-title"><div><h1>Convites</h1><p>Crie links e convites personalizados.</p></div>{isAdmin && <button className={`${button} primary`} onClick={() => { setInviteModalOpen(true); setInviteTarget(null); setInviteQuery(''); setInviteMessage(''); }}><UserPlus /> Convite Personalizado</button>}</div><div className="admin-card"><div className="admin-grid"><label>Expiração<select className={field} value={expiry} onChange={(event) => setExpiry(event.target.value)}><option value="never">Nunca</option><option value="1h">1 hora</option><option value="1d">1 dia</option><option value="7d">7 dias</option><option value="30d">30 dias</option></select></label><label>Limite de usos<select className={field} value={uses} onChange={(event) => setUses(event.target.value)}><option value="unlimited">Ilimitado</option>{['1', '5', '10', '25'].map((value) => <option key={value}>{value}</option>)}</select></label></div><button className={`${button} primary`} onClick={createInvite}><Plus /> Gerar convite</button></div><div className="admin-card"><h3>Links ativos</h3>{state.invites.filter((invite) => !invite.revoked && (!invite.expiresAt || invite.expiresAt > nowMs()) && (!invite.maxUses || invite.uses < invite.maxUses)).map((invite) => <div className="admin-category" key={invite.id}><div><strong>{window.location.origin}/invite/{invite.code}</strong><small>{invite.uses} usos · {invite.maxUses ?? 'Ilimitado'} · {invite.expiresAt ? `Expira ${fmt(invite.expiresAt)}` : 'Sem expiração'}</small></div><button className={button} onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/invite/${invite.code}`); addToast('Link copiado', 'Convite copiado para a área de transferência.', 'success'); }}><Copy /> Copiar link</button><button className={button} onClick={() => { updateState({ invites: state.invites.map((item) => item.id === invite.id ? { ...item, revoked: true } : item) }); log('Convite revogado', invite.code, 'invite'); }}>Revogar</button></div>)}{state.invites.length === 0 && <p className="admin-muted">Nenhum convite ativo.</p>}</div></>}

          {visibleTab === 'Logs / Auditoria' && <><div className="admin-title"><div><h1>Logs / Auditoria</h1><p>Registro local das ações administrativas.</p></div></div><div className="admin-inline"><select className={field} value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}><option value="all">Todas as ações</option>{[...new Set(state.audit.map((entry) => entry.type))].map((type) => <option key={type}>{type}</option>)}</select>{input(memberFilter, setMemberFilter, 'Filtrar por membro')}</div><div className="admin-card">{state.audit.filter((entry) => (actionFilter === 'all' || entry.type === actionFilter) && (!memberFilter || `${entry.actor} ${entry.target}`.toLowerCase().includes(memberFilter.toLowerCase()))).map((entry) => <div className="admin-audit" key={entry.id}><Activity /><span><strong>{entry.actor}</strong> · {entry.action} <b>{entry.target}</b><small>{fmt(entry.time)}</small></span></div>)}{state.audit.length === 0 && <p className="admin-muted">Nenhuma ação registrada ainda.</p>}</div></>}

          {visibleTab === 'Perigo' && <>
            <div className="admin-title"><div><h1>Zona de perigo</h1><p>Ações que afetam a propriedade e os dados da comunidade.</p></div></div>
            <div className="admin-card admin-danger">
              <h3>Transferir propriedade</h3><p>A transferência exige selecionar o novo proprietário e confirmar duas vezes.</p>
              <select className={field} value={transferId} onChange={(event) => setTransferId(event.target.value)}><option value="">Selecione um membro</option>{users.filter((user) => user.id !== state.ownerId).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select>
              <button className={button} disabled={!transferId} onClick={() => {
                if (!confirmTransfer) { setConfirmTransfer(true); return; }
                const newOwner = transferId;
                const adminRoleIds = state.roles.filter((role) => role.name.toLowerCase() === 'admin').map((role) => role.id);
                const memberRoles = { ...state.memberRoles, [newOwner]: [...new Set([...(state.memberRoles[newOwner] || []), ...adminRoleIds])] };
                log('Propriedade transferida', users.find((user) => user.id === newOwner)?.name || newOwner, 'community', { ownerId: newOwner, memberRoles });
                updateCommunity(currentCommunityId, { ownerId: newOwner, creatorId: newOwner });
                setConfirmTransfer(false); setTransferId('');
              }}>{confirmTransfer ? 'Confirmar transferência' : 'Transferir propriedade'}</button>
              {confirmTransfer && <button className={button} onClick={() => setConfirmTransfer(false)}>Cancelar</button>}
            </div>
            {isAdmin && <div className="admin-card admin-danger"><h3>Excluir comunidade</h3><p>Essa ação remove a comunidade e seus dados permanentemente.</p><button className={`${button} danger`} onClick={() => { setDeleteCommunityName(''); setIsDeleteCommunityOpen(true); }}>Excluir Comunidade</button></div>}
            <div className="admin-card admin-danger"><h3>Resetar configurações</h3><p>Apaga cargos, convites, banimentos e auditoria locais desta comunidade.</p><button className={button} onClick={() => { if (window.confirm('Resetar as configurações locais da comunidade?')) { localStorage.removeItem(`koaline:admin:${community.id}`); persist({ ...blank, ownerId: currentUser.id }); addToast('Configurações resetadas', 'Os dados locais do painel foram reiniciados.', 'success'); } }}>Resetar configurações</button></div>
          </>}
        </main>
      </div>
    </section>
  </div>
  {inviteModalOpen && isAdmin && <div className="fixed inset-0 z-[145] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="community-invite-title"><div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950 p-6 text-white shadow-2xl"><div className="flex justify-between"><div><h2 id="community-invite-title" className="text-lg font-bold">Convidar amigo</h2><p className="mt-1 text-sm text-slate-400">Convide alguém para {community.name}.</p></div><button className="text-slate-400" onClick={() => setInviteModalOpen(false)} aria-label="Fechar"><X /></button></div><label className="mt-5 block text-xs font-semibold">@nick<input autoFocus className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm" value={inviteTarget ? `@${inviteTarget.username}` : inviteQuery} onChange={(event) => { setInviteTarget(null); setInviteQuery(event.target.value); }} placeholder="Digite o @nick" /></label>{!inviteTarget && inviteMatches.length > 0 && <div className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900">{inviteMatches.map((profile) => <button key={profile.id} type="button" onClick={() => { setInviteTarget(profile); setInviteQuery(`@${profile.username}`); setInviteMatches([]); }} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-800">{profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-700">◇</span>}<span>{profile.full_name || `@${profile.username}`}<small className="block text-slate-400">@{profile.username}</small></span></button>)}</div>}<label className="mt-4 block text-xs font-semibold">Mensagem personalizada<textarea rows={4} maxLength={500} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm" value={inviteMessage} onChange={(event) => setInviteMessage(event.target.value)} placeholder="Venha jogar com a gente!" /></label><div className="mt-5 flex justify-end gap-2"><button className={button} onClick={() => setInviteModalOpen(false)}>Cancelar</button><button className={`${button} primary`} disabled={!inviteTarget || !inviteMessage.trim() || inviteSending} onClick={() => void sendInvite()}>{inviteSending ? 'Enviando…' : 'Enviar Convite'}</button></div></div></div>}  {isDeleteCommunityOpen && <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-community-title"><div className="w-full max-w-md rounded-2xl border border-rose-700/60 bg-slate-950 p-6 text-white shadow-2xl"><h2 id="delete-community-title" className="text-lg font-bold text-rose-300">Excluir comunidade</h2><p className="mt-2 text-sm text-slate-300">Para confirmar, digite exatamente <strong>{community.name}</strong>. Canais e mensagens relacionados também serão excluídos.</p><input autoFocus value={deleteCommunityName} onChange={(event) => setDeleteCommunityName(event.target.value)} className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-rose-500" aria-label="Nome exato da comunidade"/><div className="mt-5 flex justify-end gap-2"><button className={button} disabled={isDeletingCommunity} onClick={() => setIsDeleteCommunityOpen(false)}>Cancelar</button><button className={`${button} danger`} disabled={isDeletingCommunity || deleteCommunityName !== community.name || !isAdmin} onClick={async () => { setIsDeletingCommunity(true); const removed = await removeCommunity(community.id); setIsDeletingCommunity(false); if (removed) { setIsDeleteCommunityOpen(false); onClose(); } }}>{isDeletingCommunity ? 'Excluindo…' : 'Excluir permanentemente'}</button></div></div></div>}
  <ConfirmModal isOpen={!!channelToDelete} title="Excluir canal?" description="Essa ação é irreversível. Todas as mensagens serão apagadas. Deseja continuar?" confirmLabel="Sim, excluir" cancelLabel="Cancelar" onConfirm={confirmDeleteChannel} onCancel={() => setChannelToDelete(null)} />
    <ConfirmModal
      isOpen={isLeaveCommunityOpen}
      title="Sair da Comunidade?"
      description={`Tem certeza que deseja sair de ${community.name}? Você perderá acesso a todos os canais e conversas.`}
      confirmLabel="Sim, sair"
      cancelLabel="Cancelar"
      isDestructive
      onConfirm={async () => {
        setIsLeaveCommunityOpen(false);
        await leaveCommunity(currentCommunityId);
        onClose();
      }}
      onCancel={() => setIsLeaveCommunityOpen(false)}
    />
    <ConfirmModal
      isOpen={!!memberToKick}
      title="Expulsar Membro?"
      description={`Tem certeza que deseja remover ${memberToKick?.name} da comunidade? Esta ação não pode ser desfeita.`}
      confirmLabel="Sim, expulsar"
      cancelLabel="Cancelar"
      isDestructive
      onConfirm={confirmKickMember}
      onCancel={() => setMemberToKick(null)}
    />
  </>;
};

