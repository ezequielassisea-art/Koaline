import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Camera, Check, ChevronRight, Globe, Heart, ImagePlus, LoaderCircle, MessageSquare, Plus, Search, Send, Sparkles, Users, Video, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatRelativeTime } from '../../utils/time';
import { createOrbitComment, createOrbitCommunity, createOrbitPoll, createOrbitPost, ensureOrbitIdentity, fetchOrbitPollResults, fetchOrbitPostComments, fetchOrbitPosts, fetchOrbitProfileByHandle, isOrbitBackendConfigured, isOrbitMediaConfigured, joinOrbitCommunity, listOrbitCommunities, subscribeOrbitInteractions, toggleOrbitLike, uploadOrbitMedia, voteOrbitPoll, type OrbitCommunity, type OrbitPost } from './orbitService';
import './OrbitPage.css';

const PAGE_SIZE = 12;
type ModalKind = 'community' | 'post' | null;
const slugify = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'comunidade';
const errorText = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const result = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const message = [result.message, result.details, result.hint].filter((value): value is string => typeof value === 'string' && value.trim().length > 0).join(' — ');
    if (message) return result.code ? `${message} (${String(result.code)})` : message;
  }
  return typeof error === 'string' && error ? error : 'Ocorreu uma falha inesperada. Tente novamente.';
};

function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!file) { setUrl(''); return; }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return url;
}

const OrbitPageComponent: React.FC<{ onBack: () => void }> = () => {
  const { currentUser, addToast, openUserProfile } = useApp();
  const [modal, setModal] = useState<ModalKind>(null);
  const [authUserId, setAuthUserId] = useState('');
  const [communities, setCommunities] = useState<OrbitCommunity[]>([]);
  const [joinedIds, setJoinedIds] = useState<string[]>([]);
  const [posts, setPosts] = useState<OrbitPost[]>([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [backendError, setBackendError] = useState('');
  const [communitySaving, setCommunitySaving] = useState(false);
  const [postSaving, setPostSaving] = useState(false);
  const [communityName, setCommunityName] = useState('');
  const [communityDescription, setCommunityDescription] = useState('');
  const [communityBanner, setCommunityBanner] = useState<File | null>(null);
  const [postCommunityId, setPostCommunityId] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postMedia, setPostMedia] = useState<File | null>(null);
  const [postMode, setPostMode] = useState<'post' | 'poll'>('post');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentSubmittingPostId, setCommentSubmittingPostId] = useState('');
  const [votingPostId, setVotingPostId] = useState('');
  const [hashtagFilter, setHashtagFilter] = useState('');
  const [feedVersion, setFeedVersion] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadLock = useRef(false);
  const requestRef = useRef(0);
  const postsRef = useRef(posts);
  postsRef.current = posts;
  const bannerPreviewUrl = useObjectUrl(communityBanner);
  const postPreviewUrl = useObjectUrl(postMedia);

  const refreshCommunities = async (userId: string) => {
    const result = await listOrbitCommunities(userId);
    setCommunities(result.communities);
    setJoinedIds(result.joinedIds);
    return result;
  };

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      if (!isOrbitBackendConfigured) {
        setBackendError('O Orbit está pronto, mas falta conectar o Supabase. Configure as variáveis do app e aplique a migration do banco.');
        setPageLoading(false);
        return;
      }
      try {
        const userId = await ensureOrbitIdentity(currentUser);
        if (!active) return;
        setAuthUserId(userId);
        await refreshCommunities(userId);
      } catch (error) {
        if (active) setBackendError(errorText(error));
      } finally { if (active) setPageLoading(false); }
    };
    void initialize();
    return () => { active = false; };
  }, [currentUser.id, currentUser.name, currentUser.handle, currentUser.avatar]);

  const feedCommunityIds = useMemo(() => selectedCommunityId ? (joinedIds.includes(selectedCommunityId) ? [selectedCommunityId] : []) : joinedIds, [joinedIds, selectedCommunityId]);
  const feedKey = feedCommunityIds.join(',');

  const loadPage = async (reset: boolean, ids = feedCommunityIds) => {
    const requestId = reset ? ++requestRef.current : requestRef.current;
    if (!ids.length) {
      if (reset) { setPosts([]); setHasMore(false); setPageLoading(false); }
      return;
    }
    if (loadLock.current && !reset) return;
    loadLock.current = true;
    if (reset) setPageLoading(true); else setLoadingMore(true);
    const offset = reset ? 0 : posts.length;
    try {
      const page = await fetchOrbitPosts(ids, authUserId, offset, PAGE_SIZE);
      if (requestId !== requestRef.current) return;
      setPosts((previous) => reset ? page : [...previous, ...page.filter((post) => !previous.some((item) => item.id === post.id))]);
      setHasMore(page.length === PAGE_SIZE);
      setBackendError('');
    } catch (error) {
      if (requestId === requestRef.current) { setBackendError(errorText(error)); addToast('Falha ao carregar Orbit', errorText(error), 'warning'); }
    } finally {
      if (requestId === requestRef.current) { loadLock.current = false; setPageLoading(false); setLoadingMore(false); }
    }
  };

  useEffect(() => {
    if (!authUserId) return;
    setPosts([]);
    setHasMore(feedCommunityIds.length > 0);
    void loadPage(true, feedCommunityIds);
  }, [authUserId, feedKey, feedVersion]);

  useEffect(() => {
    const target = sentinelRef.current;
    const root = scrollRef.current;
    if (!target || !root || !hasMore || pageLoading || loadingMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && !loadLock.current) void loadPage(false, feedCommunityIds);
    }, { root, rootMargin: '420px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [feedKey, posts.length, hasMore, pageLoading, loadingMore, feedVersion]);

  const filteredCommunities = useMemo(() => communities.filter((community) => {
    const term = searchValue.trim().toLocaleLowerCase('pt-BR');
    return !term || community.name.toLocaleLowerCase('pt-BR').includes(term) || community.description.toLocaleLowerCase('pt-BR').includes(term);
  }), [communities, searchValue]);
  const joinedCommunities = communities.filter((community) => joinedIds.includes(community.id));
  const visiblePosts = hashtagFilter
    ? posts.filter((post) => post.content.toLocaleLowerCase('pt-BR').includes(`#${hashtagFilter.toLocaleLowerCase('pt-BR')}`))
    : posts;

  useEffect(() => {
    if (!authUserId) return;
    return subscribeOrbitInteractions((postId) => {
      if (!postsRef.current.some((post) => post.id === postId)) return;
      void fetchOrbitPostComments(postId).then((comments) => {
        setPosts((previous) => previous.map((post) => post.id === postId ? { ...post, comments } : post));
      }).catch((error) => addToast('Comentários não atualizados', errorText(error), 'warning'));
    }, (postId) => {
      if (!postsRef.current.some((post) => post.id === postId)) return;
      void fetchOrbitPollResults(postId, authUserId).then((result) => {
        setPosts((previous) => previous.map((post) => post.id === postId ? { ...post, poll_options: result.options, user_vote_option_id: result.userVoteOptionId } : post));
      }).catch((error) => addToast('Enquete não atualizada', errorText(error), 'warning'));
    });
  }, [authUserId]);

  const joinCommunity = async (community: OrbitCommunity) => {
    try {
      await joinOrbitCommunity(community.id);
      await refreshCommunities(authUserId);
      setSelectedCommunityId(community.id);
      addToast('Comunidade adicionada', 'Agora você acompanha o feed desta comunidade.', 'success');
    } catch (error) { addToast('Não foi possível entrar', errorText(error), 'warning'); }
  };

  const submitCommunity = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!communityName.trim()) return;
    setCommunitySaving(true);
    try {
      let bannerUrl: string | null = null;
      if (communityBanner) bannerUrl = (await uploadOrbitMedia(communityBanner)).url;
      const suffix = crypto.randomUUID().slice(0, 6);
      const created = await createOrbitCommunity({ name: communityName.trim(), slug: slugify(communityName) + '-' + suffix, description: communityDescription.trim(), bannerUrl });
      await refreshCommunities(authUserId);
      setSelectedCommunityId(created.id);
      setCommunityName(''); setCommunityDescription(''); setCommunityBanner(null); setModal(null);
      addToast('Comunidade criada', 'Sua comunidade já está disponível no Orbit.', 'success');
    } catch (error) { addToast('Não foi possível criar a comunidade', errorText(error), 'warning'); }
    finally { setCommunitySaving(false); }
  };

  const submitPost = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanPollOptions = pollOptions.map((option) => option.trim()).filter(Boolean);
    if (!postCommunityId || (!postContent.trim() && !postMedia) || (postMode === 'poll' && (cleanPollOptions.length < 2 || cleanPollOptions.length > 5))) return;
    setPostSaving(true);
    try {
      if (postMode === 'poll') {
        await createOrbitPoll({ communityId: postCommunityId, authorId: authUserId, question: postContent.trim(), options: cleanPollOptions });
      } else {
        let mediaUrl: string | null = null;
        let mediaType: 'image' | 'video' | null = null;
        if (postMedia) { const uploaded = await uploadOrbitMedia(postMedia); mediaUrl = uploaded.url; mediaType = uploaded.type; }
        await createOrbitPost({ communityId: postCommunityId, authorId: authUserId, content: postContent.trim(), mediaUrl, mediaType });
      }
      setPostContent(''); setPostMedia(null); setPostMode('post'); setPollOptions(['', '']); setModal(null);
      if (selectedCommunityId && selectedCommunityId !== postCommunityId) setSelectedCommunityId('');
      setFeedVersion((value) => value + 1);
      addToast(postMode === 'poll' ? 'Enquete publicada' : 'Post publicado', 'Sua publicação já está no feed.', 'success');
    } catch (error) { addToast('Não foi possível publicar', errorText(error), 'warning'); }
    finally { setPostSaving(false); }
  };

  const onLike = async (post: OrbitPost) => {
    if (!authUserId) return;
    setPosts((current) => current.map((item) => item.id === post.id ? { ...item, liked_by_me: !item.liked_by_me, like_count: item.like_count + (item.liked_by_me ? -1 : 1) } : item));
    try { await toggleOrbitLike(post.id, authUserId, post.liked_by_me); }
    catch (error) { setPosts((current) => current.map((item) => item.id === post.id ? post : item)); addToast('Curtida não salva', errorText(error), 'warning'); }
  };

  const onVote = async (post: OrbitPost, optionId: string) => {
    if (!authUserId || votingPostId) return;
    const previousPost = post;
    const previousVote = post.user_vote_option_id;
    setVotingPostId(post.id);
    setPosts((current) => current.map((item) => item.id !== post.id ? item : {
      ...item,
      user_vote_option_id: optionId,
      poll_options: item.poll_options.map((option) => ({ ...option, vote_count: option.vote_count + (option.id === optionId && previousVote !== optionId ? 1 : option.id === previousVote && previousVote !== optionId ? -1 : 0) })),
    }));
    try { await voteOrbitPoll(post.id, optionId, authUserId); }
    catch (error) { setPosts((current) => current.map((item) => item.id === post.id ? previousPost : item)); addToast('Voto não salvo', errorText(error), 'warning'); }
    finally { setVotingPostId(''); }
  };

  const submitComment = async (postId: string, event: React.FormEvent) => {
    event.preventDefault();
    const content = (commentDrafts[postId] || '').trim();
    if (!content || !authUserId || commentSubmittingPostId) return;
    setCommentSubmittingPostId(postId);
    try {
      const comment = await createOrbitComment(postId, authUserId, content);
      setPosts((current) => current.map((post) => post.id === postId && !post.comments.some((item) => item.id === comment.id)
        ? { ...post, comments: [...post.comments, comment] }
        : post));
      setCommentDrafts((current) => ({ ...current, [postId]: '' }));
    } catch (error) { addToast('Comentário não enviado', errorText(error), 'warning'); }
    finally { setCommentSubmittingPostId(''); }
  };

  const openMentionedProfile = async (handle: string) => {
    try {
      const profile = await fetchOrbitProfileByHandle(handle);
      if (!profile) { addToast('Perfil não encontrado', `Não encontramos @${handle} no Orbit.`, 'info'); return; }
      openUserProfile({ ...currentUser, id: profile.user_id, name: profile.display_name, handle: profile.handle, avatar: profile.avatar_url || '', status: 'offline' });
    } catch (error) { addToast('Perfil indisponível', errorText(error), 'warning'); }
  };

  const renderPostContent = (content: string) => content.split(/(#[\p{L}\p{N}_]+|@[\p{L}\p{N}_.]+)/gu).map((part, index) => {
    if (part.startsWith('#')) {
      const tag = part.slice(1);
      return <a key={`${part}-${index}`} className="orbit-inline-link" href={`#${encodeURIComponent(tag)}`} onClick={(event) => { event.preventDefault(); setHashtagFilter(tag); }}>{part}</a>;
    }
    if (part.startsWith('@')) {
      const handle = part.slice(1);
      return <a key={`${part}-${index}`} className="orbit-inline-link" href={`/profile/${encodeURIComponent(handle)}`} onClick={(event) => { event.preventDefault(); void openMentionedProfile(handle); }}>{part}</a>;
    }
    return <React.Fragment key={`text-${index}`}>{part}</React.Fragment>;
  });

  const openPostModal = (communityId: string) => { setPostCommunityId(communityId); setPostContent(''); setPostMedia(null); setPostMode('post'); setPollOptions(['', '']); setModal('post'); };
  const openCommunityModal = () => { setCommunityName(''); setCommunityDescription(''); setCommunityBanner(null); setModal('community'); };

  return <div className="orbit-page" ref={scrollRef}>
    <div className="orbit-topline">
      <span aria-hidden="true" />
      <div className="orbit-wordmark"><Globe size={22} /><span>Orbit</span></div>
      <button type="button" className="orbit-primary-button orbit-create-top" disabled={!authUserId} onClick={openCommunityModal}><Plus size={17} /> Criar comunidade</button>
    </div>
    <div className="orbit-layout">
      <aside className="orbit-sidebar">
        <div className="orbit-sidebar-heading"><div><span className="orbit-eyebrow">EXPLORE</span><h2>Comunidades</h2></div><button type="button" className="orbit-icon-button" aria-label="Criar comunidade" title="Criar comunidade" disabled={!authUserId} onClick={openCommunityModal}><Plus size={18} /></button></div>
        <label className="orbit-search"><Search size={16} /><input value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="Buscar comunidades" /></label>
        <button type="button" className={'orbit-community-row' + (!selectedCommunityId ? ' is-active' : '')} onClick={() => setSelectedCommunityId('')}><span className="orbit-community-glyph"><Globe size={17} /></span><span className="orbit-community-copy"><strong>Seu feed</strong><small>{joinedIds.length} comunidades</small></span><ChevronRight size={15} /></button>
        <div className="orbit-community-list">{filteredCommunities.map((community) => {
          const joined = joinedIds.includes(community.id);
          return <div className={'orbit-community-row-wrap' + (selectedCommunityId === community.id ? ' is-active' : '')} key={community.id}><button type="button" className="orbit-community-row" onClick={() => joined ? setSelectedCommunityId(community.id) : void joinCommunity(community)} title={joined ? community.description : 'Entrar na comunidade'}>{community.banner_url ? <img className="orbit-community-avatar" src={community.banner_url} alt="" loading="lazy" /> : <span className="orbit-community-glyph"><Sparkles size={16} /></span>}<span className="orbit-community-copy"><strong>{community.name}</strong><small>{joined ? 'Na sua lista' : 'Toque para participar'}</small></span>{!joined && <ArrowUpRight size={14} />}</button></div>;
        })}{!filteredCommunities.length && <p className="orbit-muted orbit-small">Nenhuma comunidade encontrada.</p>}</div>
        <button type="button" className="orbit-secondary-button orbit-full-button" disabled={!authUserId} onClick={openCommunityModal}><Plus size={16} /> Nova comunidade</button>
      </aside>

      <section className="orbit-feed-column">
        <div className="orbit-feed-heading"><div><span className="orbit-eyebrow">KOALINE SOCIAL</span><h1>{selectedCommunityId ? communities.find((item) => item.id === selectedCommunityId)?.name || 'Comunidade' : 'Seu Orbit'}</h1><p>Ideias, histórias e conversas da sua comunidade.</p></div><span className="orbit-live-pill"><span /> Comunidades</span></div>
        {backendError && <div className="orbit-setup-notice"><Globe size={19} /><div><strong>Conexão do Orbit</strong><p>{backendError}</p><small>Mídias são enviadas ao Cloudinary; sem Cloudinary, ficam temporariamente como base64 no post.</small></div></div>}
        {!backendError && !pageLoading && joinedCommunities.length > 0 && <button type="button" className="orbit-composer-prompt" onClick={() => openPostModal(selectedCommunityId || joinedCommunities[0].id)}>{currentUser.avatar ? <img src={currentUser.avatar} alt="" /> : <span className="orbit-composer-avatar-fallback">{currentUser.name.slice(0, 1).toUpperCase()}</span>}<span>No que você está pensando?</span><span className="orbit-composer-action"><ImagePlus size={17} /> Criar post</span></button>}
        {hashtagFilter && <button type="button" className="orbit-filter-chip" onClick={() => setHashtagFilter('')}>Filtro: #{hashtagFilter} <X size={14} /></button>}
        {pageLoading ? <div className="orbit-loading"><LoaderCircle className="orbit-spin" size={24} /> Carregando seu feed…</div> : visiblePosts.length ? <div className="orbit-post-list">{visiblePosts.map((post) => <article className="orbit-post-card" key={post.id}>
          <div className="orbit-post-head">{post.author.avatar_url ? <img className="orbit-post-avatar" src={post.author.avatar_url} alt="" loading="lazy" /> : <div className="orbit-post-avatar orbit-avatar-fallback">{post.author.display_name.slice(0, 1).toUpperCase()}</div>}<div className="orbit-post-meta"><div><strong>{post.author.display_name}</strong><span>@{post.author.handle || 'koaline'}</span></div><time dateTime={post.created_at}>{formatRelativeTime(post.created_at, { message: true })}</time></div><button type="button" className="orbit-community-chip" onClick={() => setSelectedCommunityId(post.community_id)}>{post.community.name}</button></div>
          {post.content && <p className="orbit-post-content">{renderPostContent(post.content)}</p>}
          {post.poll_options.length > 0 && <div className="orbit-poll-card"><div className="orbit-poll-options">{post.poll_options.map((option) => {
            const totalVotes = post.poll_options.reduce((total, item) => total + item.vote_count, 0);
            const percentage = totalVotes ? Math.round(option.vote_count / totalVotes * 100) : 0;
            const isSelected = post.user_vote_option_id === option.id;
            return <button key={option.id} type="button" className={`orbit-poll-option${isSelected ? ' is-selected' : ''}`} aria-pressed={isSelected} disabled={!authUserId || votingPostId === post.id} onClick={() => void onVote(post, option.id)}><span className="orbit-poll-option-copy"><span>{option.label}</span><strong>{percentage}%</strong></span><span className="orbit-poll-track"><span className="orbit-poll-progress" style={{ width: `${percentage}%` }} /></span></button>;
          })}</div><div className="orbit-poll-footer">{post.poll_options.reduce((total, option) => total + option.vote_count, 0)} votos · {post.user_vote_option_id ? 'Seu voto foi registrado' : 'Escolha uma opção'}</div></div>}
          {post.media_url && (post.media_type === 'video' ? <video className="orbit-post-media" src={post.media_url} controls preload="none" playsInline /> : <img className="orbit-post-media" src={post.media_url} alt="Mídia da publicação" loading="lazy" />)}
          <div className="orbit-post-actions"><div className="orbit-post-action-group"><button type="button" className={'orbit-like-button' + (post.liked_by_me ? ' is-liked' : '')} aria-pressed={post.liked_by_me} onClick={() => void onLike(post)}><Heart size={18} fill={post.liked_by_me ? 'currentColor' : 'none'} /><span>{post.like_count}</span><span className="orbit-like-label">Curtidas</span></button><button type="button" className={`orbit-comment-toggle${expandedComments[post.id] ? ' is-open' : ''}`} aria-expanded={!!expandedComments[post.id]} onClick={() => setExpandedComments((current) => ({ ...current, [post.id]: !current[post.id] }))}><MessageSquare size={17} /><span>Comentar</span><span>{post.comments.length}</span></button></div><span className="orbit-post-community"><Users size={15} /> {post.community.name}</span></div>
          {expandedComments[post.id] && <section className="orbit-comments" aria-label={`Comentários do post de ${post.author.display_name}`}>
            {post.comments.length === 0 ? <p className="orbit-comment-empty">Seja a primeira pessoa a comentar.</p> : <div className="orbit-comment-list">{post.comments.map((comment) => <div className="orbit-comment" key={comment.id}><div className="orbit-comment-avatar">{comment.author.display_name.slice(0, 1).toUpperCase()}</div><div className="orbit-comment-body"><div><strong>{comment.author.display_name}</strong><span>@{comment.author.handle}</span><time dateTime={comment.created_at}>{formatRelativeTime(comment.created_at, { message: true })}</time></div><p>{comment.content}</p></div></div>)}</div>}
            <form className="orbit-comment-form" onSubmit={(event) => void submitComment(post.id, event)}><input aria-label="Escreva um comentário" maxLength={2000} value={commentDrafts[post.id] || ''} onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))} placeholder="Escreva um comentário…" /><button type="submit" disabled={commentSubmittingPostId === post.id || !commentDrafts[post.id]?.trim()}>{commentSubmittingPostId === post.id ? <LoaderCircle className="orbit-spin" size={16} /> : <Send size={16} />}<span>Enviar</span></button></form>
          </section>}
        </article>)}</div> : hashtagFilter ? <div className="orbit-empty-state"><div className="orbit-empty-icon"><Search size={28} /></div><h2>Nenhum post com #{hashtagFilter}</h2><p>Tente outra hashtag ou limpe o filtro para voltar ao feed.</p><button type="button" className="orbit-secondary-button" onClick={() => setHashtagFilter('')}>Limpar filtro</button></div> : !backendError && <div className="orbit-empty-state"><div className="orbit-empty-icon"><Globe size={28} /></div><h2>{joinedCommunities.length ? 'Seu feed está começando' : 'Encontre sua comunidade'}</h2><p>{joinedCommunities.length ? 'Publique a primeira ideia ou acompanhe outra comunidade.' : 'Crie um espaço ou entre em uma comunidade para começar a conversar.'}</p>{joinedCommunities.length ? <button type="button" className="orbit-primary-button" onClick={() => openPostModal(joinedCommunities[0].id)}><Plus size={17} /> Criar primeiro post</button> : <button type="button" className="orbit-primary-button" disabled={!authUserId} onClick={openCommunityModal}><Plus size={17} /> Criar comunidade</button>}</div>}
        {loadingMore && <div className="orbit-loading orbit-loading-more"><LoaderCircle className="orbit-spin" size={19} /> Carregando mais posts…</div>}<div ref={sentinelRef} className="orbit-feed-sentinel" aria-hidden="true" />{!hasMore && posts.length > 0 && <p className="orbit-feed-end">Você chegou ao fim por enquanto.</p>}
      </section>

      <aside className="orbit-right-rail"><div className="orbit-info-card"><span className="orbit-info-icon"><Globe size={20} /></span><h3>Seu lugar no Orbit</h3><p>Descubra comunidades, compartilhe ideias e acompanhe conversas em um feed feito para você.</p><div className="orbit-info-stat"><Users size={16} /><span>{joinedIds.length} comunidades acompanhadas</span></div><div className="orbit-info-stat"><Camera size={16} /><span>Imagens via Cloudinary ou base64 temporário</span></div><div className="orbit-info-stat"><Video size={16} /><span>Rolagem carrega posts aos poucos</span></div><button type="button" className="orbit-secondary-button orbit-full-button" disabled={!authUserId} onClick={openCommunityModal}><Plus size={16} /> Criar comunidade</button></div></aside>
    </div>

    {modal && <div className="orbit-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !communitySaving && !postSaving) setModal(null); }}><section className="orbit-modal" role="dialog" aria-modal="true" aria-labelledby="orbit-modal-title">
      <button type="button" className="orbit-modal-close" aria-label="Fechar" disabled={communitySaving || postSaving} onClick={() => setModal(null)}><X size={19} /></button>
      {modal === 'community' ? <form onSubmit={submitCommunity}><span className="orbit-modal-kicker"><Globe size={16} /> UM NOVO ESPAÇO</span><h2 id="orbit-modal-title">Criar comunidade</h2><p className="orbit-modal-description">Escolha um nome; o endereço é criado automaticamente.</p>
        <label className="orbit-field">Nome da comunidade<input required maxLength={60} autoFocus value={communityName} onChange={(event) => setCommunityName(event.target.value)} placeholder="Ex.: Fotografia" /><small>koaline.com/orbit/{slugify(communityName || 'sua-comunidade')}</small></label>
        <label className="orbit-field">Descrição curta<textarea maxLength={240} rows={3} value={communityDescription} onChange={(event) => setCommunityDescription(event.target.value)} placeholder="Sobre o que é este espaço?" /></label>
        <label className="orbit-field">Banner da comunidade<input type="file" accept="image/*" onChange={(event) => setCommunityBanner(event.target.files?.[0] || null)} /></label>{!isOrbitMediaConfigured && <p className="orbit-inline-hint">Sem Cloudinary, a imagem será anexada temporariamente como base64.</p>}{bannerPreviewUrl && <img className="orbit-banner-preview" src={bannerPreviewUrl} alt="Prévia do banner" />}
        <div className="orbit-modal-actions"><button type="button" className="orbit-secondary-button" disabled={communitySaving} onClick={() => setModal(null)}>Cancelar</button><button type="submit" className="orbit-primary-button" disabled={communitySaving || !communityName.trim() || !authUserId}>{communitySaving ? <LoaderCircle className="orbit-spin" size={17} /> : <Check size={17} />} Criar</button></div>
      </form> : <form onSubmit={submitPost}><span className="orbit-modal-kicker"><Send size={16} /> COMPARTILHE COM SUA COMUNIDADE</span><h2 id="orbit-modal-title">Novo post</h2><p className="orbit-modal-description">Uma ideia, uma foto ou uma conversa para começar.</p>
        <label className="orbit-field">Comunidade<select required value={postCommunityId} onChange={(event) => setPostCommunityId(event.target.value)}>{joinedCommunities.map((community) => <option key={community.id} value={community.id}>{community.name}</option>)}</select></label>
        <div className="orbit-post-mode" role="group" aria-label="Tipo de publicação"><button type="button" className={postMode === 'post' ? 'is-active' : ''} onClick={() => setPostMode('post')}><Send size={15} /> Post</button><button type="button" className={postMode === 'poll' ? 'is-active' : ''} onClick={() => { setPostMode('poll'); setPostMedia(null); }}><span aria-hidden="true">%</span> Enquete</button></div>
        <label className="orbit-field">{postMode === 'poll' ? 'Qual é a pergunta?' : 'No que você está pensando?'}<textarea rows={5} maxLength={5000} value={postContent} onChange={(event) => setPostContent(event.target.value)} placeholder={postMode === 'poll' ? 'Ex.: Qual seu console favorito?' : 'Escreva algo para compartilhar…'} /></label>
        {postMode === 'poll' ? <div className="orbit-poll-editor"><span className="orbit-poll-editor-label">Opções · de 2 a 5</span>{pollOptions.map((option, index) => <div className="orbit-poll-input-row" key={`poll-option-${index}`}><input maxLength={120} value={option} onChange={(event) => setPollOptions((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`Opção ${index + 1}`} aria-label={`Opção ${index + 1}`} />{pollOptions.length > 2 && <button type="button" aria-label={`Remover opção ${index + 1}`} onClick={() => setPollOptions((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={16} /></button>}</div>)}{pollOptions.length < 5 && <button type="button" className="orbit-add-poll-option" onClick={() => setPollOptions((current) => [...current, ''])}><Plus size={15} /> Adicionar opção</button>}</div> : <>
          <label className="orbit-upload-zone"><ImagePlus size={19} /><span>{postMedia ? postMedia.name : 'Adicionar imagem ou vídeo'}</span><input type="file" accept="image/*,video/*" onChange={(event) => setPostMedia(event.target.files?.[0] || null)} /></label>
          {postPreviewUrl && (postMedia?.type.startsWith('video/') ? <video className="orbit-post-preview" src={postPreviewUrl} controls /> : <img className="orbit-post-preview" src={postPreviewUrl} alt="Prévia da mídia" />)}{!isOrbitMediaConfigured && <p className="orbit-inline-hint">Sem Cloudinary, a mídia será anexada temporariamente como base64.</p>}
        </>}
        <div className="orbit-modal-actions"><button type="button" className="orbit-secondary-button" disabled={postSaving} onClick={() => setModal(null)}>Cancelar</button><button type="submit" className="orbit-primary-button" disabled={postSaving || !postCommunityId || !postContent.trim() || (postMode === 'poll' && (pollOptions.filter((option) => option.trim()).length < 2 || pollOptions.filter((option) => option.trim()).length > 5)) || !authUserId}>{postSaving ? <LoaderCircle className="orbit-spin" size={17} /> : <Send size={16} />} Publicar</button></div>
      </form>}
    </section></div>}
  </div>;
};

export const OrbitPage = React.memo(OrbitPageComponent);



