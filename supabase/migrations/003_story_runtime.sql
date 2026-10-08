-- =====================================================================
-- 003_story_runtime.sql — mensagens, estado, memória, resumos, relações
-- =====================================================================

-- pgvector é opcional. Se não estiver disponível, a coluna embedding simplesmente não é criada.
do $$
begin
  begin
    create extension if not exists vector;
  exception when others then
    raise notice 'pgvector indisponível — busca semântica ficará desativada (MVP funciona sem ela).';
  end;
end $$;

-- ---------------------------------------------------------------------
-- story_messages: histórico completo
-- ---------------------------------------------------------------------
create table if not exists public.story_messages (
  id              uuid primary key default gen_random_uuid(),
  story_id        uuid not null references public.stories(id) on delete cascade,
  sequence_number integer not null,
  sender_type     text not null check (sender_type in ('player','npc','narrator','system')),
  character_id    uuid references public.characters(id) on delete set null,
  content         text not null,
  message_type    text not null default 'narration'
                  check (message_type in ('dialogue','narration','action','scene_change','system')),
  expression      text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  unique (story_id, sequence_number)
);

-- ---------------------------------------------------------------------
-- story_state: ESTADO atual (diferente de memória!)
-- ---------------------------------------------------------------------
create table if not exists public.story_state (
  story_id            uuid primary key references public.stories(id) on delete cascade,
  current_scenario_id uuid references public.scenarios(id) on delete set null,
  current_location    text not null default '',
  current_chapter     integer not null default 1,
  current_scene       integer not null default 1,
  story_time          text not null default '',
  state_data          jsonb not null default '{}'::jsonb,
  updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- story_memories: MEMÓRIA externa (fatos que importam no futuro)
-- ---------------------------------------------------------------------
create table if not exists public.story_memories (
  id                uuid primary key default gen_random_uuid(),
  story_id          uuid not null references public.stories(id) on delete cascade,
  memory_type       text not null default 'event'
                    check (memory_type in ('world','character','relationship','event','fact','player','plot','scene','preference')),
  content           text not null check (char_length(content) between 1 and 1000),
  importance        smallint not null default 3 check (importance between 1 and 5),
  source_message_id uuid references public.story_messages(id) on delete set null,
  character_ids     uuid[] not null default '{}',
  scenario_id       uuid references public.scenarios(id) on delete set null,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Coluna de embedding (somente se pgvector existir). 768 dims = Gemini text-embedding.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'vector') then
    execute 'alter table public.story_memories add column if not exists embedding vector(768)';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- story_summaries: resumos por capítulo
-- ---------------------------------------------------------------------
create table if not exists public.story_summaries (
  id                    uuid primary key default gen_random_uuid(),
  story_id              uuid not null references public.stories(id) on delete cascade,
  chapter               integer not null default 1,
  summary               text not null default '',
  important_events      jsonb not null default '[]'::jsonb,
  current_state_summary text not null default '',
  covers_until_sequence integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- character_relationships
-- ---------------------------------------------------------------------
create table if not exists public.character_relationships (
  id                 uuid primary key default gen_random_uuid(),
  story_id           uuid not null references public.stories(id) on delete cascade,
  character_a_id     uuid not null references public.characters(id) on delete cascade,
  character_b_id     uuid references public.characters(id) on delete cascade, -- null = protagonista
  relationship_type  text not null default '',
  relationship_value integer,   -- opcional: o usuário não é obrigado a usar números
  description        text not null default '',
  state_data         jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['story_state','story_memories','story_summaries','character_relationships']
  loop
    execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$s', t);
    execute format('create trigger trg_%1$s_updated_at before update on public.%1$s
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;
