import { supabase, requireSupabase } from './supabaseClient';
import { Message, User } from '../types';

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export interface DirectConversationResult {
  conversationId: string;
  isNew: boolean;
  error?: string;
}

/**
 * Busca ou cria uma conversa direta entre o usuário logado e o usuário alvo.
 * Garante que não sejam criadas conversas duplicadas e insere os registros
 * em direct_conversations e direct_conversation_members para ambos os participantes.
 */
export async function getOrCreateDirectConversation(
  currentUserId: string,
  targetUserId: string
): Promise<DirectConversationResult> {
  if (!currentUserId || !targetUserId) {
    throw new Error('Identificadores de usuário inválidos para conversa direta.');
  }

  const client = supabase || await requireSupabase();

  // 1. Busca se já existe uma conversa entre ambos
  try {
    const { data: myMemberships, error: myError } = await client
      .from('direct_conversation_members')
      .select('conversation_id')
      .eq('user_id', currentUserId);

    if (myError) {
      if (myError.code === '42501' || myError.message?.toLowerCase().includes('row-level security') || myError.message?.toLowerCase().includes('permission')) {
        return {
          conversationId: `dm-${targetUserId}`,
          isNew: false,
          error: 'Erro de permissão RLS no Supabase ao verificar conversas diretas. Verifique as políticas de segurança das tabelas direct_conversations e direct_conversation_members.',
        };
      }
      throw myError;
    }

    const myConvIds = (myMemberships || []).map((m) => m.conversation_id).filter(Boolean);

    if (myConvIds.length > 0) {
      const { data: commonMemberships, error: commonError } = await client
        .from('direct_conversation_members')
        .select('conversation_id')
        .eq('user_id', targetUserId)
        .in('conversation_id', myConvIds)
        .limit(1);

      if (!commonError && commonMemberships && commonMemberships.length > 0) {
        return {
          conversationId: commonMemberships[0].conversation_id,
          isNew: false,
        };
      }
    }
  } catch (err: any) {
    if (err?.code === '42501' || err?.message?.toLowerCase().includes('row-level security') || err?.message?.toLowerCase().includes('permission')) {
      return {
        conversationId: `dm-${targetUserId}`,
        isNew: false,
        error: 'Erro de RLS ao acessar direct_conversation_members.',
      };
    }
  }

  // 2. Não existe conversa anterior: Cria uma nova conversa em direct_conversations
  try {
    const { data: newConv, error: createError } = await client
      .from('direct_conversations')
      .insert({})
      .select('id')
      .single();

    if (createError) {
      if (createError.code === '42501' || createError.message?.toLowerCase().includes('row-level security') || createError.message?.toLowerCase().includes('permission')) {
        return {
          conversationId: `dm-${targetUserId}`,
          isNew: true,
          error: 'Erro de permissão RLS ao criar direct_conversations no Supabase. Permita INSERT para usuários autenticados.',
        };
      }
      throw createError;
    }

    if (!newConv?.id) {
      throw new Error('O Supabase não retornou o identificador da nova conversa.');
    }

    const conversationId = newConv.id;

    // 3. Insere ambos os membros em direct_conversation_members
    const membersToInsert = [
      { conversation_id: conversationId, user_id: currentUserId },
      { conversation_id: conversationId, user_id: targetUserId },
    ];

    const { error: membersError } = await client
      .from('direct_conversation_members')
      .insert(membersToInsert);

    if (membersError) {
      if (membersError.code === '42501' || membersError.message?.toLowerCase().includes('row-level security') || membersError.message?.toLowerCase().includes('permission')) {
        return {
          conversationId,
          isNew: true,
          error: 'Conversa criada, mas houve erro de permissão RLS ao adicionar membros em direct_conversation_members.',
        };
      }
      throw membersError;
    }

    return {
      conversationId,
      isNew: true,
    };
  } catch (err: any) {
    if (err?.code === '42501' || err?.message?.toLowerCase().includes('row-level security') || err?.message?.toLowerCase().includes('permission')) {
      return {
        conversationId: `dm-${targetUserId}`,
        isNew: true,
        error: 'Erro de permissão RLS no Supabase ao criar conversa direta.',
      };
    }
    // Fallback gracioso
    return {
      conversationId: isUuid(targetUserId) ? targetUserId : `dm-${targetUserId}`,
      isNew: true,
      error: err?.message || 'Falha ao sincronizar com direct_conversations.',
    };
  }
}
