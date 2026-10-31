import type { User } from '../../types';
import { requireSupabase, supabase } from '../../services/supabaseClient';

export interface OrbitCommunity { id: string; name: string; slug: string; description: string; banner_url: string | null; created_by: string; created_at: string; role?: 'admin' | 'member'; }
export interface OrbitPost { id: string; community_id: string; author_id: string; content: string; media_url: string | null; media_type: 'image' | 'video' | null; created_at: string; community: OrbitCommunity; author: { display_name: string; handle: string; avatar_url: string | null }; like_count: number; liked_by_me: boolean; }
const env = import.meta.env;
const cloudName = env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
const uploadPreset = env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim();
export const isOrbitBackendConfigured = Boolean(supabase);
export const isOrbitMediaConfigured = Boolean(cloudName && uploadPreset);

export async function getOrbitClient() {
  return requireSupabase();
}

export async function ensureOrbitIdentity(user: User): Promise<string> {
  const supabase = await getOrbitClient();
  const sessionResult = await supabase.auth.getSession();
  if (sessionResult.error) throw sessionResult.error;
  let authUserId = sessionResult.data.session?.user.id;
  if (!authUserId) {
    const result = await supabase.auth.signInAnonymously();
    if (result.error) throw new Error('Ative o provedor de login anônimo em Supabase > Authentication > Providers para usar o Orbit.');
    authUserId = result.data.user?.id;
  }
  if (!authUserId) throw new Error('Não foi possível iniciar uma sessão do Orbit. Tente novamente.');
  const profileResult = await supabase.from('orbit_profiles').upsert({ user_id: authUserId, display_name: user.name || 'Membro Koaline', handle: (user.handle || user.id || authUserId).replace(/^@/, ''), avatar_url: user.avatar || null }, { onConflict: 'user_id' });
  if (profileResult.error) throw profileResult.error;
  return authUserId;
}

export async function listOrbitCommunities(userId: string): Promise<{ communities: OrbitCommunity[]; joinedIds: string[] }> {
  const supabase = await getOrbitClient();
  const [communitiesResult, membershipsResult] = await Promise.all([
    supabase.from('communities').select('id,name,slug,description,banner_url,created_by,created_at').order('created_at', { ascending: false }),
    supabase.from('community_members').select('community_id,role').eq('user_id', userId),
  ]);
  if (communitiesResult.error) throw communitiesResult.error;
  if (membershipsResult.error) throw membershipsResult.error;
  const roles = new Map((membershipsResult.data || []).map((item) => [item.community_id as string, item.role as 'admin' | 'member']));
  return { communities: (communitiesResult.data || []).map((item) => ({ ...item, role: roles.get(item.id) })) as OrbitCommunity[], joinedIds: [...roles.keys()] };
}

export async function createOrbitCommunity(input: { name: string; slug: string; description: string; bannerUrl: string | null }): Promise<OrbitCommunity> {
  const supabase = await getOrbitClient();
  const { data, error } = await supabase.rpc('create_orbit_community', { p_name: input.name, p_slug: input.slug, p_description: input.description, p_banner_url: input.bannerUrl });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as OrbitCommunity | null;
  if (!row?.id) throw new Error('A comunidade não foi criada. Verifique a migration do Orbit no Supabase.');
  return row;
}

export async function joinOrbitCommunity(communityId: string): Promise<void> {
  const supabase = await getOrbitClient();
  const { error } = await supabase.rpc('join_orbit_community', { p_community_id: communityId });
  if (error) throw error;
}

export async function fetchOrbitPosts(communityIds: string[], userId: string, offset: number, limit: number): Promise<OrbitPost[]> {
  if (!communityIds.length) return [];
  const supabase = await getOrbitClient();
  const { data: rows, error } = await supabase.from('posts').select('id,community_id,author_id,content,media_url,media_type,created_at').in('community_id', communityIds).order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + limit - 1);
  if (error) throw error;
  if (!rows?.length) return [];
  const communityIdsInPage = [...new Set(rows.map((row) => row.community_id as string))];
  const authorIds = [...new Set(rows.map((row) => row.author_id as string))];
  const postIds = rows.map((row) => row.id as string);
  const [communityResult, profilesResult, likesResult] = await Promise.all([
    supabase.from('communities').select('id,name,slug,description,banner_url,created_by,created_at').in('id', communityIdsInPage),
    supabase.from('orbit_profiles').select('user_id,display_name,handle,avatar_url').in('user_id', authorIds),
    supabase.from('post_likes').select('post_id,user_id').in('post_id', postIds),
  ]);
  if (communityResult.error) throw communityResult.error;
  if (profilesResult.error) throw profilesResult.error;
  if (likesResult.error) throw likesResult.error;
  const communityById = new Map((communityResult.data || []).map((item) => [item.id as string, item as unknown as OrbitCommunity]));
  const authorById = new Map((profilesResult.data || []).map((item) => [item.user_id as string, item]));
  const likesByPost = new Map<string, Array<{ user_id: string }>>();
  for (const like of likesResult.data || []) { const id = like.post_id as string; likesByPost.set(id, [...(likesByPost.get(id) || []), { user_id: like.user_id as string }]); }
  return rows.flatMap((row) => {
    const community = communityById.get(row.community_id as string);
    if (!community) return [];
    const author = authorById.get(row.author_id as string);
    const likes = likesByPost.get(row.id as string) || [];
    return [{ ...(row as unknown as Omit<OrbitPost, 'community' | 'author' | 'like_count' | 'liked_by_me'>), community, author: { display_name: (author?.display_name as string) || 'Membro Koaline', handle: (author?.handle as string) || '', avatar_url: (author?.avatar_url as string | null) || null }, like_count: likes.length, liked_by_me: likes.some((item) => item.user_id === userId) }];
  });
}

export async function createOrbitPost(input: { communityId: string; authorId: string; content: string; mediaUrl: string | null; mediaType: 'image' | 'video' | null }): Promise<void> {
  const supabase = await getOrbitClient();
  const { error } = await supabase.from('posts').insert({ community_id: input.communityId, author_id: input.authorId, content: input.content, media_url: input.mediaUrl, media_type: input.mediaType });
  if (error) throw error;
}

export async function toggleOrbitLike(postId: string, userId: string, currentlyLiked: boolean): Promise<void> {
  const supabase = await getOrbitClient();
  const result = currentlyLiked ? await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId) : await supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
  if (result.error) throw result.error;
}

export async function uploadOrbitMedia(file: File): Promise<{ url: string; type: 'image' | 'video' }> {
  if (!cloudName || !uploadPreset) throw new Error('Configure Cloudinary (nome da nuvem e preset unsigned) para enviar imagens e vídeos.');
  const type = file.type.startsWith('video/') ? 'video' : 'image';
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) throw new Error('Escolha uma imagem ou um vídeo.');
  const body = new FormData();
  body.append('file', file); body.append('upload_preset', uploadPreset);
  const response = await fetch('https://api.cloudinary.com/v1_1/' + encodeURIComponent(cloudName) + '/' + type + '/upload', { method: 'POST', body });
  const result = await response.json() as { secure_url?: string; error?: { message?: string } };
  if (!response.ok || !result.secure_url) throw new Error(result.error?.message || 'O upload externo falhou. Tente novamente.');
  return { url: result.secure_url, type };
}


