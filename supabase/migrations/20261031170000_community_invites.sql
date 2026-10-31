create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Users read own notifications" on public.notifications;
create policy "Users read own notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Community admins send invitations" on public.notifications;
create policy "Community admins send invitations"
  on public.notifications for insert to authenticated
  with check (
    type = 'community_invite'
    and sender_id = auth.uid()
    and user_id <> auth.uid()
    and exists (
      select 1 from public.communities c
      where c.id = (payload->>'community_id')::uuid
        and (
          c.created_by = auth.uid()
          or exists (
            select 1 from public.community_members cm
            where cm.community_id = c.id
              and cm.user_id = auth.uid()
              and cm.role in ('owner', 'admin')
          )
        )
    )
  );

drop policy if exists "Users mark own notifications read" on public.notifications;
create policy "Users mark own notifications read"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Inviters remove failed invitations" on public.notifications;
create policy "Inviters remove failed invitations"
  on public.notifications for delete to authenticated
  using (sender_id = auth.uid());

grant select, insert, update, delete on public.notifications to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
