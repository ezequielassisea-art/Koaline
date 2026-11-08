import React from 'react';
import { useApp } from '../../context/AppContext';
import { User } from '../../types';
import {
  X,
  Phone,
  Video,
  MessageSquare,
  ExternalLink,
  Edit3,
  Award,
  Users,
  Plus,
  Loader2,
  LogOut,
  Settings,
  Shield,
} from 'lucide-react';

const EMPTY_USER: User = { id: '', name: '', handle: '', avatar: '', status: 'offline', level: 1, xp: 0, xpMax: 100, badges: [], socials: [] };

const SidebarRightComponent: React.FC = () => {
  const {
    isContextPanelOpen,
    closeContextPanel,
    contextPanelUser,
    currentUser,
    currentCommunityId,
    dms,
    addToast,
    openDirectMessage,
    isDmLoading,
    openUserProfile,
    setIsProfileEditorOpen,
    startDirectCall,
    leaveCommunity,
    members,
    communities,
  } = useApp();

  const user = contextPanelUser || currentUser;
  const isSelf = user.id === currentUser.id;

  // Get community members for the current community
  const activeCommunity = communities.find((c) => c.id === currentCommunityId);
  const communityMembers = activeCommunity
    ? members.filter((m) => m.communityId === currentCommunityId)
    : [];

  // Build member map from community members with profiles
  const memberMap = new Map<string, typeof currentUser>();
  [currentUser, ...dms.filter((dm) => !dm.isArchived).map((dm) => dm.user)].forEach((member) => {
    if (member.id) memberMap.set(member.id, member);
  });

  // Combine community members with member data
  const panelMembers = communityMembers.map((cm) => {
    const existing = memberMap.get(cm.userId);
    return existing || {
      ...EMPTY_USER,
      id: cm.userId,
      name: 'Membro',
      handle: 'usuario',
      avatar: '',
      status: 'offline' as const,
      communityRole: cm.role,
    };
  });

  // Also add any members from DMs that aren't in community
  const dmMembers = [...memberMap.values()].filter((m) => !communityMembers.some((cm) => cm.userId === m.id));
  const allMembers = [...panelMembers, ...dmMembers];

  const totalCount = allMembers.length;

  // Group by role: Admins (owner, admin, moderator), then Online, then Offline
  const adminMembers = allMembers.filter((m) => m.communityRole && ['owner', 'admin', 'moderator'].includes(m.communityRole));
  const regularMembers = allMembers.filter((m) => !m.communityRole || !['owner', 'admin', 'moderator'].includes(m.communityRole));
  const onlineMembers = regularMembers.filter((m) => m.status === 'online');
  const offlineMembers = regularMembers.filter((m) => m.status !== 'online');

  const handleInviteClick = () => {
    try {
      const adminState = JSON.parse(localStorage.getItem('koaline:admin:' + currentCommunityId) || '{}') as {
        invites?: Array<{ code: string; revoked?: boolean; expiresAt?: number; uses?: number; maxUses?: number }>;
      };
      const invite = adminState.invites?.find((item) =>
        !item.revoked && (!item.expiresAt || item.expiresAt > Date.now()) && (!item.maxUses || (item.uses || 0) < item.maxUses)
      );
      if (!invite) {
        addToast('Nenhum convite ativo', 'Gere um link na aba Convites da administração da comunidade.', 'warning');
        return;
      }
      const inviteUrl = window.location.origin + '/invite/' + invite.code;
      if (!navigator.clipboard?.writeText) {
        addToast('Convite disponível', inviteUrl);
        return;
      }
      navigator.clipboard.writeText(inviteUrl).then(
        () => addToast('Convite copiado', 'O link foi copiado para a área de transferência.', 'success'),
        () => addToast('Convite disponível', inviteUrl)
      );
    } catch {
      addToast('Convite indisponível', 'Tente novamente pelo painel de administração.', 'warning');
    }
  };

  if (!isContextPanelOpen) return null;

  if (!contextPanelUser) {
    const getRoleIcon = (role?: string) => {
      if (!role) return null;
      if (role === 'owner') return <Shield className="w-3.5 h-3.5 text-amber-400" aria-label="Owner" />;
      if (role === 'admin') return <Shield className="w-3.5 h-3.5 text-[#00BFFF]" aria-label="Admin" />;
      if (role === 'moderator') return <Shield className="w-3.5 h-3.5 text-sky-400" aria-label="Moderator" />;
      return null;
    };

    const renderMember = (member: typeof currentUser) => (
      <button
        key={member.id}
        className="group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors w-full text-left"
        onClick={() => openUserProfile(member)}
      >
        {/* Avatar 32px */}
        <div className="relative flex-shrink-0">
          {member.avatar ? (
            <img src={member.avatar} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-gray-200" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-100 ring-1 ring-gray-200 grid place-items-center text-sm font-bold text-gray-600">
              {member.name.trim().charAt(0).toUpperCase() || '◇'}
            </div>
          )}
          <span
            className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ring-2 ring-white ${
              member.status === 'online' ? 'bg-emerald-500' :
              member.status === 'idle' ? 'bg-amber-500' :
              member.status === 'dnd' ? 'bg-rose-500' : 'bg-gray-400'
            }`}
            aria-label={member.status === 'online' ? 'Online' : 'Offline'}
          />
        </div>

        {/* Name & Handle */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-semibold text-sm text-gray-900">{member.name || 'Membro'}</span>
            {getRoleIcon(member.communityRole)}
          </div>
          <span className="truncate text-xs text-gray-500">@{member.handle || 'usuario'}</span>
        </div>
      </button>
    );

    return (
      <aside className="w-[280px] flex-shrink-0 flex flex-col h-full bg-white border-l border-gray-100 overflow-y-auto animate-in slide-in-from-right duration-200 select-none">
        <header className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#00BFFF]" />
              Membros - <span className="text-gray-500 font-normal">{totalCount}</span>
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" onClick={handleInviteClick} title="Copiar um convite ativo" aria-label="Copiar convite ativo"><Plus className="w-4 h-4" /></button>
            <button className="p-2 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50 transition-colors" onClick={async () => { const confirmed = window.confirm('Tem certeza que deseja sair desta comunidade?'); if (confirmed) { await leaveCommunity(currentCommunityId); closeContextPanel(); } }} title="Sair da Comunidade" aria-label="Sair da Comunidade"><LogOut className="w-4 h-4" /></button>
            <button className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" onClick={closeContextPanel} title="Fechar painel" aria-label="Fechar painel"><X className="w-4 h-4" /></button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {adminMembers.length > 0 && (
            <section>
              <h3 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 px-1">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                Administradores <small className="font-normal text-gray-400">{adminMembers.length}</small>
              </h3>
              <div className="space-y-1">
                {adminMembers.map(renderMember)}
              </div>
            </section>
          )}
          <section>
            <h3 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 px-1">
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-500" />
              Online <small className="font-normal text-gray-400">{onlineMembers.length}</small>
            </h3>
            <div className="space-y-1">
              {onlineMembers.map(renderMember)}
              {onlineMembers.length === 0 && <p className="text-sm text-gray-500 px-1 py-2">Ninguém online agora.</p>}
            </div>
          </section>
          <section>
            <h3 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 px-1">
              <span className="w-3.5 h-3.5 rounded-full bg-gray-400" />
              Offline <small className="font-normal text-gray-400">{offlineMembers.length}</small>
            </h3>
            <div className="space-y-1">
              {offlineMembers.map(renderMember)}
              {offlineMembers.length === 0 && <p className="text-sm text-gray-500 px-1 py-2">Todos estão online.</p>}
            </div>
          </section>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-[280px] flex-shrink-0 flex flex-col h-full bg-white border-l border-gray-100 overflow-y-auto animate-in slide-in-from-right duration-200 select-none">
      {/* Top Banner with Close button */}
      <div className="relative h-28 flex-shrink-0 rounded-t-2xl bg-gradient-to-br from-[#00BFFF]/20 to-sky-500/20">
        {user.banner && (
          <img
            src={user.banner}
            alt="Banner"
            className="w-full h-full object-cover opacity-80 rounded-t-2xl"
          />
        )}
        <button
          onClick={closeContextPanel}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-gray-100/80 text-gray-700 hover:bg-gray-200 backdrop-blur-sm transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Avatar & Quick Stats */}
      <div className="px-5 pb-5 -mt-12 flex-1">
        <div className="flex items-end justify-between mb-3">
          <div className="relative">
            {user.avatar ? <img src={user.avatar} alt={user.name} className="w-20 h-20 rounded-full object-cover ring-4 ring-white shadow-xl" /> : <div aria-label={user.name || 'Avatar padrão'} className="w-20 h-20 rounded-full bg-gray-100 ring-4 ring-white shadow-xl grid place-items-center text-xl text-gray-600">{user.name.trim().charAt(0).toUpperCase() || '◇'}</div>}
            <span
              className={`status-presence absolute bottom-1 right-1 w-4 h-4 rounded-full ring-2 ring-white ${
                user.status === 'online'
                  ? 'bg-emerald-500 is-online'
                  : user.status === 'idle'
                  ? 'bg-amber-500'
                  : user.status === 'dnd'
                  ? 'bg-rose-500'
                  : 'bg-gray-400'
              }`}
            />
          </div>

          {!isSelf && (
            <div className="flex items-center gap-1.5 pb-1">
              <button
                onClick={() => startDirectCall(user, 'voice')}
                title="Chamada de voz"
                className="p-2 rounded-full bg-gray-100 hover:bg-[#00BFFF]/20 text-[#00BFFF] transition-colors"
              >
                <Phone className="w-4 h-4" />
              </button>
              <button
                onClick={() => startDirectCall(user, 'video')}
                title="Chamada de vídeo"
                className="p-2 rounded-full bg-gray-100 hover:bg-sky-100 text-sky-500 transition-colors"
              >
                <Video className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Identity & Status */}
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base text-gray-900 truncate">
              {user.name}
            </h3>
            {user.pronouns && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                {user.pronouns}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500">@{user.handle}</div>

          {user.customStatus && (
            <div className="mt-2.5 p-2 rounded-lg bg-gray-50 border border-gray-200 flex items-center gap-2 text-xs">
              <span className="text-base">{user.customStatus.emoji}</span>
              <span className="text-gray-700 italic truncate">{user.customStatus.text}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {isSelf ? (
          <div className="grid grid-cols-1 gap-2 mb-5">
            <button
              onClick={() => setIsProfileEditorOpen(true)}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-full bg-[#00BFFF] hover:bg-[#009FD6] text-white font-medium text-xs shadow-md transition-all"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editar Perfil</span>
            </button>
          </div>
        ) : (
          <button
            disabled={isDmLoading}
            onClick={async () => {
              if (await openDirectMessage(user)) closeContextPanel();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-[#00BFFF] hover:bg-[#009FD6] disabled:opacity-70 disabled:cursor-wait text-white font-medium text-xs shadow-lg shadow-[#00BFFF]/30 mb-5 transition-all"
          >
            {isDmLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
            <span>{isDmLoading ? 'Carregando conversa…' : 'Enviar Mensagem Direta'}</span>
          </button>
        )}

        {/* Level & XP */}
        <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 mb-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-gray-900 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-[#00BFFF]" /> Nível {user.level}
            </span>
            <span className="text-[11px] text-gray-500">
              {user.xp} / {user.xpMax} XP
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#00BFFF] to-sky-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (user.xp / user.xpMax) * 100)}%` }}
            />
          </div>
        </div>

        {/* Bio */}
        {user.bio && (
          <div className="mb-4">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
              Sobre
            </h4>
            <p className="text-xs text-gray-600 leading-relaxed">{user.bio}</p>
          </div>
        )}

        {/* Badges */}
        {user.badges && user.badges.length > 0 && (
          <div className="mb-4">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
              Conquistas
            </h4>
            <div className="flex flex-wrap gap-2">
              {user.badges.map((b) => (
                <div
                  key={b.id}
                  title={`${b.name} — ${b.description}`}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-xs border border-gray-200 hover:border-[#00BFFF]/50 transition-colors cursor-help"
                >
                  <span>{b.icon}</span>
                  <span className="text-[11px] font-medium text-gray-700">{b.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Interests */}
        {user.interests && user.interests.length > 0 && (
          <div className="mb-4">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
              Habilidades & Interesses
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {user.interests.map((interest, i) => (
                <span
                  key={i}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-[#00BFFF]/10 text-[#00BFFF] font-medium border border-[#00BFFF]/20"
                >
                  {interest}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Social Links */}
        {user.socials && user.socials.some((s) => s.visible) && (
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
              Links
            </h4>
            <div className="space-y-1.5">
              {user.socials
                .filter((s) => s.visible)
                .map((social, idx) => (
                  <a
                    key={idx}
                    href={social.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-xs text-gray-700 transition-colors border border-gray-200"
                  >
                    <span>{social.platform}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                  </a>
                ))}
            </div>
          </div>
        )}

        {/* User Profile Block at bottom - mt-auto */}
        <div className="mt-auto pt-4 border-t border-gray-100">
          <button
            onClick={() => setIsProfileEditorOpen(true)}
            className="group w-full flex items-center gap-3 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-200 text-left"
            title="Editar perfil"
            aria-label="Editar perfil"
          >
            {currentUser.avatar ? (
              <img src={currentUser.avatar} alt={currentUser.name} className="w-8 h-8 rounded-full object-cover ring-1 ring-gray-200 flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-100 ring-1 ring-gray-200 flex-shrink-0 grid place-items-center text-xs font-semibold text-gray-600">
                {currentUser.name.trim().charAt(0).toUpperCase() || '◇'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="truncate font-semibold text-sm text-gray-900">
                {currentUser.name.split(' ')[0]}
              </div>
              <div className="truncate text-[11px] text-gray-500">
                @{currentUser.handle}
              </div>
            </div>
            <Settings className="w-4 h-4 text-gray-400 group-hover:text-[#00BFFF] transition-colors flex-shrink-0" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export const SidebarRight = React.memo(SidebarRightComponent);