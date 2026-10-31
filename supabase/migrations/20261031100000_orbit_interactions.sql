create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.post_poll_options (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 120),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, post_id),
  unique (post_id, position)
);

create table if not exists public.post_poll_votes (
  post_id uuid not null references public.posts(id) on delete cascade,
  option_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id),
  foreign key (option_id, post_id) references public.post_poll_options(id, post_id) on delete cascade
);

create index if not exists orbit_post_comments_post_created_idx on public.post_comments (post_id, created_at);
create index if not exists orbit_poll_options_post_position_idx on public.post_poll_options (post_id, position);
create index if not exists orbit_poll_votes_option_idx on public.post_poll_votes (option_id);

alter table public.post_comments enable row level security;
alter table public.post_poll_options enable row level security;
alter table public.post_poll_votes enable row level security;

drop policy if exists orbit_comments_read_members on public.post_comments;
create policy orbit_comments_read_members on public.post_comments for select to authenticated using (
  exists (
    select 1 from public.posts p
    join public.community_members m on m.community_id = p.community_id
    where p.id = post_comments.post_id and m.user_id = auth.uid()
  )
);
drop policy if exists orbit_comments_insert_members on public.post_comments;
create policy orbit_comments_insert_members on public.post_comments for insert to authenticated with check (
  author_id = auth.uid() and exists (
    select 1 from public.posts p
    join public.community_members m on m.community_id = p.community_id
    where p.id = post_comments.post_id and m.user_id = auth.uid()
  )
);

drop policy if exists orbit_poll_options_read_members on public.post_poll_options;
create policy orbit_poll_options_read_members on public.post_poll_options for select to authenticated using (
  exists (
    select 1 from public.posts p
    join public.community_members m on m.community_id = p.community_id
    where p.id = post_poll_options.post_id and m.user_id = auth.uid()
  )
);
drop policy if exists orbit_poll_options_insert_author on public.post_poll_options;
create policy orbit_poll_options_insert_author on public.post_poll_options for insert to authenticated with check (
  exists (
    select 1 from public.posts p
    join public.community_members m on m.community_id = p.community_id
    where p.id = post_poll_options.post_id and p.author_id = auth.uid() and m.user_id = auth.uid()
  )
);

drop policy if exists orbit_poll_votes_read_members on public.post_poll_votes;
create policy orbit_poll_votes_read_members on public.post_poll_votes for select to authenticated using (
  exists (
    select 1 from public.posts p
    join public.community_members m on m.community_id = p.community_id
    where p.id = post_poll_votes.post_id and m.user_id = auth.uid()
  )
);
drop policy if exists orbit_poll_votes_insert_self on public.post_poll_votes;
create policy orbit_poll_votes_insert_self on public.post_poll_votes for insert to authenticated with check (
  user_id = auth.uid() and exists (
    select 1 from public.posts p
    join public.community_members m on m.community_id = p.community_id
    where p.id = post_poll_votes.post_id and m.user_id = auth.uid()
  )
);
drop policy if exists orbit_poll_votes_update_self on public.post_poll_votes;
create policy orbit_poll_votes_update_self on public.post_poll_votes for update to authenticated using (
  user_id = auth.uid() and exists (
    select 1 from public.posts p
    join public.community_members m on m.community_id = p.community_id
    where p.id = post_poll_votes.post_id and m.user_id = auth.uid()
  )
) with check (
  user_id = auth.uid() and exists (
    select 1 from public.posts p
    join public.community_members m on m.community_id = p.community_id
    where p.id = post_poll_votes.post_id and m.user_id = auth.uid()
  )
);

grant select, insert on public.post_comments to authenticated;
grant select, insert on public.post_poll_options to authenticated;
grant select, insert, update on public.post_poll_votes to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'post_comments') then
      alter publication supabase_realtime add table public.post_comments;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'post_poll_votes') then
      alter publication supabase_realtime add table public.post_poll_votes;
    end if;
  end if;
end;
$$;
