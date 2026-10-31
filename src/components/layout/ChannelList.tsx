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
  X
} from 'lucide-react';
import { Channel, User } from '../../types';
import { canAccessAdminPanel } from '../admin/adminAccess';
import { canModerateCommunity } from '../admin/adminAccess';
import { DraggableUserCard, DropZoneCall } from '../call/VoiceDragDrop';
import { formatRelativeTime } from '../../utils/time';

const ChannelListComponent: React.FC<{ onOpenAdmin: () => void; onOpenVoiceChannel: (channel: Channel) => void }> = ({ onOpenAdmin, onOpenVoiceChannel }) => {
  const {
    communities,
    currentCommunityId,
    currentChannelId,
    setCurrentChannelId,
    activeCall,
    toggleMinimizeCall,
    isDirectMessages,
    activeDmId,
    setActiveDmId,
    dms,
    toggleArchiveDm,
    setIsCreateChannelModalOpen,
    isColumn1Collapsed,
    setIsColumn1Collapsed,
    openUserProfile,
    addToast,
    currentUser,
    openDirectMessage,
    moveVoiceUser,
  } = useApp();

  const [collapsedCategories, setCollapsedCategories] = React.useState<Record<string, boolean>>({});
  const [showArchivedDms, setShowArchivedDms] = React.useState(false);
  const [isAddFriendOpen, setIsAddFriendOpen] = React.useState(false);
  const [friendQuery, setFriendQuery] = React.useState('');

  const activeCommunity = communities.find((c) => c.id === currentCommunityId) || communities[0];
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
      onOpenVoiceChannel(channel);
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

  return (
    <aside
      className={`h-full bg-slate-900 border-r border-slate-800/60 flex flex-col transition-all duration-300 select-none ${
        isColumn1Collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {!isDirectMessages && !isColumn1Collapsed && (
        <div className="community-banner-frame" aria-label={`Banner da comunidade ${activeCommunity.name}`}>
          <div className="community-banner-visual">
            {activeCommunity.banner && (
              <img
                src={activeCommunity.banner}
                alt={`Banner de ${activeCommunity.name}`}
                onError={(event) => { event.currentTarget.style.display = 'none'; }}
              />
            )}
          </div>
        </div>
      )}
      {/* Header */}
      <div className="h-14 px-4 border-b border-slate-800/60 flex items-center justify-between">
        {!isColumn1Collapsed ? (
          <>
            <span className="text-sm font-title font-bold text-white truncate">
              {isDirectMessages ? 'Mensagens Diretas' : activeCommunity.name}
            </span>
            <div className="flex items-center gap-1">
              {isDirectMessages && <button onClick={() => setIsAddFriendOpen(true)} title="Adicionar amigo" aria-label="Adicionar amigo" className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors"><UserPlus className="w-4 h-4" /></button>}
              {!isDirectMessages && (
                <button
                  onClick={() => setIsCreateChannelModalOpen(true)}
                  title="Criar novo canal"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsColumn1Collapsed(true)}
                title="Recolher"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={() => setIsColumn1Collapsed(false)}
            title="Expandir"
            className="w-full flex justify-center p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {isColumn1Collapsed ? (
          <div className="flex flex-col items-center gap-2">
            {isDirectMessages
              ? activeDms.map((dm) => (
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
              : visibleChannels.map((chan) => (
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
                ))}
          </div>
        ) : isDirectMessages ? (
          <div className="space-y-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 mb-1.5 flex items-center justify-between">
                <span>Conversas Recentes</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-indigo-400 font-semibold">{activeDms.length}</span>
                </div>
              </div>

              {activeDms.map((dm) => (
                <div
                  key={dm.id}
                  onClick={() => setActiveDmId(dm.id)}
                  className={`group flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all ${
                    activeDmId === dm.id ? 'bg-indigo-600/20 text-white' : 'hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <img src={dm.user.avatar} alt={dm.user.name} className="w-8 h-8 rounded-full object-cover" />
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-slate-900 ${
                      dm.user.status === 'online' ? 'bg-emerald-500' : dm.user.status === 'idle' ? 'bg-amber-500' : 'bg-zinc-400'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate font-semibold">{dm.user.name}</span>
                      <span className="text-[10px] text-slate-500 ml-1 flex-shrink-0">{dm.lastMessageTime ? formatRelativeTime(dm.lastMessageTime) : ''}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{dm.lastMessage}</p>
                  </div>
                  {dm.unread && <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleArchiveDm(dm.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-200 rounded transition-opacity"
                  >
                    <Archive className="w-3 h-3" />
                  </button>
                </div>
              ))}
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
        ) : (
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
                                : <Hash className="w-4 h-4 text-indigo-400/70 flex-shrink-0" />
                              }
                              <span className="text-xs truncate">{channel.name}</span>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              {isVoice && connectedUsers.length > 0 && (
                                <div className="flex items-center -space-x-1.5">
                                  {connectedUsers.map((u) => (
                                    <DraggableUserCard
                                      key={u.id}
                                      user={u}
                                      permission={canMoveUsers}
                                      onOpen={() => openUserProfile(u)}
                                    />
                                  ))}
                                </div>
                              )}
                              {!isVoice && channel.unreadCount && channel.unreadCount > 0 ? (
                                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                              ) : null}
                            </div>
                          </div>
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
      </div>

      {/* Footer */}
      {!isColumn1Collapsed && !isDirectMessages && (
        <div className="p-3 border-t border-slate-800/60 bg-slate-950 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            <span className="font-semibold text-slate-300">{activeCommunity.membersCount}</span> membros
          </div>
          {canAccessAdminPanel(currentCommunityId, currentUser, activeCommunity.ownerId || activeCommunity.creatorId) && <button
            onClick={onOpenAdmin}
            title="Administração da comunidade"
            aria-label="Abrir painel de administração"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>}
        </div>
      )}
      {isAddFriendOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Adicionar amigo" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsAddFriendOpen(false); }}><form onSubmit={addFriend} className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold text-white">Adicionar amigo</h2><button type="button" onClick={() => setIsAddFriendOpen(false)} aria-label="Fechar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" /></button></div><input autoFocus value={friendQuery} onChange={(event) => setFriendQuery(event.target.value)} placeholder="Digite o @usuario ou #1234 para adicionar" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-indigo-500"/><button type="submit" className="mt-3 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">Buscar e iniciar conversa</button><p className="mt-2 text-xs text-slate-500">Busca local entre contatos e usuários de demonstração.</p></form></div>}
    </aside>
  );
};

export const ChannelList = React.memo(ChannelListComponent);



