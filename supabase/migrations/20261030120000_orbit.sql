create extension if not exists pgcrypto;

create table if not exists public.orbit_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Membro Koaline',
  handle text not null default '',
  avatar_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  slug text not null unique,
  description text not null default '' check (char_length(description) <= 240),
  banner_url text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null default '' check (char_length(content) <= 5000),
  media_url text,
  media_type text check (media_type in ('image', 'video') or media_type is null),
  created_at timestamptz not null default now(),
  check (char_length(trim(content)) > 0 or media_url is not null)
);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists orbit_posts_community_created_idx on public.posts (community_id, created_at desc, id desc);
create index if not exists orbit_posts_author_idx on public.posts (author_id, created_at desc);
create index if not exists orbit_members_user_idx on public.community_members (user_id, community_id);
create index if not exists orbit_likes_post_idx on public.post_likes (post_id);

alter table public.orbit_profiles enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;

drop policy if exists orbit_profiles_read on public.orbit_profiles;
create policy orbit_profiles_read on public.orbit_profiles for select to anon, authenticated using (true);
drop policy if exists orbit_profiles_insert_self on public.orbit_profiles;
create policy orbit_profiles_insert_self on public.orbit_profiles for insert to anon, authenticated with check (user_id = auth.uid());
drop policy if exists orbit_profiles_update_self on public.orbit_profiles;
create policy orbit_profiles_update_self on public.orbit_profiles for update to anon, authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists orbit_communities_read on public.communities;
create policy orbit_communities_read on public.communities for select to anon, authenticated using (true);
drop policy if exists orbit_communities_create on public.communities;
create policy orbit_communities_create on public.communities for insert to anon, authenticated with check (created_by = auth.uid());
drop policy if exists orbit_communities_admin_update on public.communities;
create policy orbit_communities_admin_update on public.communities for update to anon, authenticated using (
  exists (select 1 from public.community_members m where m.community_id = communities.id and m.user_id = auth.uid() and m.role = 'admin')
) with check (
  exists (select 1 from public.community_members m where m.community_id = communities.id and m.user_id = auth.uid() and m.role = 'admin')
);

drop policy if exists orbit_members_read_self on public.community_members;
create policy orbit_members_read_self on public.community_members for select to anon, authenticated using (user_id = auth.uid());
drop policy if exists orbit_members_join_self on public.community_members;
create policy orbit_members_join_self on public.community_members for insert to anon, authenticated with check (user_id = auth.uid() and role = 'member');

drop policy if exists orbit_posts_read_members on public.posts;
create policy orbit_posts_read_members on public.posts for select to anon, authenticated using (
  exists (select 1 from public.community_members m where m.community_id = posts.community_id and m.user_id = auth.uid())
);
drop policy if exists orbit_posts_create_members on public.posts;
create policy orbit_posts_create_members on public.posts for insert to anon, authenticated with check (
  author_id = auth.uid() and exists (
    select 1 from public.community_members m where m.community_id = posts.community_id and m.user_id = auth.uid()
  )
);
drop policy if exists orbit_posts_update_author on public.posts;
create policy orbit_posts_update_author on public.posts for update to anon, authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists orbit_posts_delete_author on public.posts;
create policy orbit_posts_delete_author on public.posts for delete to anon, authenticated using (author_id = auth.uid());

drop policy if exists orbit_likes_read_community on public.post_likes;
create policy orbit_likes_read_community on public.post_likes for select to anon, authenticated using (
  exists (select 1 from public.posts p join public.community_members m on m.community_id = p.community_id where p.id = post_likes.post_id and m.user_id = auth.uid())
);
drop policy if exists orbit_likes_insert_self on public.post_likes;
create policy orbit_likes_insert_self on public.post_likes for insert to anon, authenticated with check (
  user_id = auth.uid() and exists (
    select 1 from public.posts p join public.community_members m on m.community_id = p.community_id
    where p.id = post_likes.post_id and m.user_id = auth.uid()
  )
);
drop policy if exists orbit_likes_delete_self on public.post_likes;
create policy orbit_likes_delete_self on public.post_likes for delete to anon, authenticated using (user_id = auth.uid());

create or replace function public.create_orbit_community(p_name text, p_slug text, p_description text default '', p_banner_url text default null)
returns public.communities
language plpgsql
security definer
set search_path = public
as $$
declare
  created public.communities;
begin
  if auth.uid() is null then raise exception 'É necessário iniciar uma sessão para criar comunidades.'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 60 then raise exception 'O nome deve ter entre 1 e 60 caracteres.'; end if;
  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'O endereço da comunidade é inválido.'; end if;
  insert into public.communities (name, slug, description, banner_url, created_by)
  values (trim(p_name), p_slug, left(trim(coalesce(p_description, '')), 240), p_banner_url, auth.uid())
  returning * into created;
  insert into public.community_members (community_id, user_id, role) values (created.id, auth.uid(), 'admin');
  return created;
end;
$$;

create or replace function public.join_orbit_community(p_community_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'É necessário iniciar uma sessão para entrar em comunidades.'; end if;
  if not exists (select 1 from public.communities c where c.id = p_community_id) then raise exception 'Comunidade não encontrada.'; end if;
  insert into public.community_members (community_id, user_id, role) values (p_community_id, auth.uid(), 'member') on conflict (community_id, user_id) do nothing;
  return true;
end;
$$;

revoke all on function public.create_orbit_community(text, text, text, text) from public;
grant execute on function public.create_orbit_community(text, text, text, text) to anon, authenticated;
revoke all on function public.join_orbit_community(uuid) from public;
grant execute on function public.join_orbit_community(uuid) to anon, authenticated;
grant select, insert, update on public.orbit_profiles to anon, authenticated;
grant select, insert, update on public.communities to anon, authenticated;
grant select, insert on public.community_members to anon, authenticated;
grant select, insert, update, delete on public.posts to anon, authenticated;
grant select, insert, delete on public.post_likes to anon, authenticated;
