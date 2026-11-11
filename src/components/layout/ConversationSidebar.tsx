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
  User,
} from 'lucide-react';
import { formatRelativeTime } from '../../utils/time';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const ConversationSidebar: React.FC = () => {
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
      <div className="chat-sidebar flex flex-col h-full">
        <div className="chat-sidebar-header">
          <h3 className="chat-sidebar-title">Conversas</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <div className="max-w-xs">
            <Hash className="w-12 h-12 mx-auto mb-4 text-text-muted" />
            <h3 className="text-lg font-semibold text-text-main mb-2">Nenhuma comunidade selecionada</h3>
            <p className="text-sm text-text-muted">
              Selecione uma comunidade na barra lateral ou vá para Mensagens Diretas.
            </p>
          </div>
        </div>

        {/* Footer - User Profile */}
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
              <AvatarFallback>{currentUser.name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-text-main truncate">{currentUser.name}</div>
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <span className="w-2 h-2 rounded-full bg-success" />
                <span>{currentUser.status === 'online' ? 'Online' : currentUser.status === 'idle' ? 'Ausente' : currentUser.status === 'dnd' ? 'Não perturbe' : 'Offline'}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => setIsProfileEditorOpen(true)} title="Meu Perfil" aria-label="Meu Perfil"><Settings className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" title="Configurações" aria-label="Configurações"><Bell className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" className="text-rose-400 hover:text-rose-500 hover:bg-rose-50" onClick={() => setIsLoggedIn(false)} title="Sair" aria-label="Sair"><LogOut className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isDirectMessages) {
    return (
      <div className="chat-sidebar flex flex-col h-full">
        {/* Header */}
        <div className="chat-sidebar-header">
          <h3 className="chat-sidebar-title">MENSAGENS DIRETAS</h3>
          <button
            className="p-2 rounded-lg text-text-muted hover:text-text-main hover:bg-bg-hover transition-colors"
            onClick={() => setIsDirectMessages(false)}
            title="Voltar às comunidades"
            aria-label="Voltar às comunidades"
          >
            <Hash className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="chat-sidebar-search">
          <div className="chat-sidebar-search-wrapper">
            <Search className="w-4 h-4" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar ou iniciar nova conversa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="chat-sidebar-search-input"
              autoFocus
            />
          </div>
        </div>

        {/* DM List - Accordion Style */}
        <div className="chat-sidebar-conversations">
          {/* Conversas PV Section - Accordion */}
          <div className="mb-2">
            <button
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left"
              onClick={() => setIsDmListOpen(!isDmListOpen)}
            >
              <span className="flex items-center gap-2">
                <span className={`transition-transform ${isDmListOpen ? '' : '-rotate-90'}`}>
                  <ChevronDown className="w-4 h-4 text-text-muted" />
                </span>
                <MessageSquare className="w-4 h-4 text-text-muted" />
                <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Conversas PV</span>
                {activeDms.length > 0 && (
                  <span className="text-xs bg-bg-hover text-text-muted px-2 py-0.5 rounded-full">
                    {activeDms.length}
                  </span>
                )}
              </span>
            </button>

            {isDmListOpen && (
              <div className="mt-1 space-y-1">
                {activeDms.length === 0 ? (
                  <div className="px-4 py-6 text-center text-text-muted text-sm">
                    Nenhuma mensagem direta ainda.<br />
                    <span className="text-xs">Clique no + para iniciar uma conversa.</span>
                  </div>
                ) : (
                  activeDms.map((dm) => (
                    <button
                      key={dm.id}
                      onClick={() => handleDmSelect(dm.id)}
                      className={`chat-conversation-item ${
                        activeDmId === dm.id ? 'active' : ''
                      }`}
                      title={dm.user?.name || 'Conversa'}
                      aria-label={dm.user?.name || 'Conversa'}
                      aria-pressed={activeDmId === dm.id}
                    >
                      <div className="chat-conversation-avatar">
                        <Avatar className="w-full h-full">
                          <AvatarImage src={dm.user?.avatar} alt={dm.user?.name} />
                          <AvatarFallback className="text-sm font-bold">{(dm.user?.name || '?').charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span
                          className={`chat-conversation-status ${
                            dm.user?.status === 'online' ? 'online' :
                            dm.user?.status === 'idle' ? 'idle' : 'offline'
                          }`}
                        />
                      </div>
                      <div className="chat-conversation-info">
                        <div className="chat-conversation-header">
                          <span className="chat-conversation-name">{dm.user?.name || 'Usuário'}</span>
                          {dm.lastMessageTime && (
                            <span className="chat-conversation-time">
                              {formatRelativeTime(dm.lastMessageTime)}
                            </span>
                          )}
                        </div>
                        <span className="chat-conversation-preview">
                          {dm.lastMessage || 'Inicie uma conversa'}
                        </span>
                      </div>
                      {dm.unread && <span className="chat-conversation-unread" />}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer - User Profile */}
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
              <AvatarFallback>{currentUser.name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-text-main truncate">{currentUser.name}</div>
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <span className="w-2 h-2 rounded-full bg-success" />
                <span>{currentUser.status === 'online' ? 'Online' : currentUser.status === 'idle' ? 'Ausente' : currentUser.status === 'dnd' ? 'Não perturbe' : 'Offline'}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => setIsProfileEditorOpen(true)} title="Meu Perfil" aria-label="Meu Perfil"><User className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" title="Configurações" aria-label="Configurações"><Settings className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" title="Notificações" aria-label="Notificações"><Bell className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" className="text-rose-400 hover:text-rose-500 hover:bg-rose-50" onClick={() => setIsLoggedIn(false)} title="Sair" aria-label="Sair"><LogOut className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Community channels view with accordion system
  return (
    <div className="chat-sidebar flex flex-col h-full">
      {/* Header */}
      <div className="chat-sidebar-header">
        <h3 className="chat-sidebar-title truncate">{activeCommunity?.name || 'COMUNIDADE'}</h3>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setIsDirectMessages(true)} title="Mensagens Diretas" aria-label="Mensagens Diretas"><MessageSquare className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => {}} title="Configurações da comunidade" aria-label="Configurações da comunidade"><Settings className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* Search */}
      <div className="chat-sidebar-search">
        <div className="chat-sidebar-search-wrapper">
          <Search className="w-4 h-4" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Buscar canais..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="chat-sidebar-search-input"
          />
        </div>
      </div>

      {/* Channel List - Accordion Style */}
      <div className="chat-sidebar-conversations">
        {/* Canais Section - Accordion */}
        <div className="mb-2">
          <button
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left"
            onClick={() => setIsChannelsOpen(!isChannelsOpen)}
          >
            <span className="flex items-center gap-2">
              <span className={`transition-transform ${isChannelsOpen ? '' : '-rotate-90'}`}>
                <ChevronDown className="w-4 h-4 text-text-muted" />
              </span>
              <Hash className="w-4 h-4 text-text-muted" />
              <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Canais</span>
              {(textChannels.length + voiceChannels.length) > 0 && (
                <span className="text-xs bg-bg-hover text-text-muted px-2 py-0.5 rounded-full">
                  {textChannels.length + voiceChannels.length}
                </span>
              )}
            </span>
          </button>

          {isChannelsOpen && (
            <div className="mt-1 space-y-1">
              {/* Text Channels Category */}
              {textChannels.length > 0 && (
                <div className="mb-3">
                  <button
                    className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left"
                    onClick={() => toggleCategory('text')}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`transition-transform ${expandedCategories.text ? '' : '-rotate-90'}`}>
                        <ChevronDown className="w-3 h-3 text-text-muted" />
                      </span>
                      <Hash className="w-3 h-3 text-text-muted" />
                      <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Canais de Texto</span>
                    </span>
                  </button>

                  {expandedCategories.text !== false && (
                    <>
                      {textChannels.map((channel) => (
                        <button
                          key={channel.id}
                          onClick={() => handleChannelSelect(channel.id)}
                          className={`chat-conversation-item ${
                            currentChannelId === channel.id ? 'active' : ''
                          }`}
                          title={`#${channel.name}`}
                          aria-label={`#${channel.name}`}
                          aria-pressed={currentChannelId === channel.id}
                        >
                          <div className="chat-conversation-avatar">
                            <div className="w-full h-full rounded-full bg-primary-light flex items-center justify-center">
                              <Hash className={`w-5 h-5 ${currentChannelId === channel.id ? 'text-primary' : 'text-text-muted'}`} />
                            </div>
                          </div>
                          <div className="chat-conversation-info">
                            <span className="chat-conversation-name">#{channel.name}</span>
                          </div>
                          {hasUnread(channel.id) && <span className="chat-conversation-unread" />}
                        </button>
                      ))}

                      {/* Create Channel Button */}
                      {!showCreateChannel && (
                        <button
                          onClick={() => setShowCreateChannel(true)}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-text-muted hover:text-text-main hover:bg-bg-hover transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          <span className="font-medium">Criar canal</span>
                        </button>
                      )}

                      {showCreateChannel && (
                        <form onSubmit={handleCreateChannel} className="p-2 space-y-2">
                          <select
                            value={newChannelType}
                            onChange={(e) => setNewChannelType(e.target.value as 'text' | 'voice')}
                            className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text-main focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            <option value="text">Texto</option>
                            <option value="voice">Voz</option>
                          </select>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newChannelName}
                              onChange={(e) => setNewChannelName(e.target.value)}
                              placeholder="nome-do-canal"
                              className="flex-1 px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text-main focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                              autoFocus
                            />
                            <button
                              type="submit"
                              className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover text-white rounded-lg"
                            >
                              Criar
                            </button>
                            <button
                              type="button"
                              onClick={() => { setShowCreateChannel(false); setNewChannelName(''); }}
                              className="px-4 py-2 text-sm bg-bg-hover hover:bg-bg-active text-text-main rounded-lg"
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
                <div className="mb-3">
                  <button
                    className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left"
                    onClick={() => toggleCategory('voice')}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`transition-transform ${expandedCategories.voice ? '' : '-rotate-90'}`}>
                        <ChevronDown className="w-3 h-3 text-text-muted" />
                      </span>
                      <Volume2 className="w-3 h-3 text-text-muted" />
                      <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Canais de Voz</span>
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
                            className={`chat-conversation-item ${
                              currentChannelId === channel.id ? 'active' : ''
                            }`}
                            title={`🔊 ${channel.name}`}
                            aria-label={`Canal de voz: ${channel.name}`}
                            aria-pressed={currentChannelId === channel.id}
                          >
                            <div className="chat-conversation-avatar">
                              <div className="w-full h-full rounded-full bg-primary-light flex items-center justify-center">
                                <Volume2 className={`w-5 h-5 ${currentChannelId === channel.id ? 'text-primary' : 'text-text-muted'}`} />
                              </div>
                            </div>
                            <div className="chat-conversation-info">
                              <span className="chat-conversation-name flex-1">#{channel.name}</span>
                            </div>
                            {memberCount > 0 && (
                              <span className="flex items-center gap-1 text-xs text-text-muted bg-bg-hover px-2 py-0.5 rounded-full">
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
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-text-muted hover:text-text-main hover:bg-bg-hover transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          <span className="font-medium">Criar canal</span>
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
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
            <AvatarFallback>{currentUser.name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-text-main truncate">{currentUser.name}</div>
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <span className="w-2 h-2 rounded-full bg-success" />
              <span>{currentUser.status === 'online' ? 'Online' : currentUser.status === 'idle' ? 'Ausente' : currentUser.status === 'dnd' ? 'Não perturbe' : 'Offline'}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => isContextPanelOpen ? closeContextPanel() : openMembersPanel()} title={isContextPanelOpen ? 'Fechar painel de membros' : 'Abrir painel de membros'} aria-label={isContextPanelOpen ? 'Fechar painel de membros' : 'Abrir painel de membros'}><Users className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => setIsProfileEditorOpen(true)} title="Meu Perfil" aria-label="Meu Perfil"><User className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" title="Configurações" aria-label="Configurações"><Settings className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" title="Notificações" aria-label="Notificações"><Bell className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" className="text-rose-400 hover:text-rose-500 hover:bg-rose-50" onClick={() => setIsLoggedIn(false)} title="Sair" aria-label="Sair"><LogOut className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConversationSidebar;