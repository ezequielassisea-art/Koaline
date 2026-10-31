alter table public.community_members drop constraint if exists community_members_role_check;
alter table public.community_members add constraint community_members_role_check check (role in ('admin', 'moderator', 'member'));
create or replace function public.is_current_community_member(p_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.community_members where community_id = p_community_id and user_id = auth.uid());
$$;
revoke all on function public.is_current_community_member(uuid) from public;
grant execute on function public.is_current_community_member(uuid) to authenticated;
drop policy if exists orbit_members_read_community on public.community_members;
create policy orbit_members_read_community on public.community_members for select to authenticated using (
  public.is_current_community_member(community_id)
);

create table if not exists public.community_bans (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  banned_by uuid not null references auth.users(id),
  reason text not null default '',
  created_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
alter table public.community_bans enable row level security;
revoke all on public.community_bans from anon, authenticated;

create or replace function public.manage_community_member(
  p_community_id uuid,
  p_user_id uuid,
  p_action text,
  p_role text default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  community_owner_id uuid;
  actor_role text;
  target_role text;
begin
  if actor_id is null then raise exception 'Faça login para moderar a comunidade.'; end if;
  if actor_id = p_user_id then raise exception 'Você não pode moderar a própria conta.'; end if;

  select created_by into community_owner_id from public.communities where id = p_community_id;
  if community_owner_id is null then raise exception 'Comunidade não encontrada.'; end if;
  select role into actor_role from public.community_members where community_id = p_community_id and user_id = actor_id;
  if actor_id <> community_owner_id and coalesce(actor_role, '') not in ('admin', 'moderator') then
    raise exception 'Você não tem permissão para moderar esta comunidade.';
  end if;

  select role into target_role from public.community_members where community_id = p_community_id and user_id = p_user_id;
  if target_role is null then raise exception 'Este usuário não é membro da comunidade.'; end if;
  if p_user_id = community_owner_id then raise exception 'O dono da comunidade não pode ser moderado.'; end if;
  if target_role = 'admin' and actor_id <> community_owner_id then raise exception 'Somente o dono pode moderar outro administrador.'; end if;

  if p_action = 'role' then
    if p_role is null or p_role not in ('admin', 'moderator', 'member') then raise exception 'Cargo inválido.'; end if;
    if p_role = 'admin' and actor_id <> community_owner_id then raise exception 'Somente o dono pode nomear administradores.'; end if;
    update public.community_members set role = p_role where community_id = p_community_id and user_id = p_user_id;
  elsif p_action = 'kick' then
    delete from public.community_members where community_id = p_community_id and user_id = p_user_id;
  elsif p_action = 'ban' then
    insert into public.community_bans (community_id, user_id, banned_by, reason)
    values (p_community_id, p_user_id, actor_id, left(coalesce(p_reason, ''), 500))
    on conflict (community_id, user_id) do update set banned_by = excluded.banned_by, reason = excluded.reason, created_at = now();
    delete from public.community_members where community_id = p_community_id and user_id = p_user_id;
  else
    raise exception 'Ação de moderação inválida.';
  end if;
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
  if exists (select 1 from public.community_bans b where b.community_id = p_community_id and b.user_id = auth.uid()) then raise exception 'Você foi banido desta comunidade.'; end if;
  insert into public.community_members (community_id, user_id, role) values (p_community_id, auth.uid(), 'member') on conflict (community_id, user_id) do nothing;
  return true;
end;
$$;

create table if not exists public.user_friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requester_id, recipient_id),
  check (requester_id <> recipient_id)
);
alter table public.user_friend_requests enable row level security;
create index if not exists user_friend_requests_recipient_idx on public.user_friend_requests (recipient_id, status);
drop policy if exists user_friend_requests_read_participant on public.user_friend_requests;
create policy user_friend_requests_read_participant on public.user_friend_requests for select to authenticated
  using (requester_id = auth.uid() or recipient_id = auth.uid());
revoke all on public.user_friend_requests from anon;
grant select on public.user_friend_requests to authenticated;

create or replace function public.user_friendship_status(p_target_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.user_friend_requests;
begin
  if auth.uid() is null or p_target_user_id = auth.uid() then return 'none'; end if;
  select * into request_row from public.user_friend_requests
  where (requester_id = auth.uid() and recipient_id = p_target_user_id)
     or (requester_id = p_target_user_id and recipient_id = auth.uid())
  limit 1;
  if not found then return 'none'; end if;
  if request_row.status = 'accepted' then return 'accepted'; end if;
  return case when request_row.requester_id = auth.uid() then 'pending_sent' else 'pending_received' end;
end;
$$;

create or replace function public.toggle_user_friendship(p_target_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.user_friend_requests;
begin
  if auth.uid() is null then raise exception 'Faça login para gerenciar amizades.'; end if;
  if p_target_user_id = auth.uid() then raise exception 'Não é possível adicionar a própria conta.'; end if;
  select * into request_row from public.user_friend_requests
  where (requester_id = auth.uid() and recipient_id = p_target_user_id)
     or (requester_id = p_target_user_id and recipient_id = auth.uid())
  for update;
  if not found then
    insert into public.user_friend_requests (requester_id, recipient_id) values (auth.uid(), p_target_user_id);
    return 'sent';
  elsif request_row.status = 'accepted' then
    delete from public.user_friend_requests where id = request_row.id;
    return 'removed';
  elsif request_row.recipient_id = auth.uid() then
    update public.user_friend_requests set status = 'accepted', updated_at = now() where id = request_row.id;
    return 'accepted';
  else
    delete from public.user_friend_requests where id = request_row.id;
    return 'cancelled';
  end if;
end;
$$;

revoke all on function public.manage_community_member(uuid, uuid, text, text, text) from public;
revoke all on function public.user_friendship_status(uuid) from public;
revoke all on function public.toggle_user_friendship(uuid) from public;
grant execute on function public.manage_community_member(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.user_friendship_status(uuid) to authenticated;
grant execute on function public.toggle_user_friendship(uuid) to authenticated;
grant execute on function public.join_orbit_community(uuid) to anon, authenticated;
