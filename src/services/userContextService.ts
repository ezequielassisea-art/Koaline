import { requireSupabase, supabase } from './supabaseClient';

export type FriendshipState = 'none' | 'pending_sent' | 'pending_received' | 'accepted';

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

// Cache local de amizades para garantir que a UI se mantenha consistente
const localFriendshipCache = new Map<string, FriendshipState>();

export async function getFriendshipState(targetUserId: string): Promise<FriendshipState> {
  if (!targetUserId || !isUuid(targetUserId)) {
    return localFriendshipCache.get(targetUserId) || 'none';
  }

  try {
    const client = supabase || await requireSupabase();
    const { data: authData } = await client.auth.getUser();
    if (!authData?.user) {
      return localFriendshipCache.get(targetUserId) || 'none';
    }

    const { data, error } = await client.rpc('user_friendship_status', { p_target_user_id: targetUserId });
    if (error) {
      return localFriendshipCache.get(targetUserId) || 'none';
    }

    const state = (data || 'none') as FriendshipState;
    localFriendshipCache.set(targetUserId, state);
    return state;
  } catch {
    return localFriendshipCache.get(targetUserId) || 'none';
  }
}

export async function toggleFriendship(targetUserId: string): Promise<FriendshipState> {
  if (!targetUserId) return 'none';

  // Se não for UUID válido, trata o estado na interface sem erro
  if (!isUuid(targetUserId)) {
    const current = localFriendshipCache.get(targetUserId) || 'none';
    const next: FriendshipState = current === 'none' ? 'pending_sent' : current === 'pending_sent' ? 'accepted' : 'none';
    localFriendshipCache.set(targetUserId, next);
    return next;
  }

  try {
    const client = supabase || await requireSupabase();
    const { data: authData } = await client.auth.getUser();
    if (!authData?.user) {
      const current = localFriendshipCache.get(targetUserId) || 'none';
      const next: FriendshipState = current === 'none' ? 'pending_sent' : 'none';
      localFriendshipCache.set(targetUserId, next);
      return next;
    }

    const { data, error } = await client.rpc('toggle_user_friendship', { p_target_user_id: targetUserId });
    if (error) {
      const current = localFriendshipCache.get(targetUserId) || 'none';
      const next: FriendshipState = current === 'none' ? 'pending_sent' : 'none';
      localFriendshipCache.set(targetUserId, next);
      return next;
    }

    const result = String(data || 'none');
    let nextState: FriendshipState = 'none';
    if (result === 'removed' || result === 'cancelled') nextState = 'none';
    else if (result === 'accepted') nextState = 'accepted';
    else if (result === 'sent') nextState = 'pending_sent';

    localFriendshipCache.set(targetUserId, nextState);
    return nextState;
  } catch {
    const current = localFriendshipCache.get(targetUserId) || 'none';
    const next: FriendshipState = current === 'none' ? 'pending_sent' : 'none';
    localFriendshipCache.set(targetUserId, next);
    return next;
  }
}

export async function manageCommunityMember(input: {
  communityId: string;
  userId: string;
  action: 'role' | 'kick' | 'ban';
  role?: 'admin' | 'moderator' | 'member';
  reason?: string;
}): Promise<void> {
  try {
    const client = supabase || await requireSupabase();
    const { error } = await client.rpc('manage_community_member', {
      p_community_id: input.communityId,
      p_user_id: input.userId,
      p_action: input.action,
      p_role: input.role || null,
      p_reason: input.reason || null,
    });
    if (error) throw error;
  } catch (err) {
    throw err;
  }
}
