import { requireSupabase } from './supabaseClient';

/** Uses the database RPC so concurrent requests cannot create duplicate conversations. */
export async function getOrCreateConversation(targetUserId: string): Promise<string> {
  if (!targetUserId) throw new Error('Identificador do destinatário inválido.');

  const client = requireSupabase();
  const { data: authResult, error: authError } = await client.auth.getUser();
  if (authError) throw authError;

  const currentUserId = authResult.user?.id;
  if (!currentUserId) throw new Error('Faça login para iniciar uma conversa direta.');
  if (currentUserId === targetUserId) throw new Error('Não é possível iniciar uma conversa consigo mesmo.');

  const { data: conversationId, error } = await client.rpc('get_or_create_direct_conversation', {
    p_other_user: targetUserId,
  });
  if (error) throw error;
  if (typeof conversationId !== 'string' || !conversationId) {
    throw new Error('O Supabase não retornou o ID da conversa direta.');
  }
  return conversationId;
}

export async function createSystemConversation(targetUserId: string): Promise<string> {
  if (!targetUserId) throw new Error('Identificador do destinatário inválido.');
  const client = requireSupabase();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Faça login para criar um chat de convite.');
  if (user.id === targetUserId) throw new Error('Não é possível convidar a própria conta.');

  // Use the existing RPC to atomically get or create the conversation (prevents duplicates)
  const { data: conversationId, error: rpcError } = await client.rpc('get_or_create_direct_conversation', {
    p_other_user: targetUserId,
  });
  if (rpcError) throw rpcError;
  if (!conversationId) throw new Error('O Supabase não retornou o ID da conversa direta.');

  // Update the conversation to mark it as a system conversation
  const { error: updateError } = await client
    .from('direct_conversations')
    .update({ is_system: true })
    .eq('id', conversationId);
  if (updateError) throw updateError;

  return conversationId;
}

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
