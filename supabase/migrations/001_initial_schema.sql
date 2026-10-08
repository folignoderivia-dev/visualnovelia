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
  genre          text not null default '' check (char_length(genre) <= 300),
  tone           text not null default '' check (char_length(tone) <= 300),
  status         text not null default 'draft'
                 check (status in ('draft','ready','playing','completed','archived')),
  cover_url      text,
  editor_step    smallint not null default 0 check (editor_step between 0 and 5),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  started_at     timestamptz,
  last_played_at timestamptz,
  -- trava de concorrência: preenchida pela Edge Function enquanto o Gemini responde
  generating_until timestamptz
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
