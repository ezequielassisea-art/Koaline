import React from 'react';
import { useApp } from '../../context/AppContext';
import { Plus, Hash, MessageSquare, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

  return (
    <nav className="h-full flex flex-col overflow-hidden py-4 gap-3 items-center" role="navigation" aria-label="Comunidades e mensagens diretas">
      {/* Direct Messages Button */}
      <Button
        onClick={handleDirectMessages}
        variant="ghost"
        size="icon"
        className={`server-rail-item ${isDirectMessages && !currentCommunityId ? 'active' : ''}`}
        title="Mensagens Diretas"
        aria-label="Mensagens Diretas"
        aria-pressed={isDirectMessages && !currentCommunityId}
      >
        <MessageSquare className="w-5 h-5" />
      </Button>

      {/* Community List */}
      <div className="flex-1 overflow-y-auto w-full flex flex-col items-center gap-3 min-h-0">
        {communities.map((community) => (
          <Button
            key={community.id}
            onClick={() => handleSelectCommunity(community.id)}
            variant="ghost"
            size="icon"
            className={`server-rail-item ${currentCommunityId === community.id ? 'active' : ''}`}
            title={community.name}
            aria-label={community.name}
            aria-pressed={currentCommunityId === community.id}
          >
            {community.icon ? (
              <div className="w-10 h-10 flex-shrink-0 rounded-full overflow-hidden">
                <img
                  src={community.icon}
                  alt={community.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center bg-slate-700 text-white font-bold text-lg">
                {community.name.charAt(0).toUpperCase()}
              </div>
            )}
          </Button>
        ))}
      </div>

      {/* Add Community Button */}
      <Button
        onClick={handleCreateCommunity}
        variant="ghost"
        size="icon"
        className="server-rail-add flex-shrink-0"
        title="Criar ou entrar em uma comunidade"
        aria-label="Criar ou entrar em uma comunidade"
      >
        <Plus className="w-5 h-5" />
      </Button>
    </nav>
  );
};

export default ServerRail;