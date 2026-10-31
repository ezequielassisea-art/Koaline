import { requireSupabase } from './supabaseClient';

/** Gets the existing conversation for the signed-in user and target, or creates one. */
export async function getOrCreateConversation(targetUserId: string): Promise<string> {
  if (!targetUserId) throw new Error('Identificador do destinatário inválido.');

  const client = requireSupabase();
  const { data: authResult, error: authError } = await client.auth.getUser();
  if (authError) throw authError;

  const currentUserId = authResult.user?.id;
  if (!currentUserId) throw new Error('Faça login para iniciar uma conversa direta.');
  if (currentUserId === targetUserId) throw new Error('Não é possível iniciar uma conversa consigo mesmo.');

  const { data: ownMemberships, error: ownMembershipsError } = await client
    .from('direct_conversation_members')
    .select('conversation_id')
    .eq('user_id', currentUserId);
  if (ownMembershipsError) throw ownMembershipsError;

  const conversationIds = (ownMemberships || []).map((membership) => membership.conversation_id).filter(Boolean);
  let normalConversationIds = conversationIds;
  if (conversationIds.length > 0) {
    const { data: conversations, error: conversationsError } = await client
      .from('direct_conversations')
      .select('id,is_system')
      .in('id', conversationIds);
    if (conversationsError) throw conversationsError;
    normalConversationIds = (conversations || []).filter((conversation) => !conversation.is_system).map((conversation) => conversation.id);
  }
  if (normalConversationIds.length > 0) {
    const { data: sharedMemberships, error: sharedMembershipsError } = await client
      .from('direct_conversation_members')
      .select('conversation_id')
      .eq('user_id', targetUserId)
      .in('conversation_id', normalConversationIds)
      .limit(1);
    if (sharedMembershipsError) throw sharedMembershipsError;

    const existingConversationId = sharedMemberships?.[0]?.conversation_id;
    if (existingConversationId) return existingConversationId;
  }

  const { data: conversation, error: conversationError } = await client
    .from('direct_conversations')
    .insert({})
    .select('id')
    .single();
  if (conversationError) throw conversationError;
  if (!conversation?.id) throw new Error('O Supabase não retornou o ID da conversa criada.');

  const { error: membersError } = await client
    .from('direct_conversation_members')
    .insert([
      { conversation_id: conversation.id, user_id: currentUserId },
      { conversation_id: conversation.id, user_id: targetUserId },
    ]);
  if (membersError) throw membersError;

  return conversation.id;
}

export async function createSystemConversation(targetUserId: string): Promise<string> {
  if (!targetUserId) throw new Error('Identificador do destinatário inválido.');
  const client = requireSupabase();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Faça login para criar um chat de convite.');
  if (user.id === targetUserId) throw new Error('Não é possível convidar a própria conta.');

  const { data: conversation, error: conversationError } = await client
    .from('direct_conversations')
    .insert({ is_system: true })
    .select('id')
    .single();
  if (conversationError) throw conversationError;
  if (!conversation?.id) throw new Error('O Supabase não retornou o ID da conversa de sistema.');

  const { error: membersError } = await client.from('direct_conversation_members').insert([
    { conversation_id: conversation.id, user_id: user.id },
    { conversation_id: conversation.id, user_id: targetUserId },
  ]);
  if (membersError) throw membersError;
  return conversation.id;
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
