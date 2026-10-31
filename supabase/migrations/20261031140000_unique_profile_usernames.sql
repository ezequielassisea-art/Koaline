-- Usernames are case-insensitively unique; NULL/blank values remain available
-- for legacy profiles until they complete the required onboarding flow.
create unique index if not exists profiles_username_ci_unique
  on public.profiles (lower(username))
  where username is not null and btrim(username) <> '';
