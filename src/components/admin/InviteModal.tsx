import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle, XCircle, Users, Crown } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';

// Same type as in TopBar.tsx
type CommunityInviteNotification = {
  id: string;
  sender_id: string;
  user_id: string;
  type: string;
  payload: {
    community_id: string;
    community_name: string;
    inviter_id: string;
    inviter_name: string;
    custom_message: string;
    community_icon?: string;
    community_banner?: string;
  };
  read_at: string | null;
  created_at: string
};

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  invite: CommunityInviteNotification | null;
}

export const InviteModal: React.FC<InviteModalProps> = ({ isOpen, onClose, invite }) => {
  const { currentUser, addToast, communities } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen || !invite) return null;

  const payload = invite.payload;

  const handleAccept = async () => {
    if (!supabase || !currentUser || isProcessing) return;
    setIsProcessing(true);
    try {
      // Aceitar o convite: adicionar usuário à comunidade
      const { error: joinError } = await supabase.rpc('join_orbit_community', {
        p_community_id: payload.community_id,
      });
      if (joinError) throw joinError;

      // Marcar notificação como lida
      await supabase.from('notifications').update({ read_at: new Date().toISOString() })
        .eq('id', invite.id).eq('user_id', currentUser.id);

      addToast('Convite aceito!', `Você entrou em ${payload.community_name}.`, 'success');

      // Fechar modal
      onClose();

      // Redirecionar para a comunidade - recarregar a página para atualizar o estado
      window.location.href = '/';
      window.dispatchEvent(new Event('popstate'));
    } catch (error) {
      addToast('Erro ao aceitar', error instanceof Error ? error.message : 'Tente novamente.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!supabase || !currentUser || isProcessing) return;
    setIsProcessing(true);
    try {
      // Apenas marcar notificação como lida (recusar)
      await supabase.from('notifications').update({ read_at: new Date().toISOString() })
        .eq('id', invite.id).eq('user_id', currentUser.id);

      addToast('Convite recusado', `Você recusou o convite para ${payload.community_name}.`, 'info');
      onClose();
    } catch (error) {
      addToast('Erro ao recusar', error instanceof Error ? error.message : 'Tente novamente.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Fechar ao pressionar ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="invite-modal-title">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950/95 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Banner Background */}
        {payload.community_banner && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30"
            style={{ backgroundImage: `url(${payload.community_banner})` }}
            aria-hidden="true"
          />
        )}

        <div className="relative p-6">
          {/* Close Button */}
          <button
            className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            onClick={onClose}
            aria-label="Fechar"
          >
            <XCircle className="w-5 h-5" />
          </button>

          {/* Community Header */}
          <div className="flex items-center gap-4 mb-6 relative">
            {/* Community Avatar/Icon */}
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-xl border-2 border-white/20 overflow-hidden bg-slate-800 flex items-center justify-center shadow-xl">
                {payload.community_icon && payload.community_icon.startsWith('data:') ? (
                  <img src={payload.community_icon} alt="" className="w-full h-full object-cover" />
                ) : payload.community_icon && !payload.community_icon.startsWith('data:') ? (
                  <span className="text-4xl font-bold text-indigo-400">{payload.community_icon}</span>
                ) : (
                  <Crown className="w-10 h-10 text-indigo-400" />
                )}
              </div>
            </div>

            {/* Community Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <h2 id="invite-modal-title" className="text-xl font-bold text-white truncate">
                  Convite da comunidade {payload.community_name}
                </h2>
              </div>
              <p className="mt-1 text-sm text-slate-400">
                {payload.inviter_name} convidou você para participar
              </p>
            </div>
          </div>

          {/* Custom Message */}
          <div className="mb-6 p-4 rounded-xl border border-slate-700/50 bg-slate-900/50">
            <p className="text-sm font-medium text-slate-300 mb-2">Mensagem personalizada:</p>
            <p className="text-slate-100 whitespace-pre-wrap">{payload.custom_message || 'Sem mensagem personalizada.'}</p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleReject}
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-rose-500/50 text-rose-400 font-semibold hover:bg-rose-500/10 hover:border-rose-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Recusar convite"
            >
              <XCircle className="w-5 h-5" />
              Recusar
            </button>
            <button
              onClick={handleAccept}
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Aceitar convite"
            >
              <CheckCircle className="w-5 h-5" />
              {isProcessing ? 'Entrando...' : 'Aceitar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};