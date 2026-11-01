import { requireSupabase } from './supabaseClient';

/**
 * Busca ou cria uma conversa direta entre dois usuários sem usar RPC.
 * Usa consultas padrão do Supabase para evitar duplicatas.
 */
export async function getOrCreateConversation(targetUserId: string): Promise<string> {
  if (!targetUserId) throw new Error('Identificador do destinatário inválido.');

  const client = requireSupabase();
  const { data: authResult, error: authError } = await client.auth.getUser();
  if (authError) throw authError;

  const currentUserId = authResult.user?.id;
  if (!currentUserId) throw new Error('Faça login para iniciar uma conversa direta.');
  if (currentUserId === targetUserId) throw new Error('Não é possível iniciar uma conversa consigo mesmo.');

  // 1. Buscar conversas existentes do usuário atual
  const { data: myMemberships, error: myError } = await client
    .from('direct_conversation_members')
    .select('conversation_id')
    .eq('user_id', currentUserId);

  if (myError) throw myError;

  if (myMemberships && myMemberships.length > 0) {
    const conversationIds = myMemberships.map(m => m.conversation_id);

    // 2. Verificar se já existe uma conversa com o targetUserId
    const { data: otherMembers, error: otherError } = await client
      .from('direct_conversation_members')
      .select('conversation_id')
      .in('conversation_id', conversationIds)
      .eq('user_id', targetUserId);

    if (otherError) throw otherError;

    if (otherMembers && otherMembers.length > 0) {
      // Já existe uma conversa entre os dois usuários
      return otherMembers[0].conversation_id;
    }
  }

  // 3. Criar nova conversa
  const { data: newConversation, error: createError } = await client
    .from('direct_conversations')
    .insert({})
    .select('id')
    .single();

  if (createError) throw createError;
  if (!newConversation) throw new Error('Falha ao criar conversa direta.');

  const conversationId = newConversation.id;

  // 4. Adicionar ambos os usuários como membros da conversa
  const { error: memberError } = await client
    .from('direct_conversation_members')
    .insert([
      { conversation_id: conversationId, user_id: currentUserId },
      { conversation_id: conversationId, user_id: targetUserId },
    ]);

  if (memberError) {
    // Rollback: deletar a conversa se falhar ao adicionar membros
    await client.from('direct_conversations').delete().eq('id', conversationId);
    throw memberError;
  }

  return conversationId;
}

/**
 * Envia uma mensagem de convite de comunidade para uma conversa direta existente.
 * Mantido para compatibilidade, mas não deve mais ser usado para convites.
 */
export async function sendCommunityInviteMessage(input: {
  conversationId: string;
  communityId: string;
  communityName: string;
  customMessage: string;
  notificationId: string;
}): Promise<void> {
  const client = requireSupabase();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Faça login para enviar um convite.');

  const content = JSON.stringify({
    type: 'invite_card',
    communityId: input.communityId,
    communityName: input.communityName,
    message: input.customMessage,
    notificationId: input.notificationId,
    system_log: true,
  });
  const { error } = await client.from('direct_messages').insert({
    conversation_id: input.conversationId,
    author_id: user.id,
    content,
  });
  if (error) throw error;
}