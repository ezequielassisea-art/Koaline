import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { MessageItem } from './MessageItem';
import { MessageInput } from './MessageInput';
import { ChatHeader } from './ChatHeader';
import { EmptyState } from '../common/EmptyState';
import { Message } from '../../types';
import { Calendar, Loader2 } from 'lucide-react';
import { formatDateHeading, isSameLocalDay, parseAppDate } from '../../utils/time';

export const DirectMessageView: React.FC = () => {
  const {
    messages,
    activeDmId,
    dms,
    isDmLoading,
    currentUser,
    markChannelRead,
    lastReadAtByChannel,
    isTyping,
    typingUser,
    sendMessage,
  } = useApp();

  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Garante que o objeto da conversa (conversation) não seja null antes de acessar conversation.id
  const conversation = dms.find((d) => d && d.id === activeDmId) || null;
  const conversationId = conversation ? conversation.id : (activeDmId || null);

  // Certifique-se de que a lista de mensagens está sendo inicializada como um array vazio []
  const messagesList: Message[] = (conversationId && Array.isArray(messages[conversationId]))
    ? messages[conversationId]
    : [];

  useEffect(() => {
    if (conversationId) {
      markChannelRead(conversationId);
    }
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesList.length, isTyping]);

  const lastReadAt = conversationId ? lastReadAtByChannel[conversationId] : undefined;
  const firstUnreadId = messagesList.find(
    (message) =>
      message &&
      message.senderId !== currentUser.id &&
      (!lastReadAt || parseAppDate(message.timestamp).getTime() > parseAppDate(lastReadAt).getTime())
  )?.id;

  // Exibe um estado de "Carregando..." enquanto a conversa é criada/buscada no Supabase
  if (isDmLoading && !conversation) {
    return (
      <div className="flex-1 flex flex-col h-full bg-surface-sunken relative min-w-0">
        <ChatHeader onToggleSearch={() => {}} isSearching={false} />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <p className="text-sm">Carregando conversa direta…</p>
        </div>
      </div>
    );
  }

  // Se a conversa for nula e não tiver DM ativa selecionada
  if (!conversation && !conversationId) {
    return (
      <div className="flex-1 flex flex-col h-full bg-surface-sunken relative min-w-0">
        <ChatHeader onToggleSearch={() => {}} isSearching={false} />
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <EmptyState
            type="dms"
            title="Nenhuma conversa selecionada"
            description="Selecione um amigo na barra lateral ou clique em Mensagem Direta para conversar."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-sunken relative min-w-0">
      <ChatHeader onToggleSearch={() => {}} isSearching={false} />

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-2 py-4">
        {messagesList.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState
              type="dms"
              title={conversation ? `Conversa com @${conversation.user.name}` : 'Início da conversa'}
              description="Envie uma mensagem para começar este bate-papo privado."
              onAction={() => sendMessage('Olá! 👋')}
              actionText="Dizer Olá"
            />
          </div>
        ) : (
          <>
            {/* Ao fazer o .map() das mensagens, use optional chaining (messages?.map(...)) */}
            {messagesList?.map((msg, index) => {
              if (!msg) return null;
              const previousMessage = messagesList[index - 1];
              const startsNewDay =
                !previousMessage ||
                !isSameLocalDay(previousMessage.timestamp, msg.timestamp);
              const elapsedMinutes = previousMessage
                ? (parseAppDate(msg.timestamp).getTime() -
                    parseAppDate(previousMessage.timestamp).getTime()) /
                  60_000
                : Number.POSITIVE_INFINITY;
              const isGrouped =
                !!previousMessage &&
                !previousMessage.isDeleted &&
                !msg.isDeleted &&
                previousMessage.senderId === msg.senderId &&
                elapsedMinutes >= 0 &&
                elapsedMinutes <= 5;

              return (
                <React.Fragment key={msg.id || `msg-${index}`}>
                  {startsNewDay && (
                    <div className="flex items-center justify-center mb-4 mt-2">
                      <div className="h-px bg-slate-800 flex-1" />
                      <div className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-indigo-400" />
                        <span>{formatDateHeading(msg.timestamp)}</span>
                      </div>
                      <div className="h-px bg-slate-800 flex-1" />
                    </div>
                  )}
                  {msg.id === firstUnreadId && (
                    <div className="unread-divider">
                      <span>Não lidas</span>
                    </div>
                  )}
                  <MessageItem
                    message={msg}
                    isGrouped={isGrouped}
                    isUnread={
                      !!lastReadAt &&
                      msg.senderId !== currentUser.id &&
                      parseAppDate(msg.timestamp).getTime() >
                        parseAppDate(lastReadAt).getTime()
                    }
                    timeLabel={new Intl.DateTimeFormat('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(parseAppDate(msg.timestamp))}
                    onReply={(target) => setReplyTarget(target)}
                  />
                </React.Fragment>
              );
            })}
          </>
        )}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex items-center gap-2 px-4 py-2 text-xs text-slate-400 animate-in fade-in">
            <span className="font-semibold text-indigo-400">
              {typingUser || 'Alguém'}
            </span>
            <span>está digitando</span>
            <span className="flex gap-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" />
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput
        replyTarget={replyTarget}
        onClearReply={() => setReplyTarget(null)}
      />
    </div>
  );
};
