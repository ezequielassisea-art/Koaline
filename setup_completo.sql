-- Koaline! - schema consolidado para Supabase
-- Execute no SQL Editor do projeto Supabase. Pode ser reaplicado sem recriar dados.

create extension if not exists pgcrypto;

-- 1. Perfis ligados às contas do Supabase Auth
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  full_name text not null default '',
  email text,
  avatar_url text,
  banner_url text,
  bio text not null default '',
  status text not null default 'online' check (status in ('online','idle','dnd','offline')),
  custom_status jsonb not null default '{}'::jsonb,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  chosen_username text;
begin
  chosen_username := lower(coalesce(nullif(new.raw_user_meta_data->>'username',''), 'user_' || left(new.id::text, 12)));
  if exists (select 1 from public.profiles p where p.username = chosen_username and p.id <> new.id) then
    chosen_username := chosen_username || '_' || left(new.id::text, 6);
  end if;
  insert into public.profiles (id, username, full_name, email, avatar_url)
  values (
    new.id,
    chosen_username,
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''), nullif(new.raw_user_meta_data->>'name',''), ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name,''), public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_koaline on auth.users;
create trigger on_auth_user_created_koaline
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- 2. Comunidades/servidores. Colunas base mantêm compatibilidade com Orbit.
create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  slug text not null unique,
  description text not null default '' check (char_length(description) <= 240),
  banner_url text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  owner_id uuid references public.profiles(id) on delete set null,
  icon_url text,
  visibility text not null default 'public' check (visibility in ('public','private')),
  updated_at timestamptz not null default now()
);
alter table public.communities add column if not exists owner_id uuid references public.profiles(id) on delete set null;
alter table public.communities add column if not exists icon_url text;
alter table public.communities add column if not exists visibility text not null default 'public';
alter table public.communities add column if not exists updated_at timestamptz not null default now();

create table if not exists public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','moderator','member')),
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
alter table public.community_members drop constraint if exists community_members_role_check;
alter table public.community_members add constraint community_members_role_check check (role in ('owner','admin','moderator','member'));

create table if not exists public.community_categories (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (community_id, name)
);

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  category_id uuid references public.community_categories(id) on delete set null,
  name text not null,
  type text not null check (type in ('text','voice')),
  topic text not null default '',
  position integer not null default 0,
  is_private boolean not null default false,
  is_default boolean not null default false,
  is_archived boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (community_id, name)
);

-- 3. Mensagens e reações
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null default '',
  reply_to uuid references public.messages(id) on delete set null,
  attachments jsonb not null default '[]'::jsonb,
  edited_at timestamptz,
  deleted_at timestamptz,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  check (char_length(content) <= 10000)
);

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create table if not exists public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.direct_conversation_members (
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  reply_to uuid references public.direct_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  check (char_length(content) <= 10000)
);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_id <> recipient_id),
  unique (sender_id, recipient_id)
);

-- 4. Administração e configurações do grupo
create table if not exists public.community_roles (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null,
  color text not null default '#00BFFF',
  permissions text[] not null default '{}',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (community_id, name)
);
create table if not exists public.community_role_members (
  role_id uuid not null references public.community_roles(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (role_id, user_id),
  foreign key (community_id, user_id) references public.community_members(community_id, user_id) on delete cascade
);
create table if not exists public.community_bans (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  banned_by uuid not null references public.profiles(id) on delete cascade,
  reason text not null default '',
  created_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
create table if not exists public.community_invites (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  uses integer not null default 0 check (uses >= 0),
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.community_settings (
  community_id uuid primary key references public.communities(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.community_soundboard (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null,
  emoji text not null default '🔊',
  audio_url text not null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 5. Orbit: perfis públicos, comunidades, posts e curtidas
create table if not exists public.orbit_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Membro Koaline',
  handle text not null default '',
  avatar_url text,
  updated_at timestamptz not null default now()
);
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null default '' check (char_length(content) <= 5000),
  media_url text,
  media_type text check (media_type in ('image','video') or media_type is null),
  created_at timestamptz not null default now(),
  check (char_length(trim(content)) > 0 or media_url is not null)
);
create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- 6. Preferências e notificações do usuário
create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Helpers SECURITY DEFINER para evitar recursão nas políticas RLS.
create or replace function public.is_community_member(p_community_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.community_members m where m.community_id = p_community_id and m.user_id = auth.uid())
$$;
create or replace function public.is_community_admin(p_community_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.community_members m where m.community_id = p_community_id and m.user_id = auth.uid() and m.role in ('owner','admin','moderator'))
$$;
create or replace function public.is_direct_conversation_member(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.direct_conversation_members m where m.conversation_id = p_conversation_id and m.user_id = auth.uid())
$$;

-- 7. Índices
create index if not exists profiles_username_search_idx on public.profiles using btree (lower(username));
create index if not exists community_members_user_idx on public.community_members (user_id, community_id);
create index if not exists channels_community_position_idx on public.channels (community_id, position);
create index if not exists messages_channel_created_idx on public.messages (channel_id, created_at desc);
create index if not exists direct_messages_conversation_created_idx on public.direct_messages (conversation_id, created_at desc);
create index if not exists friend_requests_recipient_status_idx on public.friend_requests (recipient_id, status, created_at desc);
create index if not exists orbit_posts_community_created_idx on public.posts (community_id, created_at desc, id desc);
create index if not exists orbit_posts_author_idx on public.posts (author_id, created_at desc);
create index if not exists orbit_likes_post_idx on public.post_likes (post_id);
create index if not exists community_invites_code_idx on public.community_invites (code) where not revoked;
create index if not exists community_soundboard_group_idx on public.community_soundboard (community_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;

-- 8. Ativar RLS em todas as tabelas públicas
do $$ declare t text; begin
  foreach t in array array['profiles','communities','community_members','community_categories','channels','messages','message_reactions','direct_conversations','direct_conversation_members','direct_messages','friend_requests','community_roles','community_role_members','community_bans','community_invites','community_settings','community_soundboard','audit_logs','orbit_profiles','posts','post_likes','user_settings','notifications'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Perfis: busca por username disponível a usuários autenticados; gravação somente no próprio perfil.
drop policy if exists profiles_search_authenticated on public.profiles;
create policy profiles_search_authenticated on public.profiles for select to authenticated using (true);
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Comunidades e membros
drop policy if exists communities_read_public_or_member on public.communities;
create policy communities_read_public_or_member on public.communities for select to authenticated using (visibility = 'public' or public.is_community_member(id));
drop policy if exists communities_create_self on public.communities;
create policy communities_create_self on public.communities for insert to authenticated with check (created_by = auth.uid());
drop policy if exists communities_update_admin on public.communities;
create policy communities_update_admin on public.communities for update to authenticated using (public.is_community_admin(id)) with check (public.is_community_admin(id));
drop policy if exists communities_delete_admin on public.communities;
create policy communities_delete_admin on public.communities for delete to authenticated using (public.is_community_admin(id));
drop policy if exists community_members_read_self_or_admin on public.community_members;
create policy community_members_read_self_or_admin on public.community_members for select to authenticated using (user_id = auth.uid() or public.is_community_admin(community_id));
drop policy if exists community_members_join_self on public.community_members;
create policy community_members_join_self on public.community_members for insert to authenticated with check (user_id = auth.uid() and role = 'member');
drop policy if exists community_members_manage_admin on public.community_members;
create policy community_members_manage_admin on public.community_members for all to authenticated using (public.is_community_admin(community_id)) with check (public.is_community_admin(community_id));

-- Canais, mensagens e reações
drop policy if exists categories_read_member on public.community_categories;
create policy categories_read_member on public.community_categories for select to authenticated using (public.is_community_member(community_id));
drop policy if exists categories_manage_admin on public.community_categories;
create policy categories_manage_admin on public.community_categories for all to authenticated using (public.is_community_admin(community_id)) with check (public.is_community_admin(community_id));
drop policy if exists channels_read_member on public.channels;
create policy channels_read_member on public.channels for select to authenticated using (public.is_community_member(community_id));
drop policy if exists channels_manage_admin on public.channels;
create policy channels_manage_admin on public.channels for all to authenticated using (public.is_community_admin(community_id)) with check (public.is_community_admin(community_id));
drop policy if exists messages_read_member on public.messages;
create policy messages_read_member on public.messages for select to authenticated using (exists (select 1 from public.channels c where c.id = channel_id and public.is_community_member(c.community_id)));
drop policy if exists messages_insert_self on public.messages;
create policy messages_insert_self on public.messages for insert to authenticated with check (author_id = auth.uid() and exists (select 1 from public.channels c where c.id = channel_id and public.is_community_member(c.community_id)));
drop policy if exists messages_update_author on public.messages;
create policy messages_update_author on public.messages for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists messages_delete_author_or_admin on public.messages;
create policy messages_delete_author_or_admin on public.messages for delete to authenticated using (author_id = auth.uid() or exists (select 1 from public.channels c where c.id = channel_id and public.is_community_admin(c.community_id)));
drop policy if exists reactions_read_member on public.message_reactions;
create policy reactions_read_member on public.message_reactions for select to authenticated using (exists (select 1 from public.messages m join public.channels c on c.id = m.channel_id where m.id = message_id and public.is_community_member(c.community_id)));
drop policy if exists reactions_insert_self on public.message_reactions;
create policy reactions_insert_self on public.message_reactions for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.messages m join public.channels c on c.id = m.channel_id where m.id = message_id and public.is_community_member(c.community_id)));
drop policy if exists reactions_delete_self on public.message_reactions;
create policy reactions_delete_self on public.message_reactions for delete to authenticated using (user_id = auth.uid());

-- DMs: somente participantes podem consultar ou escrever.
drop policy if exists dm_conversations_read_member on public.direct_conversations;
create policy dm_conversations_read_member on public.direct_conversations for select to authenticated using (public.is_direct_conversation_member(id));
drop policy if exists dm_members_read_self_or_peer on public.direct_conversation_members;
create policy dm_members_read_self_or_peer on public.direct_conversation_members for select to authenticated using (public.is_direct_conversation_member(conversation_id));
drop policy if exists dm_members_insert_self on public.direct_conversation_members;
create policy dm_members_insert_self on public.direct_conversation_members for insert to authenticated with check (user_id = auth.uid());
drop policy if exists dm_messages_read_member on public.direct_messages;
create policy dm_messages_read_member on public.direct_messages for select to authenticated using (public.is_direct_conversation_member(conversation_id));
drop policy if exists dm_messages_insert_self on public.direct_messages;
create policy dm_messages_insert_self on public.direct_messages for insert to authenticated with check (author_id = auth.uid() and public.is_direct_conversation_member(conversation_id));
drop policy if exists dm_messages_update_author on public.direct_messages;
create policy dm_messages_update_author on public.direct_messages for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());

-- Amizades
drop policy if exists friend_requests_read_participant on public.friend_requests;
create policy friend_requests_read_participant on public.friend_requests for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());
drop policy if exists friend_requests_insert_sender on public.friend_requests;
create policy friend_requests_insert_sender on public.friend_requests for insert to authenticated with check (sender_id = auth.uid());
drop policy if exists friend_requests_update_participant on public.friend_requests;
create policy friend_requests_update_participant on public.friend_requests for update to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid()) with check (sender_id = auth.uid() or recipient_id = auth.uid());
drop policy if exists friend_requests_delete_participant on public.friend_requests;
create policy friend_requests_delete_participant on public.friend_requests for delete to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());

-- Administração: acesso condicionado ao cargo do grupo.
drop policy if exists roles_read_member on public.community_roles;
create policy roles_read_member on public.community_roles for select to authenticated using (public.is_community_member(community_id));
drop policy if exists roles_manage_admin on public.community_roles;
create policy roles_manage_admin on public.community_roles for all to authenticated using (public.is_community_admin(community_id)) with check (public.is_community_admin(community_id));
drop policy if exists role_members_read_member on public.community_role_members;
create policy role_members_read_member on public.community_role_members for select to authenticated using (public.is_community_member(community_id));
drop policy if exists role_members_manage_admin on public.community_role_members;
create policy role_members_manage_admin on public.community_role_members for all to authenticated using (public.is_community_admin(community_id)) with check (public.is_community_admin(community_id));
drop policy if exists bans_read_admin on public.community_bans;
create policy bans_read_admin on public.community_bans for select to authenticated using (public.is_community_admin(community_id));
drop policy if exists bans_manage_admin on public.community_bans;
create policy bans_manage_admin on public.community_bans for all to authenticated using (public.is_community_admin(community_id)) with check (public.is_community_admin(community_id));
drop policy if exists invites_read_admin on public.community_invites;
create policy invites_read_admin on public.community_invites for select to authenticated using (public.is_community_admin(community_id));
drop policy if exists invites_manage_admin on public.community_invites;
create policy invites_manage_admin on public.community_invites for all to authenticated using (public.is_community_admin(community_id)) with check (public.is_community_admin(community_id));
drop policy if exists settings_read_member on public.community_settings;
create policy settings_read_member on public.community_settings for select to authenticated using (public.is_community_member(community_id));
drop policy if exists settings_manage_admin on public.community_settings;
create policy settings_manage_admin on public.community_settings for all to authenticated using (public.is_community_admin(community_id)) with check (public.is_community_admin(community_id));
drop policy if exists soundboard_read_member on public.community_soundboard;
create policy soundboard_read_member on public.community_soundboard for select to authenticated using (public.is_community_member(community_id));
drop policy if exists soundboard_manage_admin on public.community_soundboard;
create policy soundboard_manage_admin on public.community_soundboard for all to authenticated using (public.is_community_admin(community_id)) with check (public.is_community_admin(community_id));
drop policy if exists audit_read_admin on public.audit_logs;
create policy audit_read_admin on public.audit_logs for select to authenticated using (public.is_community_admin(community_id));
drop policy if exists audit_insert_actor on public.audit_logs;
create policy audit_insert_actor on public.audit_logs for insert to authenticated with check (actor_id = auth.uid() and public.is_community_admin(community_id));

-- Orbit e busca pública de posts. Busca de perfis permanece autenticada.
drop policy if exists orbit_profiles_read on public.orbit_profiles;
create policy orbit_profiles_read on public.orbit_profiles for select to authenticated using (true);
drop policy if exists orbit_profiles_insert_self on public.orbit_profiles;
create policy orbit_profiles_insert_self on public.orbit_profiles for insert to authenticated with check (user_id = auth.uid());
drop policy if exists orbit_profiles_update_self on public.orbit_profiles;
create policy orbit_profiles_update_self on public.orbit_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists orbit_communities_read on public.communities;
create policy orbit_communities_read on public.communities for select to authenticated using (visibility = 'public' or public.is_community_member(id));
drop policy if exists orbit_communities_create on public.communities;
create policy orbit_communities_create on public.communities for insert to authenticated with check (created_by = auth.uid());
drop policy if exists orbit_members_read_self on public.community_members;
create policy orbit_members_read_self on public.community_members for select to authenticated using (user_id = auth.uid() or public.is_community_admin(community_id));
drop policy if exists orbit_members_join_self on public.community_members;
create policy orbit_members_join_self on public.community_members for insert to authenticated with check (user_id = auth.uid() and role = 'member');
drop policy if exists orbit_posts_read_members on public.posts;
create policy orbit_posts_read_members on public.posts for select to authenticated using (public.is_community_member(community_id));
drop policy if exists orbit_posts_create_members on public.posts;
create policy orbit_posts_create_members on public.posts for insert to authenticated with check (author_id = auth.uid() and public.is_community_member(community_id));
drop policy if exists orbit_posts_update_author on public.posts;
create policy orbit_posts_update_author on public.posts for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists orbit_posts_delete_author on public.posts;
create policy orbit_posts_delete_author on public.posts for delete to authenticated using (author_id = auth.uid());
drop policy if exists orbit_likes_read_community on public.post_likes;
create policy orbit_likes_read_community on public.post_likes for select to authenticated using (exists (select 1 from public.posts p where p.id = post_id and public.is_community_member(p.community_id)));
drop policy if exists orbit_likes_insert_self on public.post_likes;
create policy orbit_likes_insert_self on public.post_likes for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id and public.is_community_member(p.community_id)));
drop policy if exists orbit_likes_delete_self on public.post_likes;
create policy orbit_likes_delete_self on public.post_likes for delete to authenticated using (user_id = auth.uid());

-- RPCs usadas pelo frontend do Orbit para criar comunidade e entrar atomicamente.
create or replace function public.create_orbit_community(p_name text, p_slug text, p_description text default '', p_banner_url text default null)
returns public.communities language plpgsql security definer set search_path = public as $$
declare created public.communities;
begin
  if auth.uid() is null then raise exception 'É necessário iniciar uma sessão para criar comunidades.'; end if;
  if char_length(trim(coalesce(p_name,''))) not between 1 and 60 then raise exception 'O nome deve ter entre 1 e 60 caracteres.'; end if;
  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'O endereço da comunidade é inválido.'; end if;
  insert into public.communities (name, slug, description, banner_url, created_by, owner_id)
  values (trim(p_name), p_slug, left(trim(coalesce(p_description,'')),240), p_banner_url, auth.uid(), auth.uid()) returning * into created;
  insert into public.community_members (community_id, user_id, role) values (created.id, auth.uid(), 'owner');
  return created;
end;
$$;
create or replace function public.join_orbit_community(p_community_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'É necessário iniciar uma sessão para entrar em comunidades.'; end if;
  if not exists (select 1 from public.communities c where c.id = p_community_id) then raise exception 'Comunidade não encontrada.'; end if;
  insert into public.community_members (community_id, user_id, role) values (p_community_id, auth.uid(), 'member') on conflict (community_id,user_id) do nothing;
  return true;
end;
$$;

-- Grants: RLS continua sendo a camada de autorização.
grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.communities, public.community_members, public.community_categories, public.channels, public.messages, public.message_reactions, public.direct_conversations, public.direct_conversation_members, public.direct_messages, public.friend_requests, public.community_roles, public.community_role_members, public.community_bans, public.community_invites, public.community_settings, public.community_soundboard, public.audit_logs, public.orbit_profiles, public.posts, public.post_likes, public.user_settings, public.notifications to authenticated;
grant execute on function public.create_orbit_community(text,text,text,text) to authenticated;
grant execute on function public.join_orbit_community(uuid) to authenticated;

-- DMs: criar uma conversa com os dois participantes dentro de uma única operação segura.
create or replace function public.get_or_create_direct_conversation(p_other_user uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_self uuid := auth.uid();
  v_conversation uuid;
begin
  if v_self is null then raise exception 'É necessário iniciar uma sessão.'; end if;
  if p_other_user is null or p_other_user = v_self then raise exception 'Selecione outro usuário.'; end if;
  if not exists (select 1 from public.profiles where id = p_other_user) then raise exception 'Perfil não encontrado.'; end if;

  perform pg_advisory_xact_lock(hashtextextended(least(v_self::text, p_other_user::text) || ':' || greatest(v_self::text, p_other_user::text), 0));
  select mine.conversation_id into v_conversation
  from public.direct_conversation_members mine
  join public.direct_conversation_members peer on peer.conversation_id = mine.conversation_id
  where mine.user_id = v_self and peer.user_id = p_other_user
  limit 1;

  if v_conversation is null then
    insert into public.direct_conversations default values returning id into v_conversation;
    insert into public.direct_conversation_members (conversation_id, user_id)
    values (v_conversation, v_self), (v_conversation, p_other_user);
  end if;
  return v_conversation;
end;
$$;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;

-- Ativa eventos Postgres Changes para o chat em tempo real, sem erro se já estiver publicado.
do $$
declare t text;
begin
  foreach t in array array['messages','direct_messages'] loop
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
      and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Preferências e notificações pessoais
drop policy if exists user_settings_self on public.user_settings;
create policy user_settings_self on public.user_settings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notifications_self on public.notifications;
create policy notifications_self on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
