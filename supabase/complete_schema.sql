-- =====================================================================
-- 001_initial_schema.sql
-- AI NOVEL CREATOR — tabelas base: perfis, histórias, mundo, cenários,
-- configurações do Mestre. Seguro para rodar mais de uma vez.
-- =====================================================================

create extension if not exists "pgcrypto";

-- Função genérica para manter updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- profiles: 1 linha por usuário autenticado
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references auth.users(id) on delete cascade,
  display_name  text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Cria o perfil automaticamente quando um usuário se cadastra
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- stories
-- ---------------------------------------------------------------------
create table if not exists public.stories (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  title          text not null default '' check (char_length(title) <= 200),
  description    text not null default '' check (char_length(description) <= 4000),
  genre          text not null default '' check (char_length(genre) <= 100),
  tone           text not null default '' check (char_length(tone) <= 100),
  status         text not null default 'draft'
                 check (status in ('draft','ready','playing','completed','archived')),
  cover_url      text,
  editor_step    smallint not null default 0 check (editor_step between 0 and 5),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  started_at     timestamptz,
  last_played_at timestamptz
);

-- ---------------------------------------------------------------------
-- story_worlds (1:1 com stories)
-- ---------------------------------------------------------------------
create table if not exists public.story_worlds (
  id                    uuid primary key default gen_random_uuid(),
  story_id              uuid not null unique references public.stories(id) on delete cascade,
  world_name            text not null default '',
  description           text not null default '',
  era                   text not null default '',
  starting_location     text not null default '',
  world_rules           text not null default '',
  atmosphere            text not null default '',
  important_information text not null default '',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- scenarios (N por história)
-- ---------------------------------------------------------------------
create table if not exists public.scenarios (
  id                   uuid primary key default gen_random_uuid(),
  story_id             uuid not null references public.stories(id) on delete cascade,
  name                 text not null default '',
  description          text not null default '',
  image_url            text,
  image_path           text,
  image_prompt         text,
  is_starting_scenario boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Só um cenário inicial por história
create unique index if not exists scenarios_one_starting_per_story
  on public.scenarios (story_id) where is_starting_scenario;

-- ---------------------------------------------------------------------
-- story_master_settings (1:1) — regras do Mestre / narrador
-- ---------------------------------------------------------------------
create table if not exists public.story_master_settings (
  id                    uuid primary key default gen_random_uuid(),
  story_id              uuid not null unique references public.stories(id) on delete cascade,
  master_prompt         text not null default '',
  narrative_style       text not null default '',
  narrator_personality  text not null default '',
  continuity_rules      text not null default '',
  character_rules       text not null default '',
  player_character_rules text not null default '',
  pacing_rules          text not null default '',
  romance_rules         text not null default '',
  humor_rules           text not null default '',
  violence_rules        text not null default '',
  mystery_rules         text not null default '',
  additional_rules      text not null default '',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Triggers de updated_at
do $$
declare t text;
begin
  foreach t in array array['profiles','stories','story_worlds','scenarios','story_master_settings']
  loop
    execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$s', t);
    execute format('create trigger trg_%1$s_updated_at before update on public.%1$s
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;
-- =====================================================================
-- 002_characters.sql — NPCs, expressões e protagonista do jogador
-- =====================================================================

create table if not exists public.characters (
  id                          uuid primary key default gen_random_uuid(),
  story_id                    uuid not null references public.stories(id) on delete cascade,
  name                        text not null default '',
  nickname                    text not null default '',
  age                         text not null default '',
  appearance                  text not null default '',
  personality                 text not null default '',
  history                     text not null default '',
  speech_style                text not null default '',
  goals                       text not null default '',
  fears                       text not null default '',
  secrets                     text not null default '',
  relationship_to_protagonist text not null default '',
  extra_information           text not null default '',
  image_url                   text,
  image_path                  text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create table if not exists public.character_expressions (
  id              uuid primary key default gen_random_uuid(),
  character_id    uuid not null references public.characters(id) on delete cascade,
  expression_type text not null
                  check (expression_type in ('neutral','happy','sad','angry','scared','surprised','in_love','worried')),
  image_url       text,
  image_path      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (character_id, expression_type)
);

-- Protagonista: controlado EXCLUSIVAMENTE pelo jogador (a IA nunca decide por ele)
create table if not exists public.player_characters (
  id                uuid primary key default gen_random_uuid(),
  story_id          uuid not null unique references public.stories(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  name              text not null default '',
  nickname          text not null default '',
  age               text not null default '',
  appearance        text not null default '',
  personality       text not null default '',
  history           text not null default '',
  goals             text not null default '',
  fears             text not null default '',
  extra_information text not null default '',
  image_url         text,
  image_path        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['characters','character_expressions','player_characters']
  loop
    execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$s', t);
    execute format('create trigger trg_%1$s_updated_at before update on public.%1$s
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;
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
-- =====================================================================
-- 004_rls_policies.sql — Row Level Security
-- Regra: um usuário só acessa histórias (e dados filhos) que são dele.
-- Escritas feitas pela IA (mensagens, memória, estado, resumos) passam
-- pelas Edge Functions com service role, depois de validar o dono.
-- =====================================================================

-- Helper: o usuário logado é dono da história?
create or replace function public.owns_story(p_story_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.stories s where s.id = p_story_id and s.user_id = auth.uid());
$$;

create or replace function public.owns_character(p_character_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.characters c
    join public.stories s on s.id = c.story_id
    where c.id = p_character_id and s.user_id = auth.uid());
$$;

grant execute on function public.owns_story(uuid) to authenticated;
grant execute on function public.owns_character(uuid) to authenticated;

-- Liga RLS em tudo
alter table public.profiles                enable row level security;
alter table public.stories                 enable row level security;
alter table public.story_worlds            enable row level security;
alter table public.scenarios               enable row level security;
alter table public.story_master_settings   enable row level security;
alter table public.characters              enable row level security;
alter table public.character_expressions   enable row level security;
alter table public.player_characters       enable row level security;
alter table public.story_messages          enable row level security;
alter table public.story_state             enable row level security;
alter table public.story_memories          enable row level security;
alter table public.story_summaries         enable row level security;
alter table public.character_relationships enable row level security;

-- ---------------- profiles ----------------
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (user_id = auth.uid());
create policy profiles_insert on public.profiles for insert to authenticated with check (user_id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------- stories ----------------
drop policy if exists stories_select on public.stories;
drop policy if exists stories_insert on public.stories;
drop policy if exists stories_update on public.stories;
drop policy if exists stories_delete on public.stories;
create policy stories_select on public.stories for select to authenticated using (user_id = auth.uid());
create policy stories_insert on public.stories for insert to authenticated with check (user_id = auth.uid());
create policy stories_update on public.stories for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy stories_delete on public.stories for delete to authenticated using (user_id = auth.uid());

-- ---------------- tabelas com story_id (CRUD completo para o dono) ----------------
do $$
declare t text;
begin
  foreach t in array array['story_worlds','scenarios','story_master_settings','characters']
  loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.owns_story(story_id))', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.owns_story(story_id))', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.owns_story(story_id)) with check (public.owns_story(story_id))', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (public.owns_story(story_id))', t);
  end loop;
end $$;

-- ---------------- player_characters (também exige user_id = usuário logado) ----------------
drop policy if exists player_characters_select on public.player_characters;
drop policy if exists player_characters_insert on public.player_characters;
drop policy if exists player_characters_update on public.player_characters;
drop policy if exists player_characters_delete on public.player_characters;
create policy player_characters_select on public.player_characters for select to authenticated
  using (user_id = auth.uid() and public.owns_story(story_id));
create policy player_characters_insert on public.player_characters for insert to authenticated
  with check (user_id = auth.uid() and public.owns_story(story_id));
create policy player_characters_update on public.player_characters for update to authenticated
  using (user_id = auth.uid() and public.owns_story(story_id))
  with check (user_id = auth.uid() and public.owns_story(story_id));
create policy player_characters_delete on public.player_characters for delete to authenticated
  using (user_id = auth.uid() and public.owns_story(story_id));

-- ---------------- character_expressions (via personagem) ----------------
drop policy if exists character_expressions_select on public.character_expressions;
drop policy if exists character_expressions_insert on public.character_expressions;
drop policy if exists character_expressions_update on public.character_expressions;
drop policy if exists character_expressions_delete on public.character_expressions;
create policy character_expressions_select on public.character_expressions for select to authenticated using (public.owns_character(character_id));
create policy character_expressions_insert on public.character_expressions for insert to authenticated with check (public.owns_character(character_id));
create policy character_expressions_update on public.character_expressions for update to authenticated
  using (public.owns_character(character_id)) with check (public.owns_character(character_id));
create policy character_expressions_delete on public.character_expressions for delete to authenticated using (public.owns_character(character_id));

-- ---------------- relacionamentos: dono pode tudo ----------------
drop policy if exists character_relationships_all on public.character_relationships;
create policy character_relationships_all on public.character_relationships for all to authenticated
  using (public.owns_story(story_id)) with check (public.owns_story(story_id));

-- ---------------- tabelas geradas pela IA: cliente só LÊ (e apaga memória) ----------------
-- INSERT/UPDATE são feitos somente pelas Edge Functions (service role ignora RLS).
drop policy if exists story_messages_select on public.story_messages;
create policy story_messages_select on public.story_messages for select to authenticated using (public.owns_story(story_id));

drop policy if exists story_state_select on public.story_state;
create policy story_state_select on public.story_state for select to authenticated using (public.owns_story(story_id));

drop policy if exists story_memories_select on public.story_memories;
drop policy if exists story_memories_delete on public.story_memories;
create policy story_memories_select on public.story_memories for select to authenticated using (public.owns_story(story_id));
create policy story_memories_delete on public.story_memories for delete to authenticated using (public.owns_story(story_id));

drop policy if exists story_summaries_select on public.story_summaries;
create policy story_summaries_select on public.story_summaries for select to authenticated using (public.owns_story(story_id));
-- =====================================================================
-- 005_storage.sql — buckets e políticas do Supabase Storage
-- Convenção de caminho:  <user_id>/<story_id>/<arquivo>
-- Leitura pública (URLs não adivinháveis); escrita só na pasta do próprio usuário.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('campaign-assets',  'campaign-assets',  true, 5242880, array['image/png','image/jpeg','image/webp']),
  ('character-assets', 'character-assets', true, 5242880, array['image/png','image/jpeg','image/webp']),
  ('player-assets',    'player-assets',    true, 5242880, array['image/png','image/jpeg','image/webp']),
  ('scenario-assets',  'scenario-assets',  true, 8388608, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

do $$
declare b text;
begin
  foreach b in array array['campaign-assets','character-assets','player-assets','scenario-assets']
  loop
    execute format('drop policy if exists "%1$s_read" on storage.objects', b);
    execute format('drop policy if exists "%1$s_insert" on storage.objects', b);
    execute format('drop policy if exists "%1$s_update" on storage.objects', b);
    execute format('drop policy if exists "%1$s_delete" on storage.objects', b);

    execute format($f$create policy "%1$s_read" on storage.objects for select
      using (bucket_id = %1$L)$f$, b);
    execute format($f$create policy "%1$s_insert" on storage.objects for insert to authenticated
      with check (bucket_id = %1$L and (storage.foldername(name))[1] = auth.uid()::text)$f$, b);
    execute format($f$create policy "%1$s_update" on storage.objects for update to authenticated
      using (bucket_id = %1$L and (storage.foldername(name))[1] = auth.uid()::text)$f$, b);
    execute format($f$create policy "%1$s_delete" on storage.objects for delete to authenticated
      using (bucket_id = %1$L and (storage.foldername(name))[1] = auth.uid()::text)$f$, b);
  end loop;
end $$;
-- =====================================================================
-- 006_indexes_functions.sql — índices e funções auxiliares
-- =====================================================================

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
-- Próximo número de sequência (atômico por história). Uso: Edge Functions.
-- ---------------------------------------------------------------------
create or replace function public.next_message_sequence(p_story_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_story_id::text, 0));
  select coalesce(max(sequence_number), 0) + 1 into v from public.story_messages where story_id = p_story_id;
  return v;
end $$;
revoke all on function public.next_message_sequence(uuid) from public, anon, authenticated;

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
revoke all on function public.search_story_memories(uuid, text, uuid[], integer) from public, anon, authenticated;
