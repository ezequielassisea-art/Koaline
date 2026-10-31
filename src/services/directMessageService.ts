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
  if (conversationIds.length > 0) {
    const { data: sharedMemberships, error: sharedMembershipsError } = await client
      .from('direct_conversation_members')
      .select('conversation_id')
      .eq('user_id', targetUserId)
      .in('conversation_id', conversationIds)
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
