import { requireSupabase } from './supabaseClient';

export type FriendshipState = 'none' | 'pending_sent' | 'pending_received' | 'accepted';

export async function getFriendshipState(targetUserId: string): Promise<FriendshipState> {
  const { data, error } = await (await requireSupabase()).rpc('user_friendship_status', { p_target_user_id: targetUserId });
  if (error) throw error;
  return (data || 'none') as FriendshipState;
}

export async function toggleFriendship(targetUserId: string): Promise<FriendshipState> {
  const { data, error } = await (await requireSupabase()).rpc('toggle_user_friendship', { p_target_user_id: targetUserId });
  if (error) throw error;
  const result = String(data || 'none');
  if (result === 'removed' || result === 'cancelled') return 'none';
  if (result === 'accepted') return 'accepted';
  return result === 'sent' ? 'pending_sent' : 'none';
}

export async function manageCommunityMember(input: {
  communityId: string;
  userId: string;
  action: 'role' | 'kick' | 'ban';
  role?: 'admin' | 'moderator' | 'member';
  reason?: string;
}): Promise<void> {
  const { error } = await (await requireSupabase()).rpc('manage_community_member', {
    p_community_id: input.communityId,
    p_user_id: input.userId,
    p_action: input.action,
    p_role: input.role || null,
    p_reason: input.reason || null,
  });
  if (error) throw error;
}
