import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Hash,
  MessageSquare,
  Volume2,
  Users,
  ChevronDown,
  ChevronUp,
  Plus,
  Search,
  Settings,
  Bell,
  Pin,
  MoreHorizontal,
  UserPlus,
  LogOut,
  Moon,
} from 'lucide-react';
import { formatRelativeTime } from '../../utils/time';

const ChannelSidebar: React.FC = () => {
  const {
    currentCommunityId,
    communities,
    currentChannelId,
    setCurrentChannelId,
    isDirectMessages,
    setIsDirectMessages,
    activeDmId,
    setActiveDmId,
    dms,
    currentUser,
    members,
    openDirectMessage,
    createChannel,
    addToast,
    togglePinMessage,
    isContextPanelOpen,
    openMembersPanel,
    closeContextPanel,
    setIsProfileEditorOpen,
    setIsThemeCustomizerOpen,
    setIsLoggedIn,
  } = useApp();

  // Accordion state - controlled by React state
  const [isDmListOpen, setIsDmListOpen] = useState(true);
  const [isChannelsOpen, setIsChannelsOpen] = useState(true);

  // Legacy states for community view
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({ text: true, voice: true });
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<'text' | 'voice'>('text');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const activeCommunity = communities.find((c) => c.id === currentCommunityId);

  // Get categories and channels for current community
  const communityChannels = activeCommunity?.channels || [];
  const textChannels = communityChannels.filter((c) => c.type === 'text');
  const voiceChannels = communityChannels.filter((c) => c.type === 'voice');

  // Get DMs
  const activeDms = dms.filter((dm) => !dm.isArchived);

  // Toggle category expansion (legacy)
  const toggleCategory = (categoryName: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryName]: !prev[categoryName],
    }));
  };

  // Handle channel selection
  const handleChannelSelect = (channelId: string) => {
    setCurrentChannelId(channelId);
    setIsDirectMessages(false);
  };

  // Handle DM selection
  const handleDmSelect = async (dmId: string) => {
    const dm = dms.find((d) => d.id === dmId);
    if (dm) {
      await openDirectMessage(dm.user);
    }
  };

  // Handle create channel
  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim() || !currentCommunityId) return;

    const defaultCategory = activeCommunity?.categories?.[0]?.id || '';

    try {
      await createChannel(
        newChannelName.trim().toLowerCase().replace(/\s+/g, '-'),
        newChannelType,
        defaultCategory
      );
      setNewChannelName('');
      setShowCreateChannel(false);
      addToast('Canal criado', `O canal #${newChannelName.trim()} foi criado.`, 'success');
    } catch (error) {
      addToast('Erro', 'Não foi possível criar o canal.', 'error');
    }
  };

  // Check for unread messages in channel
  const hasUnread = (channelId: string) => {
    return false;
  };

  // Get member count for voice channel
  const getVoiceMemberCount = (channelId: string) => {
    return 0;
  };

  if (!currentCommunityId && !isDirectMessages) {
    return (
      <div className="channel-sidebar flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <div className="max-w-xs">
            <Hash className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <h3 className="text-lg font-semibold text-white mb-2">Nenhuma comunidade selecionada</h3>
            <p className="text-sm text-slate-400">
              Selecione uma comunidade na barra lateral ou vá para Mensagens Diretas.
            </p>
          </div>
        </div>

        {/* Footer - User Profile */}
        <div className="channel-sidebar-footer">
          <div className="user-profile-footer">
            <div className="user-profile-avatar-fallback">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="user-profile-info">
              <div className="user-profile-name">{currentUser.name}</div>
              <div className="user-profile-status">
                <span className={`user-status-indicator ${currentUser.status}`} />
                <span>{currentUser.status === 'online' ? 'Online' : currentUser.status === 'idle' ? 'Ausente' : currentUser.status === 'dnd' ? 'Não perturbe' : 'Offline'}</span>
              </div>
            </div>
            <div className="user-profile-actions">
              <button className="user-profile-btn" onClick={() => setIsProfileEditorOpen(true)} title="Meu Perfil" aria-label="Meu Perfil"><Moon /></button>
              <button className="user-profile-btn" title="Configurações" aria-label="Configurações"><Settings /></button>
              <button className="user-profile-btn" title="Notificações" aria-label="Notificações"><Bell /></button>
              <button className="user-profile-btn text-rose-400 hover:text-rose-300" onClick={() => setIsLoggedIn(false)} title="Sair" aria-label="Sair"><LogOut /></button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isDirectMessages) {
    return (
      <div className="channel-sidebar flex flex-col h-full">
        {/* Header */}
        <div className="channel-sidebar-header">
          <h3>MENSAGENS DIRETAS</h3>
          <button
            className="chat-area-icon-btn"
            onClick={() => setIsDirectMessages(false)}
            title="Voltar às comunidades"
            aria-label="Voltar às comunidades"
          >
            <Hash />
          </button>
        </div>

        {/* Search */}
        <div className="channel-sidebar-tabs" style={{ padding: '8px 12px', gap: '8px' }}>
          <div className="chat-area-search-wrapper" style={{ flex: 1 }}>
            <Search className="w-4 h-4" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--discord-text-muted)' }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar ou iniciar nova conversa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="chat-area-search-input"
              style={{ paddingLeft: '36px', height: '36px', fontSize: '14px' }}
              autoFocus
            />
          </div>
          <button
            className="chat-area-input-btn"
            onClick={() => {}}
            title="Nova mensagem"
            aria-label="Nova mensagem"
          >
            <Plus />
          </button>
        </div>

        {/* DM List - Accordion Style */}
        <div className="channel-list flex-1 overflow-y-auto">
          {/* Conversas PV Section - Accordion */}
          <div className="channel-category">
            <button
              className="channel-category-header w-full"
              onClick={() => setIsDmListOpen(!isDmListOpen)}
              style={{ justifyContent: 'space-between', padding: '8px 12px' }}
            >
              <span className="channel-category-name flex items-center gap-2">
                <span className={`channel-category-toggle ${isDmListOpen ? '' : 'rotate-90'}`}>
                  <ChevronDown className="w-4 h-4" />
                </span>
                <MessageSquare className="w-4 h-4" />
                CONVERSAS PV
                {activeDms.length > 0 && (
                  <span className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded-full">
                    {activeDms.length}
                  </span>
                )}
              </span>
            </button>

            {isDmListOpen && (
              <div className="px-2">
                {activeDms.length === 0 ? (
                  <div className="px-4 py-8 text-center text-slate-500 text-sm">
                    Nenhuma mensagem direta ainda.<br />
                    <span className="text-xs">Clique em + para iniciar uma conversa.</span>
                  </div>
                ) : (
                  activeDms.map((dm) => (
                    <button
                      key={dm.id}
                      onClick={() => handleDmSelect(dm.id)}
                      className={`channel-item ${activeDmId === dm.id ? 'active' : ''}`}
                      title={dm.user?.name || 'Conversa'}
                      aria-label={dm.user?.name || 'Conversa'}
                      aria-pressed={activeDmId === dm.id}
                    >
                      <div className="channel-icon" style={{ width: '36px', height: '36px', borderRadius: '50%', position: 'relative' }}>
                        {dm.user?.avatar ? (
                          <img src={dm.user.avatar} alt={dm.user.name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <div className="w-full h-full rounded-full bg-slate-700 flex items-center justify-center text-white font-bold">
                            {(dm.user?.name || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span
                          className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full ring-2 ring-[var(--discord-bg-secondary)] ${
                            dm.user?.status === 'online' ? 'bg-emerald-500' :
                            dm.user?.status === 'idle' ? 'bg-amber-500' : 'bg-zinc-400'
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="channel-name truncate font-medium">{dm.user?.name || 'Usuário'}</span>
                        </div>
                        <span className="text-xs text-slate-400 truncate">
                          {dm.lastMessage || 'Inicie uma conversa'}
                        </span>
                      </div>
                      {dm.lastMessageTime && (
                        <span className="text-xs text-slate-500 whitespace-nowrap">
                          {formatRelativeTime(dm.lastMessageTime)}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer - User Profile */}
        <div className="channel-sidebar-footer">
          <div className="user-profile-footer">
            <div className="user-profile-avatar-fallback">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="user-profile-info">
              <div className="user-profile-name">{currentUser.name}</div>
              <div className="user-profile-status">
                <span className={`user-status-indicator ${currentUser.status}`} />
                <span>{currentUser.status === 'online' ? 'Online' : currentUser.status === 'idle' ? 'Ausente' : currentUser.status === 'dnd' ? 'Não perturbe' : 'Offline'}</span>
              </div>
            </div>
            <div className="user-profile-actions">
              <button className="user-profile-btn" onClick={() => setIsProfileEditorOpen(true)} title="Meu Perfil" aria-label="Meu Perfil"><Moon /></button>
              <button className="user-profile-btn" title="Configurações" aria-label="Configurações"><Settings /></button>
              <button className="user-profile-btn" title="Notificações" aria-label="Notificações"><Bell /></button>
              <button className="user-profile-btn text-rose-400 hover:text-rose-300" onClick={() => setIsLoggedIn(false)} title="Sair" aria-label="Sair"><LogOut /></button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Community channels view with accordion system
  return (
    <div className="channel-sidebar flex flex-col h-full">
      {/* Header */}
      <div className="channel-sidebar-header">
        <h3>{activeCommunity?.name || 'COMUNIDADE'}</h3>
        <div className="flex items-center gap-2">
          <button
            className="chat-area-icon-btn"
            onClick={() => setIsDirectMessages(true)}
            title="Mensagens Diretas"
            aria-label="Mensagens Diretas"
          >
            <MessageSquare />
          </button>
          <button
            className="chat-area-icon-btn"
            onClick={() => {}}
            title="Configurações da comunidade"
            aria-label="Configurações da comunidade"
          >
            <Settings />
          </button>
        </div>
      </div>

      {/* Channel List - Accordion Style */}
      <div className="channel-list flex-1 overflow-y-auto">
        {/* Canais Section - Accordion */}
        <div className="channel-category">
          <button
            className="channel-category-header w-full"
            onClick={() => setIsChannelsOpen(!isChannelsOpen)}
            style={{ justifyContent: 'space-between', padding: '8px 12px' }}
          >
            <span className="channel-category-name flex items-center gap-2">
              <span className={`channel-category-toggle ${isChannelsOpen ? '' : 'rotate-90'}`}>
                <ChevronDown className="w-4 h-4" />
              </span>
              <Hash className="w-4 h-4" />
              CANAIS
              {(textChannels.length + voiceChannels.length) > 0 && (
                <span className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded-full">
                  {textChannels.length + voiceChannels.length}
                </span>
              )}
            </span>
          </button>

          {isChannelsOpen && (
            <div className="px-2">
              {/* Text Channels Category */}
              {textChannels.length > 0 && (
                <div className="channel-category">
                  <button
                    className="channel-category-header"
                    onClick={() => toggleCategory('text')}
                    style={{ padding: '6px 12px', fontSize: '11px' }}
                  >
                    <span className="channel-category-name flex items-center gap-2">
                      <span className={`channel-category-toggle ${expandedCategories.text ? '' : 'rotate-90'}`}>
                        <ChevronDown className="w-3 h-3" />
                      </span>
                      <Hash className="w-3 h-3" />
                      CANAIS DE TEXTO
                    </span>
                  </button>

                  {expandedCategories.text !== false && (
                    <>
                      {textChannels.map((channel) => (
                        <button
                          key={channel.id}
                          onClick={() => handleChannelSelect(channel.id)}
                          className={`channel-item ${currentChannelId === channel.id ? 'active' : ''} ${hasUnread(channel.id) ? 'unread' : ''}`}
                          title={`#${channel.name}`}
                          aria-label={`#${channel.name}`}
                          aria-pressed={currentChannelId === channel.id}
                        >
                          <span className="channel-drag-handle" aria-label="Arrastar canal">
                            <MoreHorizontal className="w-4 h-4" />
                          </span>
                          <span className="channel-icon">
                            <Hash className="w-4 h-4" />
                          </span>
                          <span className="channel-name">#{channel.name}</span>
                          {hasUnread(channel.id) && <span className="channel-unread-count">9+</span>}
                        </button>
                      ))}

                      {/* Create Channel Button */}
                      {!showCreateChannel && (
                        <button
                          onClick={() => setShowCreateChannel(true)}
                          className="channel-item text-slate-400 hover:text-white justify-center"
                          style={{ padding: '6px 12px' }}
                        >
                          <Plus className="w-4 h-4" />
                          <span className="channel-name">Criar canal</span>
                        </button>
                      )}

                      {showCreateChannel && (
                        <form onSubmit={handleCreateChannel} className="px-2 pb-2">
                          <div className="flex items-center gap-2 mb-2">
                            <select
                              value={newChannelType}
                              onChange={(e) => setNewChannelType(e.target.value as 'text' | 'voice')}
                              className="flex-1 px-2 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded text-white focus:border-indigo-500 focus:outline-none"
                            >
                              <option value="text"><Hash className="w-3 h-3 mr-1" /> Texto</option>
                              <option value="voice"><Volume2 className="w-3 h-3 mr-1" /> Voz</option>
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newChannelName}
                              onChange={(e) => setNewChannelName(e.target.value)}
                              placeholder="nome-do-canal"
                              className="flex-1 px-2 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded text-white focus:border-indigo-500 focus:outline-none"
                              autoFocus
                            />
                            <button
                              type="submit"
                              className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded"
                            >
                              Criar
                            </button>
                            <button
                              type="button"
                              onClick={() => { setShowCreateChannel(false); setNewChannelName(''); }}
                              className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded"
                            >
                              Cancelar
                            </button>
                          </div>
                        </form>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Voice Channels Category */}
              {voiceChannels.length > 0 && (
                <div className="channel-category">
                  <button
                    className="channel-category-header"
                    onClick={() => toggleCategory('voice')}
                    style={{ padding: '6px 12px', fontSize: '11px' }}
                  >
                    <span className="channel-category-name flex items-center gap-2">
                      <span className={`channel-category-toggle ${expandedCategories.voice ? '' : 'rotate-90'}`}>
                        <ChevronDown className="w-3 h-3" />
                      </span>
                      <Volume2 className="w-3 h-3" />
                      CANAIS DE VOZ
                    </span>
                  </button>

                  {expandedCategories.voice !== false && (
                    <>
                      {voiceChannels.map((channel) => {
                        const memberCount = getVoiceMemberCount(channel.id);
                        return (
                          <button
                            key={channel.id}
                            onClick={() => handleChannelSelect(channel.id)}
                            className={`channel-item ${currentChannelId === channel.id ? 'active' : ''}`}
                            title={`🔊 ${channel.name}`}
                            aria-label={`Canal de voz: ${channel.name}`}
                            aria-pressed={currentChannelId === channel.id}
                          >
                            <span className="channel-drag-handle" aria-label="Arrastar canal">
                              <MoreHorizontal className="w-4 h-4" />
                            </span>
                            <span className="channel-icon">
                              <Volume2 className="w-4 h-4" />
                            </span>
                            <span className="channel-name flex-1">#{channel.name}</span>
                            {memberCount > 0 && (
                              <span className="voice-status-badge">
                                <Users className="w-3 h-3" />
                                {memberCount}
                              </span>
                            )}
                          </button>
                        );
                      })}

                      {!showCreateChannel && (
                        <button
                          onClick={() => { setNewChannelType('voice'); setShowCreateChannel(true); }}
                          className="channel-item text-slate-400 hover:text-white justify-center"
                          style={{ padding: '6px 12px' }}
                        >
                          <Plus className="w-4 h-4" />
                          <span className="channel-name">Criar canal</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer - User Profile */}
      <div className="channel-sidebar-footer">
        <div className="user-profile-footer">
          {currentUser.avatar ? (
            <img src={currentUser.avatar} alt={currentUser.name} className="user-profile-avatar" />
          ) : (
            <div className="user-profile-avatar-fallback">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="user-profile-info">
            <div className="user-profile-name">{currentUser.name}</div>
            <div className="user-profile-status">
              <span className={`user-status-indicator ${currentUser.status}`} />
              <span>{currentUser.status === 'online' ? 'Online' : currentUser.status === 'idle' ? 'Ausente' : currentUser.status === 'dnd' ? 'Não perturbe' : 'Offline'}</span>
            </div>
          </div>
          <div className="user-profile-actions">
            <button
              className="user-profile-btn"
              onClick={() => isContextPanelOpen ? closeContextPanel() : openMembersPanel()}
              title={isContextPanelOpen ? 'Fechar painel de membros' : 'Abrir painel de membros'}
              aria-label={isContextPanelOpen ? 'Fechar painel de membros' : 'Abrir painel de membros'}
            >
              <Users />
            </button>
            <button className="user-profile-btn" onClick={() => setIsProfileEditorOpen(true)} title="Meu Perfil" aria-label="Meu Perfil"><Moon /></button>
            <button className="user-profile-btn" title="Configurações" aria-label="Configurações"><Settings /></button>
            <button className="user-profile-btn" title="Notificações" aria-label="Notificações"><Bell /></button>
            <button className="user-profile-btn text-rose-400 hover:text-rose-300" onClick={() => setIsLoggedIn(false)} title="Sair" aria-label="Sair"><LogOut /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChannelSidebar;