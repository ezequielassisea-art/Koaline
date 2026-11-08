import React from 'react';
import { useApp } from '../../context/AppContext';
import { Plus, Hash, MessageSquare, Users, Settings, ChevronDown, ChevronUp } from 'lucide-react';

const ServerRail: React.FC = () => {
  const {
    communities,
    currentCommunityId,
    setCurrentCommunityId,
    isDirectMessages,
    setIsDirectMessages,
    createCommunity,
    addToast,
  } = useApp();

  const handleCreateCommunity = async () => {
    const name = window.prompt('Nome da nova comunidade:');
    if (name?.trim()) {
      try {
        await createCommunity({ name: name.trim(), visibility: 'public' });
      } catch (error) {
        addToast('Erro', 'Não foi possível criar a comunidade.', 'error');
      }
    }
  };

  const handleSelectCommunity = (communityId: string) => {
    setCurrentCommunityId(communityId);
    setIsDirectMessages(false);
  };

  const handleDirectMessages = () => {
    setIsDirectMessages(true);
    setCurrentCommunityId('');
  };

  const handleSettings = () => {
    // TODO: Open settings
  };

  return (
    <nav className="server-rail" role="navigation" aria-label="Comunidades e mensagens diretas">
      {/* Direct Messages Button */}
      <button
        onClick={handleDirectMessages}
        className={`server-rail-item ${isDirectMessages && !currentCommunityId ? 'active' : ''}`}
        title="Mensagens Diretas"
        aria-label="Mensagens Diretas"
        aria-pressed={isDirectMessages && !currentCommunityId}
      >
        <MessageSquare />
      </button>

      {/* Community List */}
      <div className="flex-1 overflow-y-auto">
        {communities.map((community) => (
          <button
            key={community.id}
            onClick={() => handleSelectCommunity(community.id)}
            className={`server-rail-item ${currentCommunityId === community.id ? 'active' : ''}`}
            title={community.name}
            aria-label={community.name}
            aria-pressed={currentCommunityId === community.id}
          >
            {community.icon ? (
              <img
                src={community.icon}
                alt={community.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <div className="w-full h-full rounded-full flex items-center justify-center bg-slate-700 text-white font-bold text-lg">
                {community.name.charAt(0).toUpperCase()}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Add Community Button */}
      <button
        onClick={handleCreateCommunity}
        className="server-rail-add"
        title="Criar ou entrar em uma comunidade"
        aria-label="Criar ou entrar em uma comunidade"
      >
        <Plus />
      </button>

      {/* Bottom: User Settings */}
      <div className="flex-shrink-0 p-2 border-t border-[var(--discord-border)]">
        <button
          onClick={handleSettings}
          className="server-rail-item mx-auto"
          title="Configurações do usuário"
          aria-label="Configurações do usuário"
        >
          <Settings />
        </button>
      </div>
    </nav>
  );
};

export default ServerRail;