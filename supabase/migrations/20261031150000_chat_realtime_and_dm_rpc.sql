-- Suporte para conversas diretas seguras e eventos de chat em tempo real.
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
    insert into public.direct_conversation_members (conversation_id, user_id) values (v_conversation, v_self), (v_conversation, p_other_user);
  end if;
  return v_conversation;
end;
$$;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;

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
