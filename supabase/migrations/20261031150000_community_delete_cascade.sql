-- Ensure deleting a community removes its channels, and deleting those channels
-- removes their messages, even when these tables were created outside migrations.
do $$
declare
  fk record;
  source_columns text;
  target_columns text;
begin
  for fk in
    select c.conname, c.conrelid::regclass as source_table,
           c.confrelid::regclass as target_table, c.conkey, c.confkey
    from pg_constraint c
    where c.contype = 'f'
      and c.conrelid = to_regclass('public.channels')
      and c.confrelid = to_regclass('public.communities')
      and c.confdeltype <> 'c'
  loop
    select string_agg(quote_ident(a.attname), ', ' order by k.ord)
      into source_columns
      from unnest(fk.conkey) with ordinality k(attnum, ord)
      join pg_attribute a on a.attrelid = fk.source_table and a.attnum = k.attnum;
    select string_agg(quote_ident(a.attname), ', ' order by k.ord)
      into target_columns
      from unnest(fk.confkey) with ordinality k(attnum, ord)
      join pg_attribute a on a.attrelid = fk.target_table and a.attnum = k.attnum;
    execute format('alter table %s drop constraint %I', fk.source_table, fk.conname);
    execute format('alter table %s add constraint %I foreign key (%s) references %s (%s) on delete cascade',
      fk.source_table, fk.conname, source_columns, fk.target_table, target_columns);
  end loop;

  for fk in
    select c.conname, c.conrelid::regclass as source_table,
           c.confrelid::regclass as target_table, c.conkey, c.confkey
    from pg_constraint c
    where c.contype = 'f'
      and c.conrelid = to_regclass('public.messages')
      and c.confrelid = to_regclass('public.channels')
      and c.confdeltype <> 'c'
  loop
    select string_agg(quote_ident(a.attname), ', ' order by k.ord)
      into source_columns
      from unnest(fk.conkey) with ordinality k(attnum, ord)
      join pg_attribute a on a.attrelid = fk.source_table and a.attnum = k.attnum;
    select string_agg(quote_ident(a.attname), ', ' order by k.ord)
      into target_columns
      from unnest(fk.confkey) with ordinality k(attnum, ord)
      join pg_attribute a on a.attrelid = fk.target_table and a.attnum = k.attnum;
    execute format('alter table %s drop constraint %I', fk.source_table, fk.conname);
    execute format('alter table %s add constraint %I foreign key (%s) references %s (%s) on delete cascade',
      fk.source_table, fk.conname, source_columns, fk.target_table, target_columns);
  end loop;
end $$;
