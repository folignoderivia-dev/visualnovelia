-- =====================================================================
-- 006_indexes_functions.sql — índices e funções auxiliares
-- =====================================================================

alter table public.stories add column if not exists generating_until timestamptz;

create index if not exists idx_stories_user_updated   on public.stories (user_id, updated_at desc);
create index if not exists idx_scenarios_story        on public.scenarios (story_id);
create index if not exists idx_characters_story       on public.characters (story_id);
create index if not exists idx_expressions_character  on public.character_expressions (character_id);
create index if not exists idx_messages_story_seq     on public.story_messages (story_id, sequence_number desc);
create index if not exists idx_memories_story_imp     on public.story_memories (story_id, importance desc, created_at desc);
create index if not exists idx_memories_characters    on public.story_memories using gin (character_ids);
create index if not exists idx_memories_fts           on public.story_memories using gin (to_tsvector('portuguese', content));
create index if not exists idx_summaries_story        on public.story_summaries (story_id, chapter desc);
create index if not exists idx_relationships_story    on public.character_relationships (story_id);

-- Índice vetorial só se a coluna existir
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='story_memories' and column_name='embedding') then
    execute 'create index if not exists idx_memories_embedding on public.story_memories using hnsw (embedding vector_cosine_ops)';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- create_story(): cria história + linhas padrão numa ÚNICA transação (chamada pelo frontend).
-- Usa auth.uid(): o dono nunca vem do cliente.
-- ---------------------------------------------------------------------
create or replace function public.create_story()
returns public.stories
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_story public.stories;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  insert into public.stories (user_id) values (v_uid) returning * into v_story;
  insert into public.story_worlds (story_id) values (v_story.id);
  insert into public.story_master_settings (story_id) values (v_story.id);
  insert into public.player_characters (story_id, user_id) values (v_story.id, v_uid);
  insert into public.scenarios (story_id, is_starting_scenario) values (v_story.id, true);
  return v_story;
end $$;
revoke all on function public.create_story() from public, anon;
grant execute on function public.create_story() to authenticated;

-- ---------------------------------------------------------------------
-- Trava de geração: só UMA chamada ao Gemini por história por vez.
-- Expira sozinha (p_seconds) caso a função morra sem liberar.
-- ---------------------------------------------------------------------
create or replace function public.claim_story_generation(p_story_id uuid, p_seconds integer default 90)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  update public.stories
     set generating_until = now() + make_interval(secs => greatest(5, least(p_seconds, 300)))
   where id = p_story_id and (generating_until is null or generating_until < now())
  returning id into v_id;
  return v_id is not null;
end $$;

create or replace function public.release_story_generation(p_story_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.stories set generating_until = null where id = p_story_id;
$$;

-- ---------------------------------------------------------------------
-- commit_story_turn(): grava mensagens (com sequência atômica) + estado + status
-- numa única transação. Ou grava tudo, ou nada (sem lixo parcial em caso de erro).
-- p_messages: [{sender_type, character_id?, content, message_type, expression?, metadata?}, ...]
-- p_state:    {current_scenario_id?, current_location, current_chapter, current_scene, story_time, state_data}
-- ---------------------------------------------------------------------
create or replace function public.commit_story_turn(
  p_story_id uuid, p_messages jsonb, p_state jsonb, p_is_start boolean default false)
returns setof public.story_messages
language plpgsql security definer set search_path = public as $$
declare v_seq integer;
begin
  if jsonb_typeof(p_messages) <> 'array' or jsonb_array_length(p_messages) = 0 then
    raise exception 'no messages to commit';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_story_id::text, 0));
  select coalesce(max(sequence_number), 0) into v_seq from public.story_messages where story_id = p_story_id;
  if p_is_start and v_seq > 0 then
    raise exception 'already_started' using errcode = 'P0001';
  end if;

  insert into public.story_state (story_id, current_scenario_id, current_location, current_chapter, current_scene, story_time, state_data)
  values (
    p_story_id,
    nullif(p_state->>'current_scenario_id', '')::uuid,
    coalesce(p_state->>'current_location', ''),
    coalesce((p_state->>'current_chapter')::integer, 1),
    coalesce((p_state->>'current_scene')::integer, 1),
    coalesce(p_state->>'story_time', ''),
    coalesce(p_state->'state_data', '{}'::jsonb))
  on conflict (story_id) do update set
    current_scenario_id = excluded.current_scenario_id,
    current_location    = excluded.current_location,
    current_chapter     = excluded.current_chapter,
    current_scene       = excluded.current_scene,
    story_time          = excluded.story_time,
    state_data          = excluded.state_data;

  update public.stories
     set status = 'playing', last_played_at = now(), started_at = coalesce(started_at, now())
   where id = p_story_id;

  return query
  with ins as (
    insert into public.story_messages
      (story_id, sequence_number, sender_type, character_id, content, message_type, expression, metadata)
    select
      p_story_id,
      v_seq + t.ord::integer,
      t.m->>'sender_type',
      nullif(t.m->>'character_id', '')::uuid,
      t.m->>'content',
      coalesce(t.m->>'message_type', 'narration'),
      nullif(t.m->>'expression', ''),
      coalesce(t.m->'metadata', '{}'::jsonb)
    from jsonb_array_elements(p_messages) with ordinality as t(m, ord)
    returning *
  )
  select * from ins order by sequence_number;
end $$;

-- ---------------------------------------------------------------------
-- Busca de memórias relevantes (palavras-chave + personagens + importância).
-- Não depende de embeddings. Uso: Edge Functions (service role).
-- ---------------------------------------------------------------------
create or replace function public.search_story_memories(
  p_story_id uuid,
  p_query text,
  p_character_ids uuid[] default '{}',
  p_limit integer default 8
)
returns setof public.story_memories
language sql stable security definer set search_path = public as $$
  select m.*
  from public.story_memories m
  where m.story_id = p_story_id
  order by
    (case when m.character_ids && p_character_ids then 3 else 0 end)
    + (case when nullif(trim(p_query), '') is not null
            and to_tsvector('portuguese', m.content) @@ plainto_tsquery('portuguese', p_query) then 4 else 0 end)
    + m.importance desc,
    m.created_at desc
  limit greatest(1, least(p_limit, 30));
$$;

-- Funções internas: só o service role (Edge Functions) pode executar.
do $$
declare f text;
begin
  foreach f in array array[
    'public.claim_story_generation(uuid, integer)',
    'public.release_story_generation(uuid)',
    'public.commit_story_turn(uuid, jsonb, jsonb, boolean)',
    'public.search_story_memories(uuid, text, uuid[], integer)']
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
