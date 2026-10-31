import type { User } from '../../types';
import { requireSupabase, supabase } from '../../services/supabaseClient';

export interface OrbitCommunity { id: string; name: string; slug: string; description: string; banner_url: string | null; created_by: string; created_at: string; role?: 'admin' | 'member'; }
export interface OrbitComment { id: string; post_id: string; author_id: string; content: string; created_at: string; author: { display_name: string; handle: string; avatar_url: string | null }; }
export interface OrbitPollOption { id: string; post_id: string; label: string; position: number; vote_count: number; }
export interface OrbitPost { id: string; community_id: string; author_id: string; content: string; media_url: string | null; media_type: 'image' | 'video' | null; created_at: string; community: OrbitCommunity; author: { display_name: string; handle: string; avatar_url: string | null }; like_count: number; liked_by_me: boolean; comments: OrbitComment[]; poll_options: OrbitPollOption[]; user_vote_option_id: string | null; }
const env = import.meta.env;
const cloudName = env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
const uploadPreset = env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim();
export const isOrbitBackendConfigured = Boolean(supabase);
export const isOrbitMediaConfigured = Boolean(cloudName && uploadPreset);

const isMissingTableError = (error: { code?: string } | null | undefined) => error?.code === 'PGRST205' || error?.code === '42P01';

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
  const [communityResult, likesResult, commentsResult, optionsResult, votesResult] = await Promise.all([
    supabase.from('communities').select('id,name,slug,description,banner_url,created_by,created_at').in('id', communityIdsInPage),
    supabase.from('post_likes').select('post_id,user_id').in('post_id', postIds),
    supabase.from('post_comments').select('id,post_id,author_id,content,created_at').in('post_id', postIds).order('created_at', { ascending: true }),
    supabase.from('post_poll_options').select('id,post_id,label,position').in('post_id', postIds).order('position', { ascending: true }),
    supabase.from('post_poll_votes').select('post_id,option_id,user_id').in('post_id', postIds),
  ]);
  if (communityResult.error) throw communityResult.error;
  if (likesResult.error) throw likesResult.error;
  if (commentsResult.error && !isMissingTableError(commentsResult.error)) throw commentsResult.error;
  if (optionsResult.error && !isMissingTableError(optionsResult.error)) throw optionsResult.error;
  if (votesResult.error && !isMissingTableError(votesResult.error)) throw votesResult.error;
  const commentRows = commentsResult.error ? [] : commentsResult.data || [];
  const authorIdsWithComments = [...new Set([...authorIds, ...commentRows.map((item) => item.author_id as string)])];
  const profilesResult = await supabase.from('orbit_profiles').select('user_id,display_name,handle,avatar_url').in('user_id', authorIdsWithComments);
  if (profilesResult.error && !isMissingTableError(profilesResult.error)) throw profilesResult.error;
  const communityById = new Map((communityResult.data || []).map((item) => [item.id as string, item as unknown as OrbitCommunity]));
  const authorById = new Map((profilesResult.error ? [] : profilesResult.data || []).map((item) => [item.user_id as string, item]));
  const likesByPost = new Map<string, Array<{ user_id: string }>>();
  for (const like of likesResult.data || []) { const id = like.post_id as string; likesByPost.set(id, [...(likesByPost.get(id) || []), { user_id: like.user_id as string }]); }
  const votesByOption = new Map<string, Array<{ user_id: string }>>();
  const userVoteByPost = new Map<string, string>();
  for (const vote of votesResult.error ? [] : votesResult.data || []) {
    const optionId = vote.option_id as string;
    const postId = vote.post_id as string;
    votesByOption.set(optionId, [...(votesByOption.get(optionId) || []), { user_id: vote.user_id as string }]);
    if (vote.user_id === userId) userVoteByPost.set(postId, optionId);
  }
  const commentsByPost = new Map<string, OrbitComment[]>();
  for (const row of commentRows) {
    const author = authorById.get(row.author_id as string);
    const comment: OrbitComment = {
      id: row.id as string,
      post_id: row.post_id as string,
      author_id: row.author_id as string,
      content: row.content as string,
      created_at: row.created_at as string,
      author: { display_name: (author?.display_name as string) || 'Membro Koaline', handle: (author?.handle as string) || '', avatar_url: (author?.avatar_url as string | null) || null },
    };
    commentsByPost.set(comment.post_id, [...(commentsByPost.get(comment.post_id) || []), comment]);
  }
  const optionsByPost = new Map<string, OrbitPollOption[]>();
  for (const row of optionsResult.error ? [] : optionsResult.data || []) {
    const postId = row.post_id as string;
    const option: OrbitPollOption = { id: row.id as string, post_id: postId, label: row.label as string, position: row.position as number, vote_count: votesByOption.get(row.id as string)?.length || 0 };
    optionsByPost.set(postId, [...(optionsByPost.get(postId) || []), option]);
  }
  return rows.flatMap((row) => {
    const community = communityById.get(row.community_id as string);
    if (!community) return [];
    const author = authorById.get(row.author_id as string);
    const likes = likesByPost.get(row.id as string) || [];
    return [{ ...(row as unknown as Omit<OrbitPost, 'community' | 'author' | 'like_count' | 'liked_by_me' | 'comments' | 'poll_options' | 'user_vote_option_id'>), community, author: { display_name: (author?.display_name as string) || 'Membro Koaline', handle: (author?.handle as string) || '', avatar_url: (author?.avatar_url as string | null) || null }, like_count: likes.length, liked_by_me: likes.some((item) => item.user_id === userId), comments: commentsByPost.get(row.id as string) || [], poll_options: optionsByPost.get(row.id as string) || [], user_vote_option_id: userVoteByPost.get(row.id as string) || null }];
  });
}

export async function fetchOrbitProfileByHandle(handle: string): Promise<{ user_id: string; display_name: string; handle: string; avatar_url: string | null } | null> {
  const supabase = await getOrbitClient();
  const { data, error } = await supabase.from('orbit_profiles').select('user_id,display_name,handle,avatar_url').ilike('handle', handle).limit(1).maybeSingle();
  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
  return data as { user_id: string; display_name: string; handle: string; avatar_url: string | null } | null;
}

export async function fetchOrbitPostComments(postId: string): Promise<OrbitComment[]> {
  const supabase = await getOrbitClient();
  const { data, error } = await supabase.from('post_comments').select('id,post_id,author_id,content,created_at').eq('post_id', postId).order('created_at', { ascending: true });
  if (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
  const rows = data || [];
  const authorIds = [...new Set(rows.map((row) => row.author_id as string))];
  if (!authorIds.length) return [];
  const { data: profiles, error: profileError } = await supabase.from('orbit_profiles').select('user_id,display_name,handle,avatar_url').in('user_id', authorIds);
  if (profileError && !isMissingTableError(profileError)) throw profileError;
  const byId = new Map((profileError ? [] : profiles || []).map((profile) => [profile.user_id as string, profile]));
  return rows.map((row) => {
    const profile = byId.get(row.author_id as string);
    return { ...row, author: { display_name: (profile?.display_name as string) || 'Membro Koaline', handle: (profile?.handle as string) || '', avatar_url: (profile?.avatar_url as string | null) || null } } as OrbitComment;
  });
}

export async function fetchOrbitPollResults(postId: string, userId: string): Promise<{ options: OrbitPollOption[]; userVoteOptionId: string | null }> {
  const supabase = await getOrbitClient();
  const [optionsResult, votesResult] = await Promise.all([
    supabase.from('post_poll_options').select('id,post_id,label,position').eq('post_id', postId).order('position', { ascending: true }),
    supabase.from('post_poll_votes').select('option_id,user_id').eq('post_id', postId),
  ]);
  if (optionsResult.error && !isMissingTableError(optionsResult.error)) throw optionsResult.error;
  if (votesResult.error && !isMissingTableError(votesResult.error)) throw votesResult.error;
  const votesByOption = new Map<string, number>();
  let userVoteOptionId: string | null = null;
  for (const vote of votesResult.error ? [] : votesResult.data || []) {
    const optionId = vote.option_id as string;
    votesByOption.set(optionId, (votesByOption.get(optionId) || 0) + 1);
    if (vote.user_id === userId) userVoteOptionId = optionId;
  }
  return {
    options: (optionsResult.error ? [] : optionsResult.data || []).map((option) => ({ ...option, vote_count: votesByOption.get(option.id as string) || 0 }) as OrbitPollOption),
    userVoteOptionId,
  };
}

export async function createOrbitPost(input: { communityId: string; authorId: string; content: string; mediaUrl: string | null; mediaType: 'image' | 'video' | null }): Promise<void> {
  const supabase = await getOrbitClient();
  const { error } = await supabase.from('posts').insert({ community_id: input.communityId, author_id: input.authorId, content: input.content, media_url: input.mediaUrl, media_type: input.mediaType });
  if (error) throw error;
}

export async function createOrbitPoll(input: { communityId: string; authorId: string; question: string; options: string[] }): Promise<void> {
  const supabase = await getOrbitClient();
  const { data: post, error: postError } = await supabase.from('posts').insert({ community_id: input.communityId, author_id: input.authorId, content: input.question, media_url: null, media_type: null }).select('id').single();
  if (postError) throw postError;
  const { error: optionsError } = await supabase.from('post_poll_options').insert(input.options.map((label, position) => ({ post_id: post.id, label, position })));
  if (optionsError) {
    await supabase.from('posts').delete().eq('id', post.id);
    throw optionsError;
  }
}

export async function voteOrbitPoll(postId: string, optionId: string, userId: string): Promise<void> {
  const supabase = await getOrbitClient();
  const { error } = await supabase.from('post_poll_votes').upsert({ post_id: postId, option_id: optionId, user_id: userId }, { onConflict: 'post_id,user_id' });
  if (error) throw error;
}

export async function createOrbitComment(postId: string, authorId: string, content: string): Promise<OrbitComment> {
  const supabase = await getOrbitClient();
  const { data, error } = await supabase.from('post_comments').insert({ post_id: postId, author_id: authorId, content }).select('id,post_id,author_id,content,created_at').single();
  if (error) throw error;
  const { data: profile, error: profileError } = await supabase.from('orbit_profiles').select('display_name,handle,avatar_url').eq('user_id', authorId).maybeSingle();
  if (profileError && !isMissingTableError(profileError)) throw profileError;
  return { ...data, author: { display_name: profile?.display_name || 'Membro Koaline', handle: profile?.handle || '', avatar_url: profile?.avatar_url || null } } as OrbitComment;
}

export function subscribeOrbitInteractions(onComment: (postId: string) => void, onPollVote: (postId: string) => void): () => void {
  if (!supabase) return () => undefined;
  const channel = supabase.channel(`orbit-interactions-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_comments' }, (payload) => {
      const row = payload.new as { post_id?: string };
      if (row.post_id) onComment(row.post_id);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'post_poll_votes' }, (payload) => {
      const row = (payload.new && Object.keys(payload.new).length ? payload.new : payload.old) as { post_id?: string };
      if (row.post_id) onPollVote(row.post_id);
    })
    .subscribe();
  return () => { void supabase?.removeChannel(channel); };
}

export async function toggleOrbitLike(postId: string, userId: string, currentlyLiked: boolean): Promise<void> {
  const supabase = await getOrbitClient();
  const result = currentlyLiked ? await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId) : await supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
  if (result.error) throw result.error;
}

export async function uploadOrbitMedia(file: File): Promise<{ url: string; type: 'image' | 'video' }> {
  const type = file.type.startsWith('video/') ? 'video' : 'image';
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) throw new Error('Escolha uma imagem ou um vídeo.');
  if (!cloudName || !uploadPreset) {
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Não foi possível ler a mídia.'));
      reader.onerror = () => reject(new Error('Não foi possível ler a mídia.'));
      reader.readAsDataURL(file);
    });
    return { url, type };
  }
  const body = new FormData();
  body.append('file', file); body.append('upload_preset', uploadPreset);
  const response = await fetch('https://api.cloudinary.com/v1_1/' + encodeURIComponent(cloudName) + '/' + type + '/upload', { method: 'POST', body });
  const result = await response.json() as { secure_url?: string; error?: { message?: string } };
  if (!response.ok || !result.secure_url) throw new Error(result.error?.message || 'O upload externo falhou. Tente novamente.');
  return { url: result.secure_url, type };
}


