import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { MessageItem } from './MessageItem';
import { MessageInput } from './MessageInput';
import { ChatHeader } from './ChatHeader';
import { EmptyState } from '../common/EmptyState';
import { Message, User } from '../../types';
import { Calendar, Loader2 } from 'lucide-react';
import { formatDateHeading, isSameLocalDay, parseAppDate } from '../../utils/time';
import { supabase } from '../../services/supabaseClient';

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

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
  const [localDmMessages, setLocalDmMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Garante que o objeto da conversa (conversation) não seja null antes de acessar conversation.id
  const conversation = dms.find((d) => d && d.id === activeDmId) || null;
  const conversationId = conversation ? conversation.id : (activeDmId || null);

  useLayoutEffect(() => {
    setLocalDmMessages([]);
    setLoadingMessages(true);
  }, [activeDmId]);

  // 1. CARREGAMENTO DE DMs (SUPABASE):
  // Ao abrir a tela de DM, busca as mensagens diretamente da tabela direct_messages
  useEffect(() => {
    if (!conversationId || !supabase) {
      setLocalDmMessages([]);
      setLoadingMessages(false);
      return;
    }
    setLocalDmMessages([]);
    setLoadingMessages(true);
    const client = supabase;

    let active = true;
    setLoadingMessages(true);

    const fetchDirectMessages = async () => {
      try {
        let data: any = null;
        let error: any = null;

        // Tenta buscar com relação de profiles
        try {
          const joinRes = await client
            .from('direct_messages')
            .select('*, author:profiles!direct_messages_author_id_fkey(username, avatar_url)')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

          if (!joinRes.error && joinRes.data) {
            data = joinRes.data;
          } else {
            error = joinRes.error;
          }
        } catch {
          // fallback
        }

        // Se a query com join falhar, faz busca direta e manual de profiles
        if (!data) {
          const simpleRes = await client
            .from('direct_messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

          data = simpleRes.data;
          error = simpleRes.error;
        }

        if (!active) return;
        if (error) {
          return;
        }

        const rows = data || [];
        const authorIds = [...new Set(rows.map((r: any) => r.author_id || r.sender_id).filter(Boolean))];

        const profileMap = new Map<string, { username?: string | null; avatar_url?: string | null }>();
        if (authorIds.length > 0) {
          const { data: profs } = await client.from('profiles').select('id, username, avatar_url').in('id', authorIds);
          (profs || []).forEach((p) => profileMap.set(p.id, p));
        }

        if (!active) return;
        const loaded: Message[] = rows.map((r: any) => {
          const authorId = r.author_id || r.sender_id || '';
          const prof = r.author || profileMap.get(authorId);
          const isMe = authorId === currentUser.id;
          const authorName = (prof?.username && !isUuid(prof.username))
            ? prof.username
            : isMe
            ? currentUser.name
            : 'Membro Koaline';

          const senderUser: User = isMe
            ? currentUser
            : {
                ...currentUser,
                id: authorId,
                name: authorName,
                handle: prof?.username || 'koaline',
                avatar: prof?.avatar_url || '',
                status: 'online',
              };

          return {
            id: r.id,
            channelId: conversationId,
            senderId: authorId,
            sender: senderUser,
            content: r.content,
            timestamp: r.created_at,
            reactions: [],
          };
        });

        setLocalDmMessages((previous) => {
          const merged = new Map(loaded.map((message) => [message.id, message]));
          previous.forEach((message) => merged.set(message.id, message));
          return Array.from(merged.values()).sort(
            (a, b) => parseAppDate(a.timestamp).getTime() - parseAppDate(b.timestamp).getTime()
          );
        });
      } catch {
        // Silencioso
      } finally {
        if (active) setLoadingMessages(false);
      }
    };

    void fetchDirectMessages();

    // 2. TEMPO REAL NAS DMs (SUPABASE REALTIME):
    // Inscrição Realtime para a tabela direct_messages sem tocar no localStorage
    const dmChannel = client
      .channel(`direct_messages_view:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const row = payload.new as any;
        if (!active || !row?.id) return;

        void (async () => {
          const authorId = row.author_id || row.sender_id || '';
          let prof: any = null;
          if (authorId) {
            const { data: p } = await client.from('profiles').select('username, avatar_url').eq('id', authorId).maybeSingle();
            prof = p;
          }

          if (!active) return;
          const isMe = authorId === currentUser.id;
          const authorName = (prof?.username && !isUuid(prof.username))
            ? prof.username
            : isMe
            ? currentUser.name
            : 'Membro Koaline';

          const senderUser: User = isMe
            ? currentUser
            : {
                ...currentUser,
                id: authorId,
                name: authorName,
                handle: prof?.username || 'koaline',
                avatar: prof?.avatar_url || '',
                status: 'online',
              };

          const newMsg: Message = {
            id: row.id,
            channelId: conversationId,
            senderId: authorId,
            sender: senderUser,
            content: row.content,
            timestamp: row.created_at,
            reactions: [],
          };

          // Adiciona ao estado do React
          setLocalDmMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        })();
      })
      .subscribe();

    return () => {
      active = false;
      void client.removeChannel(dmChannel);
    };
  }, [conversationId, activeDmId, currentUser.id]);

  useEffect(() => {
    if (conversationId) {
      markChannelRead(conversationId);
    }
  }, [conversationId]);

  // Certifique-se de que a lista de mensagens está sendo inicializada como um array vazio []
  const contextMsgs = (conversationId && Array.isArray(messages[conversationId])) ? messages[conversationId] : [];
  const mergedMap = new Map<string, Message>();
  localDmMessages.filter((message) => message.channelId === conversationId).forEach((m) => mergedMap.set(m.id, m));
  contextMsgs.forEach((m) => mergedMap.set(m.id, m));
  const messagesList: Message[] = Array.from(mergedMap.values()).sort(
    (a, b) => parseAppDate(a.timestamp).getTime() - parseAppDate(b.timestamp).getTime()
  );

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
  if ((isDmLoading || loadingMessages) && messagesList.length === 0) {
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
              title={conversation?.user?.name ? `Conversa com @${conversation.user.name}` : 'Início da conversa'}
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

      <MessageInput replyTarget={replyTarget} onClearReply={() => setReplyTarget(null)} />
    </div>
  );
};
