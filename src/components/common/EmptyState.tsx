import React from 'react';
import { MessageSquare, Users, Volume2, ShieldAlert, Sparkles, AlertCircle } from 'lucide-react';

interface EmptyStateProps {
  type?: 'channels' | 'messages' | 'voice-empty' | 'dms' | 'bio' | 'offline';
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'messages',
  title,
  description,
  actionText,
  onAction,
  className = '',
}) => {
  const getDefaults = () => {
    switch (type) {
      case 'channels':
        return {
          icon: Users,
          defaultTitle: 'Crie seu primeiro canal',
          defaultDesc: 'Organize conversas por tópicos, projetos ou equipes.',
          defaultAction: 'Criar Canal',
        };
      case 'messages':
        return {
          icon: MessageSquare,
          defaultTitle: 'Nenhuma mensagem recente',
          defaultDesc: 'Este canal está limpo e pronto. Inicie a conversa enviando uma mensagem!',
          defaultAction: 'Escrever mensagem',
        };
      case 'voice-empty':
        return {
          icon: Volume2,
          defaultTitle: 'Sala de voz vazia',
          defaultDesc: 'O canal de voz está ativo e aguardando participantes.',
          defaultAction: 'Convidar pessoas',
        };
      case 'dms':
        return {
          icon: MessageSquare,
          defaultTitle: 'Suas conversas diretas',
          defaultDesc: 'Inicie uma conversa privada, envie arquivos ou faça chamadas diretas.',
          defaultAction: 'Nova conversa',
        };
      case 'bio':
        return {
          icon: Sparkles,
          defaultTitle: 'Biografia vazia',
          defaultDesc: 'Conte um pouco sobre sua carreira, interesses e o que você faz.',
          defaultAction: 'Editar Perfil',
        };
      case 'offline':
        return {
          icon: AlertCircle,
          defaultTitle: 'Sem conexão de rede',
          defaultDesc: 'Verifique sua conexão com a internet e tente novamente.',
          defaultAction: 'Reconectar',
        };
    }
  };

  const defaults = getDefaults();
  const IconComponent = defaults.icon;

  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 max-w-sm mx-auto select-none ${className}`}>
      <div className="mb-4 p-4 rounded-2xl bg-surface-elevated border border-border shadow-inner text-primary">
        <IconComponent className="w-10 h-10" />
      </div>
      <h3 className="text-base font-title font-bold text-text-main mb-1">
        {title || defaults.defaultTitle}
      </h3>
      <p className="text-xs text-text-muted mb-6 leading-relaxed">
        {description || defaults.defaultDesc}
      </p>
      {(actionText || defaults.defaultAction) && (
        <button
          onClick={onAction}
          className="px-5 py-2 rounded-nest-pill bg-primary hover:bg-primary-hover text-white font-medium text-xs shadow-nest hover:shadow-glow-primary transition-all active:scale-95"
        >
          {actionText || defaults.defaultAction}
        </button>
      )}
    </div>
  );
};


