alter table if exists public.direct_conversations
  add column if not exists is_system boolean not null default false;
