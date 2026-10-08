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

-- ---------------- relacionamentos: dono pode tudo, mas só entre personagens da MESMA história ----------------
create or replace function public.character_in_story(p_character_id uuid, p_story_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.characters c where c.id = p_character_id and c.story_id = p_story_id);
$$;
grant execute on function public.character_in_story(uuid, uuid) to authenticated;

drop policy if exists character_relationships_all on public.character_relationships;
create policy character_relationships_all on public.character_relationships for all to authenticated
  using (public.owns_story(story_id))
  with check (
    public.owns_story(story_id)
    and public.character_in_story(character_a_id, story_id)
    and (character_b_id is null or public.character_in_story(character_b_id, story_id))
  );

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

-- ---------------- defesa em profundidade: o papel anônimo não toca nas tabelas ----------------
-- (sem policies para anon o RLS já bloqueia; isto remove também o privilégio de tabela)
do $$
declare t text;
begin
  foreach t in array array['profiles','stories','story_worlds','scenarios','story_master_settings','characters',
    'character_expressions','player_characters','story_messages','story_state','story_memories',
    'story_summaries','character_relationships']
  loop
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
