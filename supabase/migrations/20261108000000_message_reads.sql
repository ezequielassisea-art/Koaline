-- Create message_reads table to track message read status for both DMs and group chats
create table if not exists public.message_reads (
  id uuid not null default gen_random_uuid(),
  message_id uuid not null,
  user_id uuid not null,
  read_at timestamp with time zone not null default now(),
  constraint message_reads_pkey primary key (id),
  constraint message_reads_message_id_user_id_key unique (message_id, user_id)
);

-- Add foreign key to messages table
alter table public.message_reads
add constraint message_reads_message_id_fkey
foreign key (message_id) references public.messages (id) on delete cascade;

-- Add foreign key to direct_messages table
alter table public.message_reads
add constraint message_reads_direct_message_id_fkey
foreign key (message_id) references public.direct_messages (id) on delete cascade;

-- Add foreign key to profiles (users)
alter table public.message_reads
add constraint message_reads_user_id_fkey
foreign key (user_id) references public.profiles (id) on delete cascade;

-- Create indexes for faster queries
create index if not exists message_reads_message_id_idx on public.message_reads (message_id);
create index if not exists message_reads_user_id_idx on public.message_reads (user_id);

-- Enable RLS
alter table public.message_reads enable row level security;

-- Policy: Users can insert their own read receipts
create policy "Users can insert their own read receipts" on public.message_reads
for insert
with check (auth.uid() = user_id);

-- Policy: Users can view read receipts for messages they can see
create policy "Users can view read receipts for their messages" on public.message_reads
for select
using (
  exists (
    select 1 from public.messages m
    where m.id = message_reads.message_id
    and m.author_id = auth.uid()
  )
  or exists (
    select 1 from public.direct_messages dm
    where dm.id = message_reads.message_id
    and (dm.author_id = auth.uid() or dm.sender_id = auth.uid())
  )
  or exists (
    select 1 from public.community_members cm
    join public.messages m on m.channel_id = cm.community_id
    where m.id = message_reads.message_id
    and cm.user_id = auth.uid()
  )
);

-- Policy: Users can update their own read receipts
create policy "Users can update their own read receipts" on public.message_reads
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);