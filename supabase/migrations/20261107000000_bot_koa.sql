-- Add is_bot column to profiles table
alter table public.profiles
add column if not exists is_bot boolean not null default false;

-- Create index for faster bot queries
create index if not exists profiles_is_bot_idx on public.profiles (is_bot);

-- Insert the Koa bot profile with fixed UUID
insert into public.profiles (id, username, full_name, avatar_url, onboarding_completed, is_bot)
values (
  '00000000-0000-0000-0000-000000000000',
  'koa',
  'Koa',
  'https://api.dicebear.com/7.x/bottts/svg?seed=koa',
  true,
  true
)
on conflict (id) do update set
  username = excluded.username,
  full_name = excluded.full_name,
  avatar_url = excluded.avatar_url,
  onboarding_completed = excluded.onboarding_completed,
  is_bot = excluded.is_bot;

-- Add role 'bot' to community_members table (extend the check constraint)
-- First, drop the existing constraint
alter table public.community_members
drop constraint if exists community_members_role_check;

-- Add new constraint with 'bot' role
alter table public.community_members
add constraint community_members_role_check
check (role in ('admin', 'moderator', 'member', 'bot'));