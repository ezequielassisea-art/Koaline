import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { User } from '../../types';
import {
  X,
  Plus,
  Search,
  ChevronDown,
  ChevronUp,
  Settings,
  Shield,
  LogOut,
  UserPlus,
  Mail,
  Phone,
  Video,
  MessageSquare,
  MoreHorizontal,
  Users,
  Edit3,
} from 'lucide-react';

const EMPTY_USER: User = { id: '', name: '', handle: '', avatar: '', status: 'offline', level: 1, xp: 0, xpMax: 100, badges: [], socials: [] };

const MemberList: React.FC = () => {
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
    setIsThemeCustomizerOpen,
    startDirectCall,
    leaveCommunity,
    members,
    communities,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    admins: true,
    online: true,
    offline: true,
  });

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

  // Group by role: Admins (owner, admin, moderator), then Online, then Offline
  const adminMembers = allMembers.filter((m) => m.communityRole && ['owner', 'admin', 'moderator'].includes(m.communityRole));
  const regularMembers = allMembers.filter((m) => !m.communityRole || !['owner', 'admin', 'moderator'].includes(m.communityRole));
  const onlineMembers = regularMembers.filter((m) => m.status === 'online');
  const offlineMembers = regularMembers.filter((m) => m.status !== 'online');

  // Filter by search
  const filteredAdmins = adminMembers.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.handle.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredOnline = onlineMembers.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.handle.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredOffline = offlineMembers.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.handle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalCount = allMembers.length;

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

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const getRoleIcon = (role?: string) => {
    if (!role) return null;
    if (role === 'owner') return <Shield className="w-3.5 h-3.5 text-amber-400" aria-label="Owner" />;
    if (role === 'admin') return <Shield className="w-3.5 h-3.5 text-indigo-400" aria-label="Admin" />;
    if (role === 'moderator') return <Shield className="w-3.5 h-3.5 text-sky-400" aria-label="Moderator" />;
    return null;
  };

  const getRoleBadge = (role?: string) => {
    if (!role) return null;
    const badges: Record<string, { label: string; className: string }> = {
      owner: { label: 'Owner', className: 'member-role-badge owner' },
      admin: { label: 'Admin', className: 'member-role-badge admin' },
      moderator: { label: 'Mod', className: 'member-role-badge moderator' },
    };
    const badge = badges[role];
    if (!badge) return null;
    return <span className={badge.className}>{badge.label}</span>;
  };

  const renderMember = (member: typeof currentUser) => (
    <button
      key={member.id}
      className="member-item group"
      onClick={() => openUserProfile(member)}
      title={member.name}
      aria-label={member.name}
    >
      {/* Avatar 32px */}
      <div className="relative flex-shrink-0">
        {member.avatar ? (
          <img src={member.avatar} alt="" className="member-avatar" />
        ) : (
          <div className="member-avatar-fallback">
            {member.name.trim().charAt(0).toUpperCase() || '◇'}
          </div>
        )}
        <span
          className={`member-status-dot absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-[var(--discord-bg-secondary)] ${
            member.status === 'online' ? 'bg-emerald-500' :
            member.status === 'idle' ? 'bg-amber-500' :
            member.status === 'dnd' ? 'bg-rose-500' : 'bg-zinc-400'
          }`}
          aria-label={member.status === 'online' ? 'Online' : 'Offline'}
        />
      </div>

      {/* Name & Info */}
      <div className="member-info">
        <div className="member-name-row">
          <span className="member-name truncate">{member.name || 'Membro'}</span>
          {getRoleBadge(member.communityRole)}
        </div>
        <div className="member-status">
          <span className="member-status-indicator">
            <span className={`member-status-dot ${member.status}`} />
            <span>
              {member.status === 'online' ? 'Online' :
               member.status === 'idle' ? 'Ausente' :
               member.status === 'dnd' ? 'Não perturbe' : 'Offline'}
            </span>
          </span>
        </div>
      </div>
    </button>
  );

  if (!isContextPanelOpen && !contextPanelUser) return null;

  // User Profile View (when clicking on a specific user)
  if (contextPanelUser) {
    return (
      <aside className="member-list flex flex-col h-full animate-in slide-in-from-right duration-200">
        {/* Top Banner with Close button */}
        <div className="relative h-28 flex-shrink-0 bg-gradient-to-br from-indigo-900/50 to-violet-900/50">
          {user.banner && (
            <img
              src={user.banner}
              alt="Banner"
              className="w-full h-full object-cover opacity-80"
            />
          )}
          <button
            onClick={closeContextPanel}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Avatar & Quick Stats */}
        <div className="px-5 pb-5 -mt-12 flex-1 overflow-y-auto">
          <div className="flex items-end justify-between mb-3">
            <div className="relative">
              {user.avatar ? <img src={user.avatar} alt={user.name} className="w-20 h-20 rounded-full object-cover ring-4 ring-[var(--discord-bg-secondary)] shadow-xl" /> : <div aria-label={user.name || 'Avatar padrão'} className="w-20 h-20 rounded-full bg-slate-700 ring-4 ring-[var(--discord-bg-secondary)] shadow-xl grid place-items-center text-xl text-white">{user.name.trim().charAt(0).toUpperCase() || '◇'}</div>}
              <span
                className={`status-presence absolute bottom-1 right-1 w-4 h-4 rounded-full ring-2 ring-[var(--discord-bg-secondary)] ${
                  user.status === 'online'
                    ? 'bg-emerald-500 is-online'
                    : user.status === 'idle'
                    ? 'bg-amber-500'
                    : user.status === 'dnd'
                    ? 'bg-rose-500'
                    : 'bg-zinc-400'
                }`}
              />
            </div>

            {!isSelf && (
              <div className="flex items-center gap-1.5 pb-1">
                <button
                  onClick={() => startDirectCall(user, 'voice')}
                  title="Chamada de voz"
                  className="p-2 rounded-full bg-slate-800 hover:bg-indigo-600/30 text-indigo-400 transition-colors"
                >
                  <Phone className="w-4 h-4" />
                </button>
                <button
                  onClick={() => startDirectCall(user, 'video')}
                  title="Chamada de vídeo"
                  className="p-2 rounded-full bg-slate-800 hover:bg-sky-500/30 text-sky-400 transition-colors"
                >
                  <Video className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Identity & Status */}
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-base text-white truncate">
                {user.name}
              </h3>
              {user.pronouns && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium">
                  {user.pronouns}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400">@{user.handle}</div>

            {user.customStatus && (
              <div className="mt-2.5 p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-2 text-xs">
                <span className="text-base">{user.customStatus.emoji}</span>
                <span className="text-slate-200 italic truncate">{user.customStatus.text}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {isSelf ? (
            <div className="grid grid-cols-2 gap-2 mb-5">
              <button
                onClick={() => setIsProfileEditorOpen(true)}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md transition-all"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Editar Perfil</span>
              </button>
              <button
                onClick={() => setIsThemeCustomizerOpen(true)}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition-all"
              >
                <Settings className="w-3.5 h-3.5 text-sky-400" />
                <span>Tema</span>
              </button>
            </div>
          ) : (
            <button
              disabled={isDmLoading}
              onClick={async () => {
                if (await openDirectMessage(user)) closeContextPanel();
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-70 disabled:cursor-wait text-white font-medium text-xs shadow-lg shadow-indigo-600/30 mb-5 transition-all"
            >
              {isDmLoading ? <div className="w-4 h-4 animate-spin border-2 border-white border-t-transparent rounded-full" /> : <MessageSquare className="w-4 h-4" />}
              <span>{isDmLoading ? 'Carregando conversa…' : 'Enviar Mensagem Direta'}</span>
            </button>
          )}

          {/* Level & XP */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 mb-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-200 flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-indigo-400" /> Nível {user.level}
              </span>
              <span className="text-[11px] text-slate-400">
                {user.xp} / {user.xpMax} XP
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-violet-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (user.xp / user.xpMax) * 100)}%` }}
              />
            </div>
          </div>

          {/* Bio */}
          {user.bio && (
            <div className="mb-4">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Sobre
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">{user.bio}</p>
            </div>
          )}

          {/* Badges */}
          {user.badges && user.badges.length > 0 && (
            <div className="mb-4">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Conquistas
              </h4>
              <div className="flex flex-wrap gap-2">
                {user.badges.map((b) => (
                  <div
                    key={b.id}
                    title={`${b.name} — ${b.description}`}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 text-xs border border-slate-700/80 hover:border-indigo-500/50 transition-colors cursor-help"
                  >
                    <span>{b.icon}</span>
                    <span className="text-[11px] font-medium text-slate-200">{b.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interests */}
          {user.interests && user.interests.length > 0 && (
            <div className="mb-4">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Habilidades & Interesses
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {user.interests.map((interest, i) => (
                  <span
                    key={i}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 font-medium border border-indigo-500/20"
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
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
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
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-xs text-slate-200 transition-colors border border-slate-800"
                    >
                      <span>{social.platform}</span>
                      <MoreHorizontal className="w-3.5 h-3.5 text-slate-400" />
                    </a>
                  ))}
              </div>
            </div>
          )}

          {/* User Profile Block at bottom - mt-auto */}
          <div className="mt-auto pt-4 border-t border-slate-800">
            <button
              onClick={() => setIsProfileEditorOpen(true)}
              className="group w-full flex items-center gap-3 p-2 rounded-lg bg-slate-950 hover:bg-slate-800 transition-colors border border-slate-800 text-left"
              title="Editar perfil"
              aria-label="Editar perfil"
            >
              {currentUser.avatar ? (
                <img src={currentUser.avatar} alt={currentUser.name} className="w-8 h-8 rounded-full object-cover ring-1 ring-border flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-700 ring-1 ring-border flex-shrink-0 grid place-items-center text-xs font-semibold text-white">
                  {currentUser.name.trim().charAt(0).toUpperCase() || '◇'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="truncate font-semibold text-sm text-white">
                  {currentUser.name.split(' ')[0]}
                </div>
                <div className="truncate text-[11px] text-slate-400">
                  @{currentUser.handle}
                </div>
              </div>
              <Settings className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
            </button>
          </div>
        </div>
      </aside>
    );
  }

  // Member List View
  return (
    <aside className="member-list flex flex-col h-full animate-in slide-in-from-right duration-200">
      {/* Header */}
      <header className="member-list-header">
        <div className="member-list-title">
          <Users className="w-5 h-5 text-indigo-400" />
          <h2>Membros</h2>
          <span className="member-count">({totalCount})</span>
        </div>
        <div className="member-list-actions">
          <button className="member-list-btn" onClick={handleInviteClick} title="Convidar" aria-label="Convidar">
            <UserPlus className="w-4 h-4" />
          </button>
          <button className="member-list-btn" onClick={closeContextPanel} title="Fechar" aria-label="Fechar painel">
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Search */}
      <div className="px-3 pb-3 border-b border-[var(--discord-border)] flex-shrink-0">
        <div className="chat-area-search-wrapper">
          <Search />
          <input
            type="text"
            placeholder="Buscar membros..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="chat-area-search-input"
            style={{ height: '36px', paddingLeft: '36px' }}
          />
        </div>
      </div>

      {/* Member List Content */}
      <div className="member-list-content">
        {/* Admins Group */}
        <div className="member-group">
          <button
            className="member-group-header"
            onClick={() => toggleGroup('admins')}
            type="button"
          >
            <span className={`member-group-toggle ${expandedGroups.admins ? '' : 'rotate-90'}`}>
              <ChevronDown className="w-4 h-4" />
            </span>
            <span className="member-group-name flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              Administradores
            </span>
            <span className="member-group-count">{filteredAdmins.length}</span>
          </button>

          {expandedGroups.admins && (
            <div className="space-y-1">
              {filteredAdmins.length > 0 ? (
                filteredAdmins.map(renderMember)
              ) : (
                <p className="text-sm text-slate-500 px-2 py-2">Nenhum administrador encontrado.</p>
              )}
            </div>
          )}
        </div>

        {/* Online Group */}
        <div className="member-group">
          <button
            className="member-group-header"
            onClick={() => toggleGroup('online')}
            type="button"
          >
            <span className={`member-group-toggle ${expandedGroups.online ? '' : 'rotate-90'}`}>
              <ChevronDown className="w-4 h-4" />
            </span>
            <span className="member-group-name flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-500" />
              Online
            </span>
            <span className="member-group-count">{filteredOnline.length}</span>
          </button>

          {expandedGroups.online && (
            <div className="space-y-1">
              {filteredOnline.length > 0 ? (
                filteredOnline.map(renderMember)
              ) : (
                <p className="text-sm text-slate-500 px-2 py-2">Ninguém online agora.</p>
              )}
            </div>
          )}
        </div>

        {/* Offline Group */}
        <div className="member-group">
          <button
            className="member-group-header"
            onClick={() => toggleGroup('offline')}
            type="button"
          >
            <span className={`member-group-toggle ${expandedGroups.offline ? '' : 'rotate-90'}`}>
              <ChevronDown className="w-4 h-4" />
            </span>
            <span className="member-group-name flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-zinc-500" />
              Offline
            </span>
            <span className="member-group-count">{filteredOffline.length}</span>
          </button>

          {expandedGroups.offline && (
            <div className="space-y-1">
              {filteredOffline.length > 0 ? (
                filteredOffline.map(renderMember)
              ) : (
                <p className="text-sm text-slate-500 px-2 py-2">Todos estão online.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default MemberList;