import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Hash,
  Volume2,
  ChevronRight,
  ChevronDown,
  Plus,
  Settings,
  Archive,
  ChevronLeft,
  UserPlus,
  X,
  MicOff,
  MessageSquare,
  Users,
  Cog,
  LayoutDashboard,
} from 'lucide-react';
import { Channel, User, UserStatus } from '../../types';
import { canAccessAdminPanel } from '../admin/adminAccess';
import { canModerateCommunity } from '../admin/adminAccess';
import { DraggableUserCard, DropZoneCall } from '../call/VoiceDragDrop';
import { formatRelativeTime } from '../../utils/time';
import { supabase } from '../../services/supabaseClient';

type SidebarTab = 'canais' | 'dms';

const ChannelListComponent: React.FC<{ onOpenAdmin: () => void; isCollapsed: boolean }> = ({ onOpenAdmin, isCollapsed }) => {
  const {
    communities,
    currentCommunityId,
    setCurrentCommunityId,
    currentChannelId,
    setCurrentChannelId,
    activeCall,
    toggleMinimizeCall,
    activeDmId,
    setActiveDmId,
    dms,
    toggleArchiveDm,
    setIsCreateChannelModalOpen,
    openUserProfile,
    addToast,
    currentUser,
    openDirectMessage,
    moveVoiceUser,
    syncVoiceParticipants,
    startCall,
    voicePresence,
  } = useApp();

  const [collapsedCategories, setCollapsedCategories] = React.useState<Record<string, boolean>>({});
  const [showArchivedDms, setShowArchivedDms] = React.useState(false);
  const [isAddFriendOpen, setIsAddFriendOpen] = React.useState(false);
  const [friendQuery, setFriendQuery] = React.useState('');
  const [clockNow, setClockNow] = React.useState(Date.now());
  const [activeSidebarTab, setActiveSidebarTab] = React.useState<SidebarTab>('canais');
  const [userSearchResults, setUserSearchResults] = React.useState<User[]>([]);
  const [userSearchLoading, setUserSearchLoading] = React.useState(false);
  const cleanUserQuery = friendQuery.trim().replace(/^@/, '').trim();

  React.useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    if (!isAddFriendOpen || !supabase || cleanUserQuery.length < 2) { setUserSearchResults([]); return; }
    const client = supabase;
    let active = true;
    setUserSearchLoading(true);
    const timer = window.setTimeout(async () => {
      const { data, error } = await client.from('profiles')
        .select('id, username, avatar_url, full_name')
        .ilike('username', `%${cleanUserQuery}%`)
        .limit(5);
      if (!active) return;
      type ProfileRow = { id: string; username: string | null; avatar_url: string | null; full_name: string | null };
      setUserSearchResults(error ? [] : (data || []).filter((profile: ProfileRow) => profile.username).map((profile: ProfileRow) => ({
        ...currentUser,
        id: profile.id,
        name: profile.full_name || profile.username || 'Membro Koaline',
        handle: profile.username || '',
        avatar: profile.avatar_url || '',
        status: 'offline' as const,
      })).filter((user: User) => user.id !== currentUser.id));
      setUserSearchLoading(false);
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [isAddFriendOpen, cleanUserQuery, currentUser.id]);

  const activeCommunity = communities.find((c) => c.id === currentCommunityId) || communities[0];
  const voiceChannels = activeCommunity?.channels.filter((channel) => channel.type === 'voice') || [];

  // Sync global voice presence to community channels
  React.useEffect(() => {
    if (!activeCommunity || !voicePresence[activeCommunity.id]?.length) return;
    const voiceUsers = voicePresence[activeCommunity.id];
    if (!voiceUsers.length) return;

    const usersByChannel = new Map<string, typeof voiceUsers>();
    voiceUsers.forEach((user) => {
      const channelId = user.channel_id;
      if (!channelId) return;
      if (!usersByChannel.has(channelId)) usersByChannel.set(channelId, []);
      usersByChannel.get(channelId)!.push(user);
    });

    usersByChannel.forEach((users, channelId) => {
      const userList = users.map((entry) => ({
        ...currentUser,
        id: entry.user_id,
        name: entry.full_name || entry.username || 'Membro Koaline',
        handle: entry.username || '',
        avatar: entry.avatar_url || '',
        status: (entry.status === 'idle' || entry.status === 'dnd' ? entry.status : 'online') as UserStatus,
        voiceMuted: !!entry.muted,
      }));
      const joinTimes = users.map((entry) => entry.joined_at).filter((value): value is number => Number.isFinite(value));
      syncVoiceParticipants(channelId, userList, joinTimes.length ? Math.min(...joinTimes) : undefined);
    });
  }, [activeCommunity?.id, voicePresence, currentUser, syncVoiceParticipants]);

  if (!activeCommunity) return null;

  let archivedChannelIds = new Set<string>();
  try { archivedChannelIds = new Set<string>(JSON.parse(localStorage.getItem(`koaline:admin:${currentCommunityId}`) || '{}').archived || []); }
  catch { archivedChannelIds = new Set<string>(); }
  const visibleChannels = activeCommunity.channels.filter((channel) => !archivedChannelIds.has(channel.id));
  const canMoveUsers = canModerateCommunity(activeCommunity.id, currentUser, activeCommunity.ownerId || activeCommunity.creatorId);

  const toggleCategory = (catId: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  const handleChannelClick = (channel: Channel) => {
    if (channel.type === 'voice') {
      startCall(channel, 'voice');
    } else {
      setCurrentChannelId(channel.id);
      if (activeCall && !activeCall.isMinimized) toggleMinimizeCall();
    }
  };

  const activeDms = dms.filter((d) => !d.isArchived);
  const archivedDms = dms.filter((d) => d.isArchived);

  const addFriend = (event: React.FormEvent) => {
    event.preventDefault();
    const query = friendQuery.trim().replace(/^[@#]/, '').toLowerCase();
    const result = userSearchResults.find((user) => user.handle.toLowerCase() === query);
    if (result) {
      openDirectMessage(result);
      setFriendQuery('');
      setIsAddFriendOpen(false);
      return;
    }
    const candidates: Array<{ user: User; tag?: string }> = [
      ...dms.map((dm) => ({ user: dm.user, tag: dm.user.handle.match(/#(\d+)$/)?.[1] })),
      ...activeCommunity.channels.flatMap((channel) => (channel.connectedUsers || []).map((user) => ({ user, tag: user.handle.match(/#(\d+)$/)?.[1] }))),
      { user: { ...currentUser, id: 'mock-user-marina', name: 'Marina Costa', handle: 'marina', avatar: 'https://api.dicebear.com/9.x/initials/svg?seed=Marina%20Costa' }, tag: '1234' },
      { user: { ...currentUser, id: 'mock-user-caio', name: 'Caio Nunes', handle: 'caio', avatar: 'https://api.dicebear.com/9.x/initials/svg?seed=Caio%20Nunes' }, tag: '5678' },
    ];
    const match = candidates.find(({ user, tag }) => user.id !== currentUser.id && (
      user.handle.replace(/^@/, '').toLowerCase() === query || user.handle.toLowerCase().endsWith(`#${query}`) || tag === query
    ));
    if (!match) { addToast('Usuário não encontrado', 'Confira o @usuário ou a #tag e tente novamente.', 'warning'); return; }
    openDirectMessage(match.user);
    setFriendQuery('');
    setIsAddFriendOpen(false);
  };

  // Collapsed mode: show only icons in a compact vertical bar
  if (isCollapsed) {
    return (
      <aside className="h-full bg-slate-900 border-r border-slate-800/60 flex flex-col transition-all duration-300 select-none w-16">
        {/* Community selector (collapsed) */}
        <div className="h-14 px-2 border-b border-slate-800/60 flex items-center justify-center">
          <button
            onClick={() => setIsAddFriendOpen(true)}
            title="Adicionar amigo"
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs (collapsed) */}
        <div className="px-2 py-1 flex flex-col items-center gap-1 border-b border-slate-800/60">
          <button
            onClick={() => setActiveSidebarTab('canais')}
            title="Canais"
            className={`p-1.5 rounded-lg transition-colors ${activeSidebarTab === 'canais' ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <Hash className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveSidebarTab('dms')}
            title="Mensagens Diretas"
            className={`p-1.5 rounded-lg transition-colors ${activeSidebarTab === 'dms' ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>

        {/* Content (collapsed) */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {activeSidebarTab === 'canais' ? (
            visibleChannels.map((chan) => (
              <button
                key={chan.id}
                onClick={() => handleChannelClick(chan)}
                title={chan.name}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                  currentChannelId === chan.id ? 'bg-indigo-600/25 text-indigo-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {chan.type === 'voice' ? <Volume2 className="w-4 h-4 text-sky-400" /> : <Hash className="w-4 h-4" />}
              </button>
            ))
          ) : (
            activeDms.map((dm) => (
              <button
                key={dm.id}
                onClick={() => setActiveDmId(dm.id)}
                title={dm.user.name}
                className={`relative p-1 rounded-full transition-all ${activeDmId === dm.id ? 'ring-2 ring-indigo-500' : 'hover:scale-105'}`}
              >
                <img src={dm.user.avatar} alt={dm.user.name} className="w-8 h-8 rounded-full object-cover" />
                {dm.unread && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-indigo-500 rounded-full ring-2 ring-slate-900" />}
              </button>
            ))
          )}
        </div>

        {/* Footer: User profile (collapsed) */}
        <div className="p-2 border-t border-slate-800/60 bg-slate-950 flex items-center justify-center">
          <button
            onClick={() => openUserProfile(currentUser)}
            title={currentUser.name}
            className="relative p-1 rounded-full hover:bg-slate-800 transition-colors"
          >
            <img src={currentUser.avatar} alt={currentUser.name} className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-700" />
            <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-slate-900 ${
              currentUser.status === 'online' ? 'bg-emerald-500' :
              currentUser.status === 'idle' ? 'bg-amber-500' :
              currentUser.status === 'dnd' ? 'bg-rose-500' : 'bg-zinc-400'
            }`} />
          </button>
        </div>

        {isAddFriendOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Adicionar amigo" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsAddFriendOpen(false); }}>
            <form onSubmit={addFriend} className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-white">Adicionar amigo</h2>
                <button type="button" onClick={() => setIsAddFriendOpen(false)} aria-label="Fechar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <input autoFocus value={friendQuery} onChange={(event) => setFriendQuery(event.target.value)} placeholder="Digite o @usuario ou #1234 para adicionar" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-indigo-500"/>
              {friendQuery.trim() && (
                <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950">
                  {userSearchLoading ? (
                    <p className="px-3 py-2 text-xs text-slate-400">Buscando usuários…</p>
                  ) : userSearchResults.map((user) => (
                    <button key={user.id} type="button" onClick={() => { void openDirectMessage(user); setFriendQuery(''); setIsAddFriendOpen(false); }} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-800">
                      <img src={user.avatar || `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(user.name)}`} alt="" className="h-8 w-8 rounded-full object-cover"/>
                      <span className="min-w-0"><strong className="block truncate text-sm text-white">{user.name}</strong><small className="text-xs text-slate-400">@{user.handle}</small></span>
                    </button>
                  ))}
                  {!userSearchLoading && cleanUserQuery.length >= 2 && userSearchResults.length === 0 && (
                    <p className="px-3 py-2 text-xs text-slate-500">Nenhum usuário encontrado.</p>
                  )}
                </div>
              )}
              <button type="submit" className="mt-3 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">Buscar e iniciar conversa</button>
              <p className="mt-2 text-xs text-slate-500">Busca local entre contatos e usuários de demonstração.</p>
            </form>
          </div>
        )}
      </aside>
    );
  }

  // Expanded mode: Full 3-section layout
  return (
    <aside className="h-full bg-slate-900 border-r border-slate-800/60 flex flex-col transition-all duration-300 select-none w-64">
      {/* ========================================
         SEÇÃO 1 - TOPO: Comunidades + Canais
         ======================================== */}
      <div className="flex flex-col border-b border-slate-800/60 bg-slate-950/50">
        {/* Community Selector */}
        <div className="h-14 px-3 border-b border-slate-800/40 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              onClick={() => setIsAddFriendOpen(true)}
              title="Adicionar amigo"
              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors flex-shrink-0"
              aria-label="Adicionar amigo"
            >
              <UserPlus className="w-4 h-4" />
            </button>
            <select
              value={currentCommunityId}
              onChange={(e) => setCurrentCommunityId(e.target.value)}
              className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-indigo-500 appearance-none cursor-pointer min-w-0"
              aria-label="Selecionar comunidade"
            >
              {communities.map((comm) => (
                <option key={comm.id} value={comm.id}>{comm.name}</option>
              ))}
            </select>
          </div>
          {activeSidebarTab === 'canais' && (
            <button
              onClick={() => setIsCreateChannelModalOpen(true)}
              title="Criar novo canal"
              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Tabs: Canais / Mensagens Diretas */}
        <div className="flex px-2 py-1 border-b border-slate-800/40 bg-slate-900/30">
          <button
            onClick={() => setActiveSidebarTab('canais')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeSidebarTab === 'canais'
                ? 'bg-indigo-600/20 text-indigo-400'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Hash className="w-3.5 h-3.5" />
            <span>Canais</span>
          </button>
          <button
            onClick={() => setActiveSidebarTab('dms')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeSidebarTab === 'dms'
                ? 'bg-indigo-600/20 text-indigo-400'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>DMs</span>
            {activeDms.length > 0 && <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">{activeDms.length}</span>}
          </button>
        </div>
      </div>

      {/* ========================================
         SEÇÃO 2 - MEIO: Conteúdo (Canais ou DMs)
         ======================================== */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4 min-h-0">
        {/* --- ABA: CANAIS --- */}
        {activeSidebarTab === 'canais' && (
          <div className="space-y-4">
            {activeCommunity.categories.map((cat) => {
              const catChannels = visibleChannels.filter((c) => c.categoryId === cat.id);
              const isCollapsed = collapsedCategories[cat.id];
              return (
                <div key={cat.id}>
                  <button
                    onClick={() => toggleCategory(cat.id)}
                    className="w-full flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-200 transition-colors"
                  >
                    {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    <span className="truncate">{cat.name}</span>
                    <span className="ml-auto text-[11px] font-bold text-slate-300">{catChannels.length}</span>
                  </button>

                  {!isCollapsed && (
                    <div className="mt-1 space-y-0.5">
                      {catChannels.map((channel) => {
                        const isVoice = channel.type === 'voice';
                        const isSelected = currentChannelId === channel.id && !isVoice;
                        const connectedUsers = (channel.connectedUsers || []).filter((user) => (user.id || '').trim() && ((user.avatar || '').trim() || (user.name || '').trim() || (user.handle || '').trim()));
                        const totalSeconds = channel.voiceStartedAt ? Math.max(0, Math.floor((clockNow - channel.voiceStartedAt) / 1000)) : 0;
                        const channelElapsed = totalSeconds >= 3600
                          ? `${String(Math.floor(totalSeconds / 3600)).padStart(2, '0')}:${String(Math.floor(totalSeconds / 60) % 60).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`
                          : `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;
                        return (
                          <DropZoneCall key={channel.id} callId={channel.id} permission={isVoice && canMoveUsers} onMove={(userId, callId) => {
                            if (!moveVoiceUser(userId, callId)) addToast('Movimentação negada', 'Apenas moderadores e administradores podem mover pessoas entre chamadas.', 'warning');
                          }}>
                          <div
                            onClick={() => handleChannelClick(channel)}
                            className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-all ${
                              isSelected ? 'bg-indigo-600/20 text-white font-semibold' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate min-w-0">
                              {isVoice
                                ? <Volume2 className="w-4 h-4 text-sky-400 flex-shrink-0" />
                                : <Hash className="w-4 h-4 text-indigo-400/70 flex-shrink-0" />}
                              <span className="text-xs truncate">{channel.name}</span>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              {isVoice && connectedUsers.length > 0 && (
                                <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">{channelElapsed}</span>
                              )}
                              {!isVoice && channel.unreadCount && channel.unreadCount > 0 ? (
                                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                              ) : null}
                            </div>
                          </div>
                          {isVoice && connectedUsers.length > 0 && <div className="space-y-0.5 pb-1 pl-9 pr-2" onClick={(event) => event.stopPropagation()}>
                            {connectedUsers.map((u) => (
                              <div key={u.id} className="group/member flex min-w-0 items-center gap-3 rounded-md px-1.5 py-1 transition-colors hover:bg-slate-800/70" title={u.name}>
                                <button type="button" onClick={() => openUserProfile(u)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                                  <div className="relative flex-shrink-0">
                                    {u.avatar ? (
                                      <img src={u.avatar} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
                                    ) : (
                                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[10px] text-slate-200">{u.name?.trim().charAt(0).toUpperCase() || '◇'}</span>
                                    )}
                                    <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-slate-900 ${
                                      u.status === 'online' ? 'bg-emerald-500' : u.status === 'idle' ? 'bg-amber-500' : u.status === 'dnd' ? 'bg-rose-500' : 'bg-zinc-400'
                                    }`} />
                                  </div>
                                  <div className="flex flex-col gap-0.5 min-w-0">
                                    <span className="truncate font-semibold text-slate-100 text-[11px]">{u.name || u.handle || 'Membro Koaline'}</span>
                                    <span className="truncate text-[10px] text-slate-400">@{u.handle || 'usuario'}</span>
                                  </div>
                                </button>
                                {u.voiceMuted && <MicOff className="h-3.5 w-3.5 shrink-0 text-rose-400/80" aria-label="Microfone mutado" />}
                                <DraggableUserCard user={u} permission={canMoveUsers} onOpen={() => openUserProfile(u)} />
                              </div>
                            ))}
                          </div>}
                          </DropZoneCall>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* --- ABA: MENSAGENS DIRETAS --- */}
        {activeSidebarTab === 'dms' && (
          <div className="space-y-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 mb-1.5 flex items-center justify-between">
                <span>Conversas Recentes</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-indigo-400 font-semibold">{activeDms.length}</span>
                </div>
              </div>

              {activeDms.length === 0 ? (
                <div className="px-2 py-6 text-center text-slate-500">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">Nenhuma conversa ainda</p>
                  <button onClick={() => setIsAddFriendOpen(true)} className="mt-2 text-xs text-indigo-400 hover:underline">Adicionar amigo</button>
                </div>
              ) : (
                activeDms.map((dm) => (
                  <div
                    key={dm.id}
                    onClick={() => setActiveDmId(dm.id)}
                    className={`group flex items-center gap-3 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all ${
                      activeDmId === dm.id ? 'bg-indigo-600/20' : 'hover:bg-slate-800'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <img src={dm.user.avatar} alt={dm.user.name} className="w-8 h-8 rounded-full object-cover" />
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-slate-900 ${
                        dm.user.status === 'online' ? 'bg-emerald-500' : dm.user.status === 'idle' ? 'bg-amber-500' : 'bg-zinc-400'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center justify-between">
                          <span className="truncate font-semibold text-slate-100">{dm.user.name}</span>
                          <span className="text-[10px] text-slate-400 ml-1 flex-shrink-0">{dm.lastMessageTime ? formatRelativeTime(dm.lastMessageTime) : ''}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">@{dm.user.handle}</p>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{dm.lastMessage}</p>
                      </div>
                    </div>
                    {dm.unread && <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleArchiveDm(dm.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-white rounded transition-opacity"
                    >
                      <Archive className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {archivedDms.length > 0 && (
              <div className="pt-2 border-t border-slate-800">
                <button
                  onClick={() => setShowArchivedDms(!showArchivedDms)}
                  className="w-full flex items-center justify-between px-2 py-1 text-xs text-slate-400 hover:text-slate-200"
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    <Archive className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Arquivadas ({archivedDms.length})</span>
                  </div>
                  {showArchivedDms ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
                {showArchivedDms && archivedDms.map((dm) => (
                  <div
                    key={dm.id}
                    onClick={() => setActiveDmId(dm.id)}
                    className="group flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-800 cursor-pointer text-xs text-slate-400"
                  >
                    <span className="truncate">{dm.user.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleArchiveDm(dm.id); }}
                      className="text-[10px] text-indigo-400 hover:underline opacity-0 group-hover:opacity-100"
                    >
                      Desarquivar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================
         SEÇÃO 3 - RODAPÉ: Perfil do Usuário (FIXO)
         ======================================== */}
      <div className="flex-shrink-0 border-t border-slate-800/60 bg-slate-950/80 backdrop-blur-sm">
        <div className="p-3">
          <button
            onClick={() => openUserProfile(currentUser)}
            className="w-full flex items-center gap-3 px-1 py-1.5 rounded-xl hover:bg-slate-800/50 transition-all text-left focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            aria-label="Abrir configurações do perfil"
          >
            {/* Avatar with status */}
            <div className="relative flex-shrink-0">
              {currentUser.avatar ? (
                <img src={currentUser.avatar} alt={currentUser.name} className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-700" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-slate-700 ring-1 ring-slate-700 grid place-items-center text-sm font-bold text-white">
                  {currentUser.name.trim().charAt(0).toUpperCase() || '◇'}
                </div>
              )}
              <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-slate-900 ${
                currentUser.status === 'online' ? 'bg-emerald-500' :
                currentUser.status === 'idle' ? 'bg-amber-500' :
                currentUser.status === 'dnd' ? 'bg-rose-500' : 'bg-zinc-400'
              }`} aria-label={`Status: ${currentUser.status}`} />
            </div>

            {/* Name & Handle */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <span className="truncate font-semibold text-sm text-white">{currentUser.name}</span>
              <span className="truncate text-[11px] text-slate-400">@{currentUser.handle}</span>
            </div>

            {/* Settings icon */}
            <button
              onClick={(e) => { e.stopPropagation(); openUserProfile(currentUser); }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors flex-shrink-0"
              aria-label="Configurações"
            >
              <Cog className="w-4 h-4" />
            </button>
          </button>
        </div>
      </div>

      {/* Add Friend Modal */}
      {isAddFriendOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Adicionar amigo" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsAddFriendOpen(false); }}>
          <form onSubmit={addFriend} className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Adicionar amigo</h2>
              <button type="button" onClick={() => setIsAddFriendOpen(false)} aria-label="Fechar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <input autoFocus value={friendQuery} onChange={(event) => setFriendQuery(event.target.value)} placeholder="Digite o @usuario ou #1234 para adicionar" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-indigo-500"/>
            {friendQuery.trim() && (
              <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950">
                {userSearchLoading ? (
                  <p className="px-3 py-2 text-xs text-slate-400">Buscando usuários…</p>
                ) : userSearchResults.map((user) => (
                  <button key={user.id} type="button" onClick={() => { void openDirectMessage(user); setFriendQuery(''); setIsAddFriendOpen(false); }} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-800">
                    <img src={user.avatar || `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(user.name)}`} alt="" className="h-8 w-8 rounded-full object-cover"/>
                    <span className="min-w-0"><strong className="block truncate text-sm text-white">{user.name}</strong><small className="text-xs text-slate-400">@{user.handle}</small></span>
                  </button>
                ))}
                {!userSearchLoading && cleanUserQuery.length >= 2 && userSearchResults.length === 0 && (
                  <p className="px-3 py-2 text-xs text-slate-500">Nenhum usuário encontrado.</p>
                )}
              </div>
            )}
            <button type="submit" className="mt-3 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">Buscar e iniciar conversa</button>
            <p className="mt-2 text-xs text-slate-500">Busca local entre contatos e usuários de demonstração.</p>
          </form>
        </div>
      )}
    </aside>
  );
};

export const ChannelList = React.memo(ChannelListComponent);