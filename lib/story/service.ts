// Camada de serviços de história: todo acesso ao Supabase passa por aqui.
import { supabase } from '@/lib/supabase/client'
import type {
  Character, MasterSettings, PlayerCharacter, Scenario, Story, StoryBundle,
  StoryMemory, StoryMessage, StoryState, World,
} from '@/lib/types'

function check<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}

export async function getUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('not authenticated')
  return id
}

// ------------------------------------------------------------------ biblioteca
export async function listStories(): Promise<(Story & { cover: string | null })[]> {
  const stories = check(await supabase.from('stories').select('*').neq('status', 'archived').order('updated_at', { ascending: false })) as Story[]
  if (stories.length === 0) return []
  // Capa: usa cover_url ou a imagem do cenário inicial (consulta única, sem N+1)
  const sc = check(await supabase.from('scenarios').select('story_id,image_url').in('story_id', stories.map((s) => s.id)).eq('is_starting_scenario', true)) as { story_id: string; image_url: string | null }[]
  const byStory = new Map(sc.map((x) => [x.story_id, x.image_url]))
  return stories.map((s) => ({ ...s, cover: s.cover_url ?? byStory.get(s.id) ?? null }))
}

export async function createStory(): Promise<Story> {
  // Uma única transação no banco (história + mundo + mestre + protagonista + cenário inicial).
  return check(await supabase.rpc('create_story')) as Story
}

const BUCKETS = ['campaign-assets', 'character-assets', 'player-assets', 'scenario-assets'] as const

/** Remove as imagens da história no Storage (antes de apagar a linha; a policy exige a pasta do usuário). */
async function purgeStoryFiles(storyId: string): Promise<void> {
  const userId = await getUserId()
  for (const bucket of BUCKETS) {
    const { data } = await supabase.storage.from(bucket).list(`${userId}/${storyId}`, { limit: 1000 })
    if (data?.length) await supabase.storage.from(bucket).remove(data.map((f) => `${userId}/${storyId}/${f.name}`))
  }
}

export async function deleteStory(storyId: string): Promise<void> {
  await purgeStoryFiles(storyId).catch((e) => console.error('[storage] limpeza falhou', e))
  check(await supabase.from('stories').delete().eq('id', storyId).select())
}

async function ensureScenario(storyId: string, list: Scenario[]): Promise<Scenario[]> {
  if (list.length > 0) return list
  const created = check(await supabase.from('scenarios').insert({ story_id: storyId, is_starting_scenario: true }).select().single()) as Scenario
  return [created]
}

// ------------------------------------------------------------------ editor
export async function loadBundle(storyId: string): Promise<StoryBundle> {
  const [story, world, master, scenarios, characters, player, relationships, expressions, tags] = await Promise.all([
    supabase.from('stories').select('*').eq('id', storyId).maybeSingle(),
    supabase.from('story_worlds').select('*').eq('story_id', storyId).maybeSingle(),
    supabase.from('story_master_settings').select('*').eq('story_id', storyId).maybeSingle(),
    supabase.from('scenarios').select('*').eq('story_id', storyId).order('created_at'),
    supabase.from('characters').select('*').eq('story_id', storyId).order('created_at'),
    supabase.from('player_characters').select('*').eq('story_id', storyId).maybeSingle(),
    supabase.from('character_relationships').select('*').eq('story_id', storyId),
    supabase.from('character_expressions').select('*').in('character_id', 
      (await supabase.from('characters').select('id').eq('story_id', storyId)).data?.map(c => c.id) || []
    )
  ])
  const s = check(story) as Story | null
  if (!s) throw new Error('story not found')
  
  const chars = check(characters) as Character[]
  const exprs = (check(expressions) as any[]) || []
  for (const c of chars) {
    c.expressions = {}
    c.relationship = (check(relationships) as any[])?.find(r => r.character_a_id === c.id && !r.character_b_id)
    for (const e of exprs) {
      if (e.character_id === c.id && e.image_url) {
        c.expressions[e.expression_type] = e.image_url
      }
    }
  }

  const userId = s.user_id
  return {
    story: s,
    world: (check(world) as World | null) ?? ({ story_id: storyId, world_name: '', description: '', era: '', starting_location: '', world_rules: '', atmosphere: '', important_information: '' } as World),
    master: (check(master) as MasterSettings | null) ?? ({ story_id: storyId, master_prompt: '', narrative_style: '', narrator_personality: '', continuity_rules: '', character_rules: '', player_character_rules: '', pacing_rules: '', romance_rules: '', humor_rules: '', violence_rules: '', mystery_rules: '', additional_rules: '' } as MasterSettings),
    scenarios: await ensureScenario(storyId, check(scenarios) as Scenario[]),
    characters: chars,
    tags: (check(tags) as any[]) || [],
    player: (check(player) as PlayerCharacter | null) ?? ({ story_id: storyId, user_id: userId, name: '', nickname: '', age: '', appearance: '', personality: '', history: '', goals: '', fears: '', extra_information: '', image_url: null, image_path: null } as PlayerCharacter),
  }
}

const strip = <T extends object>(o: T) => {
  const { id: _id, created_at: _c, updated_at: _u, ...rest } = o as Record<string, unknown>
  return rest
}

export async function saveStory(story: Story): Promise<void> {
  const { title, description, genre, tone, editor_step, cover_url } = story
  check(await supabase.from('stories').update({ title, description, genre, tone, editor_step, cover_url }).eq('id', story.id).select())
}
export async function saveWorld(w: World): Promise<void> {
  check(await supabase.from('story_worlds').upsert(strip(w), { onConflict: 'story_id' }).select())
}
export async function saveMaster(m: MasterSettings): Promise<void> {
  check(await supabase.from('story_master_settings').upsert(strip(m), { onConflict: 'story_id' }).select())
}
export async function savePlayer(p: PlayerCharacter): Promise<void> {
  const userId = await getUserId()
  check(await supabase.from('player_characters').upsert({ ...strip(p), user_id: userId }, { onConflict: 'story_id' }).select())
}
export async function saveScenario(sc: Scenario): Promise<void> {
  const { id, story_id: _s, ...rest } = sc
  check(await supabase.from('scenarios').update(rest).eq('id', id).select())
}

export async function createCharacter(storyId: string): Promise<Character> {
  return check(await supabase.from('characters').insert({ story_id: storyId }).select().single()) as Character
}
export async function saveCharacter(c: Character): Promise<void> {
  const { id, story_id: _s, expressions, ...rest } = c as any
  check(await supabase.from('characters').update(rest).eq('id', id).select())
}
export async function deleteCharacter(id: string): Promise<void> {
  check(await supabase.from('characters').delete().eq('id', id).select())
}

export async function saveTag(t: any): Promise<any> { const { id, story_id, ...rest } = t; if (!id || id.startsWith('new-')) return check(await supabase.from('story_tags').insert({ story_id, ...rest }).select().single()); return check(await supabase.from('story_tags').update(rest).eq('id', id).select().single()); }
export async function deleteTag(id: string): Promise<void> { check(await supabase.from('story_tags').delete().eq('id', id).select()); }
export async function saveExpression(characterId: string, expressionType: string, imageUrl: string, imagePath: string): Promise<void> {
  check(await supabase.from('character_expressions').upsert({
    character_id: characterId,
    expression_type: expressionType,
    image_url: imageUrl,
    image_path: imagePath
  }, { onConflict: 'character_id,expression_type' }).select())
}

export async function markReady(storyId: string): Promise<void> {
  check(await supabase.from('stories').update({ status: 'ready' }).eq('id', storyId).eq('status', 'draft').select())
}

// ------------------------------------------------------------------ jogar
export async function loadRecentMessages(storyId: string, limit = 40): Promise<StoryMessage[]> {
  const rows = check(await supabase.from('story_messages').select('*').eq('story_id', storyId)
    .order('sequence_number', { ascending: false }).limit(limit)) as StoryMessage[]
  return rows.reverse()
}
export async function loadOlderMessages(storyId: string, beforeSeq: number, limit = 40): Promise<StoryMessage[]> {
  const rows = check(await supabase.from('story_messages').select('*').eq('story_id', storyId)
    .lt('sequence_number', beforeSeq).order('sequence_number', { ascending: false }).limit(limit)) as StoryMessage[]
  return rows.reverse()
}
export async function loadState(storyId: string): Promise<StoryState | null> {
  return check(await supabase.from('story_state').select('*').eq('story_id', storyId).maybeSingle()) as StoryState | null
}
export async function loadTopMemories(storyId: string, limit = 20): Promise<StoryMemory[]> {
  return check(await supabase.from('story_memories').select('*').eq('story_id', storyId)
    .order('importance', { ascending: false }).order('created_at', { ascending: false }).limit(limit)) as StoryMemory[]
}
export async function deleteMemory(id: string): Promise<void> {
  check(await supabase.from('story_memories').delete().eq('id', id).select())
}

export async function updateMessageContent(id: string, newContent: string): Promise<void> {
  check(await supabase.from('story_messages').update({ content: newContent }).eq('id', id).select())
}

export async function restartStory(storyId: string): Promise<void> {
  check(await supabase.from('story_messages').delete().eq('story_id', storyId).select())
  check(await supabase.from('story_memories').delete().eq('story_id', storyId).select())
  check(await supabase.from('story_state').delete().eq('story_id', storyId).select())
}
  
export async function saveTag(t: any): Promise<any> {  
  const { id, story_id, ...rest } = t  
