import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Phone,
  Video,
  MessageSquare,
  ExternalLink,
  Edit3,
  Palette,
  Award,
  Users,
  Plus,
  Loader2,
} from 'lucide-react';

export const ContextPanel: React.FC = () => {
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
  } = useApp();

  const user = contextPanelUser || currentUser;
  const isSelf = user.id === currentUser.id;

  const memberMap = new Map<string, typeof currentUser>();
  [currentUser, ...dms.filter((dm) => !dm.isArchived).map((dm) => dm.user)].forEach((member) => {
    if (member.id) memberMap.set(member.id, member);
  });
  const panelMembers = [...memberMap.values()];
  const onlineMembers = panelMembers.filter((member) => member.status === 'online');
  const offlineMembers = panelMembers.filter((member) => member.status !== 'online');

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
    const renderMember = (member: typeof currentUser) => (
      <button key={member.id} className="member-roster-person" onClick={() => openUserProfile(member)}>
        {member.avatar ? <img className="member-roster-avatar" src={member.avatar} alt="" /> : <span className="member-roster-avatar member-roster-fallback">{member.name.trim().charAt(0).toUpperCase() || '◇'}</span>}
        <span className="member-roster-copy"><strong>{member.name || 'Membro'}</strong><small>@{member.handle || 'koaline'}</small></span>
        <span className={'member-roster-status ' + (member.status === 'online' ? 'is-online' : 'is-offline')} aria-label={member.status === 'online' ? 'Online' : 'Offline'} />
      </button>
    );

    return (
      <aside className="member-roster-panel h-full bg-slate-900 border-l border-border flex flex-col z-20 overflow-y-auto animate-in slide-in-from-right duration-200 select-none">
        <header className="member-roster-header">
          <div><h2><Users /> Membros</h2><p>{panelMembers.length} {panelMembers.length === 1 ? 'membro ou amigo' : 'membros e amigos'}</p></div>
          <button className="member-roster-invite" onClick={handleInviteClick} title="Copiar um convite ativo" aria-label="Copiar convite ativo"><Plus /></button>
          <button className="member-roster-close" onClick={closeContextPanel} title="Fechar painel" aria-label="Fechar painel"><X /></button>
        </header>
        <div className="member-roster-groups">
          <section>
            <h3><span className="member-roster-status is-online" /> Online <small>{onlineMembers.length}</small></h3>
            {onlineMembers.map(renderMember)}
            {onlineMembers.length === 0 && <p className="member-roster-empty">Ninguém online agora.</p>}
          </section>
          <section>
            <h3><span className="member-roster-status is-offline" /> Offline <small>{offlineMembers.length}</small></h3>
            {offlineMembers.map(renderMember)}
            {offlineMembers.length === 0 && <p className="member-roster-empty">Todos estão online.</p>}
          </section>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="w-72 sm:w-80 h-full bg-slate-900 border-l border-border flex flex-col z-20 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200 select-none"
    >
      {/* Top Banner with Close button */}
      <div className="relative h-28 context-banner-gradient flex-shrink-0">
        {user.banner && (
          <img
            src={user.banner}
            alt="Banner"
            className="w-full h-full object-cover opacity-80"
          />
        )}
        <button
          onClick={closeContextPanel}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors "
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Avatar & Quick Stats */}
      <div className="px-5 pb-5 -mt-12 flex-1">
        <div className="flex items-end justify-between mb-3">
          <div className="relative">
            {user.avatar ? <img src={user.avatar} alt={user.name} className="w-20 h-20 rounded-full object-cover ring-4 ring-slate-900 shadow-xl" /> : <div aria-label={user.name || 'Avatar padrão'} className="w-20 h-20 rounded-full bg-slate-700 ring-4 ring-slate-900 shadow-xl grid place-items-center text-xl text-white">{user.name.trim().charAt(0).toUpperCase() || '◇'}</div>}
            <span
              className={`status-presence absolute bottom-1 right-1 w-4 h-4 rounded-full ring-2 ring-slate-900 ${
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
            <h3 className="font-title font-bold text-base text-white truncate">
              {user.name}
            </h3>
            {user.pronouns && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium">
                {user.pronouns}
              </span>
            )}
          </div>
          <div className="context-user-handle">@{user.handle}</div>

          {user.customStatus && (
            <div className="mt-2.5 p-2 rounded-nest-sm bg-slate-950 border border-slate-800 flex items-center gap-2 text-xs">
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
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-nest-pill bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md transition-all"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editar Perfil</span>
            </button>
            <button
              onClick={() => setIsThemeCustomizerOpen(true)}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-nest-pill bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition-all"
            >
              <Palette className="w-3.5 h-3.5 text-sky-400" />
              <span>Tema</span>
            </button>
          </div>
        ) : (
          <button
            disabled={isDmLoading}
            onClick={async () => {
              if (await openDirectMessage(user)) closeContextPanel();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-nest-pill bg-indigo-600 hover:bg-indigo-500 disabled:opacity-70 disabled:cursor-wait text-white font-medium text-xs shadow-lg shadow-indigo-600/30 mb-5 transition-all"
          >
            {isDmLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
            <span>{isDmLoading ? 'Carregando conversa…' : 'Enviar Mensagem Direta'}</span>
          </button>
        )}

        {/* Level & XP */}
        <div className="p-3 rounded-nest-sm bg-slate-950 border border-slate-800 mb-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-slate-200 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-indigo-400" /> Nível {user.level}
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
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-nest-pill bg-slate-800 text-xs border border-slate-700/80 hover:border-indigo-500/50 transition-colors cursor-help"
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
                    className="flex items-center justify-between p-2 rounded-nest-sm bg-slate-950 hover:bg-slate-800 text-xs text-slate-200 transition-colors border border-slate-800"
                  >
                    <span>{social.platform}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </a>
                ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};


