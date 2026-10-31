create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  base_handle text;
begin
  base_handle := regexp_replace(
    lower(coalesce(metadata ->> 'username', metadata ->> 'user_name', metadata ->> 'preferred_username', nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'user')),
    '[^a-z0-9_]',
    '',
    'g'
  );

  insert into public.profiles (id, username, full_name, avatar_url, onboarding_completed)
  values (
    new.id,
    left(coalesce(nullif(base_handle, ''), 'user'), 13) || '_' || left(replace(new.id::text, '-', ''), 6),
    coalesce(nullif(metadata ->> 'full_name', ''), nullif(metadata ->> 'name', ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Usuário'),
    coalesce(nullif(metadata ->> 'avatar_url', ''), nullif(metadata ->> 'picture', '')),
    false
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists handle_new_auth_user on auth.users;
create trigger handle_new_auth_user
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

revoke all on function public.handle_new_auth_user() from public;
