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
