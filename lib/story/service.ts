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
    ),
    supabase.from('story_tags').select('*').eq('story_id', storyId).order('created_at')
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
    player: unpackPlayer((check(player) as PlayerCharacter | null) ?? ({ story_id: storyId, user_id: userId, name: '', nickname: '', age: '', appearance: '', personality: '', history: '', goals: '', fears: '', extra_information: '', image_url: null, image_path: null } as PlayerCharacter)),
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

/** Grava o tema da campanha nas regras do mestre, que o narrador já lê a cada turno. */
export async function saveNarrativeMode(storyId: string, additionalRules: string): Promise<void> {
  check(await supabase.from('story_master_settings').update({ additional_rules: additionalRules }).eq('story_id', storyId).select())
}
const FICHA = '\n[[FICHA_PROTAGONISTA]]'

/** A tabela do protagonista não tem fala nem segredos. Eles viajam no campo extra, separados na tela. */
export function unpackPlayer(p: PlayerCharacter): PlayerCharacter {
  const raw = p.extra_information || ''
  const [base, packed] = raw.split(FICHA)
  const speech = packed?.match(/Fala:\s*([\s\S]*?)(?:\nSegredos:|$)/)?.[1]?.trim() || p.speech_style || ''
  const secrets = packed?.match(/Segredos:\s*([\s\S]*)/)?.[1]?.trim() || p.secrets || ''
  return { ...p, speech_style: speech, secrets, extra_information: (base || '').trim() }
}

function packPlayer(p: PlayerCharacter): Record<string, unknown> {
  const { speech_style: speech, secrets, ...rest } = strip(p) as unknown as PlayerCharacter
  const base = (p.extra_information || '').split(FICHA)[0].trim()
  const tail = [speech ? `Fala: ${speech}` : '', secrets ? `Segredos: ${secrets}` : ''].filter(Boolean).join('\n')
  return { ...rest, extra_information: tail ? `${base}${FICHA}\n${tail}` : base }
}

export async function savePlayer(p: PlayerCharacter): Promise<void> {
  const userId = await getUserId()
  check(await supabase.from('player_characters').upsert({ ...packPlayer(p), user_id: userId }, { onConflict: 'story_id' }).select())
}
export async function saveScenario(sc: Scenario): Promise<void> {
  const { id, story_id: _s, ...rest } = sc
  check(await supabase.from('scenarios').update(rest).eq('id', id).select())
}

export async function createCharacter(storyId: string): Promise<Character> {
  return check(await supabase.from('characters').insert({ story_id: storyId }).select().single()) as Character
}
export async function saveCharacter(c: Character): Promise<void> {
  const { id, story_id: _s, expressions, relationship, ...rest } = c as any
  check(await supabase.from('characters').update(rest).eq('id', id).select())
  if (relationship && typeof relationship.relationship_value === 'number') {
    if (relationship.id) {
      check(await supabase.from('character_relationships').update({ relationship_value: relationship.relationship_value }).eq('id', relationship.id).select())
    } else {
      check(await supabase.from('character_relationships').update({ relationship_value: relationship.relationship_value }).eq('character_a_id', id).is('character_b_id', null).select())
    }
  }
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
export async function deleteMessage(id: string): Promise<void> { check(await supabase.from('story_messages').delete().eq('id', id).select()) }
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

export async function getDailyUsage(): Promise<{ isWhitelisted: boolean; used: number; max: number; remaining: number }> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { isWhitelisted: false, used: 0, max: 20, remaining: 20 }
    const email = (user.email || '').toLowerCase().trim()
    const ADMIN_EMAILS = ['guifoligno@gmail.com', 'guilhermefoligno@gmail.com']
    if (ADMIN_EMAILS.includes(email)) {
      return { isWhitelisted: true, used: 0, max: 20, remaining: 9999 }
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: userStories } = await supabase.from('stories').select('id')
    const storyIds = (userStories ?? []).map((s) => s.id)
    if (storyIds.length === 0) return { isWhitelisted: false, used: 0, max: 20, remaining: 20 }

    const { count, error } = await supabase
      .from('story_messages')
      .select('id', { count: 'exact', head: true })
      .in('story_id', storyIds)
      .eq('sender_type', 'player')
      .gte('created_at', since)

    if (error || typeof count !== 'number') return { isWhitelisted: false, used: 0, max: 20, remaining: 20 }
    const used = count
    return {
      isWhitelisted: false,
      used,
      max: 20,
      remaining: Math.max(0, 20 - used),
    }
  } catch {
    return { isWhitelisted: false, used: 0, max: 20, remaining: 20 }
  }
}

export interface FullCampaignData {
  version: number
  type: 'ai_novel_campaign'
  exported_at: string
  story: {
    title: string
    description: string
    genre: string
    tone: string
    cover_url: string | null
  }
  world: Partial<World>
  master: Partial<MasterSettings>
  player?: null
  scenarios: Partial<Scenario>[]
  characters: (Partial<Character> & { expressions?: Record<string, string>; relationship?: any })[]
  tags: any[]
}

export async function exportFullCampaign(storyId: string): Promise<FullCampaignData> {
  const bundle = await loadBundle(storyId)
  const data: FullCampaignData = {
    version: 1,
    type: 'ai_novel_campaign',
    exported_at: new Date().toISOString(),
    story: {
      title: bundle.story.title,
      description: bundle.story.description,
      genre: bundle.story.genre,
      tone: bundle.story.tone,
      cover_url: bundle.story.cover_url,
    },
    world: strip(bundle.world),
    master: strip(bundle.master),
    // Protagonista não é exportado: cada jogador cria seu próprio personagem
    player: null,
    scenarios: bundle.scenarios.map((sc) => ({
      name: sc.name,
      description: sc.description,
      image_url: sc.image_url,
      is_starting_scenario: sc.is_starting_scenario,
    })),
    characters: bundle.characters.map((c) => ({
      name: c.name,
      nickname: c.nickname,
      age: c.age,
      appearance: c.appearance,
      personality: c.personality,
      history: c.history,
      speech_style: c.speech_style,
      goals: c.goals,
      fears: c.fears,
      secrets: c.secrets,
      relationship_to_protagonist: c.relationship_to_protagonist,
      extra_information: c.extra_information,
      voice: c.voice || null,
      image_url: c.image_url,
      expressions: c.expressions || {},
      relationship: c.relationship ? { relationship_value: c.relationship.relationship_value } : undefined,
    })),
    tags: (bundle.tags || []).map((t: any) => ({
      name: t.name,
      prompt: t.prompt,
      category: t.category,
      color: t.color,
    })),
  }

  if (typeof window !== 'undefined') {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const cleanTitle = (bundle.story.title || 'aventura').toLowerCase().replace(/[^a-z0-9_-]/g, '_')
    a.href = url
    a.download = `${cleanTitle}-campanha.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return data
}

export async function importFullCampaign(data: any): Promise<Story> {
  const campaign = data.story ? data : { story: data, world: {}, master: {}, scenarios: [], characters: [], tags: [] }
  
  // 1. Cria uma nova história no Supabase via RPC (já cria as tabelas filhas com o ID do usuário conectado)
  const newStory = await createStory()
  const storyId = newStory.id

  // 2. Atualiza a história principal com status 'draft' e editor_step 4 para o amigo criar o protagonista dele
  if (campaign.story) {
    const { title, description, genre, tone, cover_url } = campaign.story
    await supabase.from('stories').update({
      title: title || 'Aventura Importada',
      description: description || '',
      genre: genre || 'Fantasia / RPG',
      tone: tone || 'Imersivo',
      cover_url: cover_url || null,
      status: 'draft',
      editor_step: 4, // Abre direto na etapa 05: Crie seu protagonista
    }).eq('id', storyId)
  }

  // 3. Salva Mundo
  if (campaign.world) {
    const { id: _, story_id: __, ...worldData } = campaign.world
    await saveWorld({ ...worldData, story_id: storyId } as World)
  }

  // 4. Salva Mestre / Regras
  if (campaign.master) {
    const { id: _, story_id: __, ...masterData } = campaign.master
    await saveMaster({ ...masterData, story_id: storyId } as MasterSettings)
  }

  // 6. Cenários
  if (Array.isArray(campaign.scenarios) && campaign.scenarios.length > 0) {
    const existingScenarios = check(await supabase.from('scenarios').select('*').eq('story_id', storyId)) as Scenario[]
    const firstImported = campaign.scenarios[0]
    if (existingScenarios.length > 0 && firstImported) {
      await supabase.from('scenarios').update({
        name: firstImported.name || 'Cenário Inicial',
        description: firstImported.description || '',
        image_url: firstImported.image_url || null,
        is_starting_scenario: true,
      }).eq('id', existingScenarios[0].id)
    }
    for (let i = 1; i < campaign.scenarios.length; i++) {
      const sc = campaign.scenarios[i]
      await supabase.from('scenarios').insert({
        story_id: storyId,
        name: sc.name || `Cenário ${i + 1}`,
        description: sc.description || '',
        image_url: sc.image_url || null,
        is_starting_scenario: false,
      })
    }
  }

  // 7. Personagens, Expressões e Relacionamento
  if (Array.isArray(campaign.characters)) {
    for (const c of campaign.characters) {
      const { data: newChar } = await supabase.from('characters').insert({
        story_id: storyId,
        name: c.name || 'Personagem',
        nickname: c.nickname || '',
        age: c.age || '',
        appearance: c.appearance || '',
        personality: c.personality || '',
        history: c.history || '',
        speech_style: c.speech_style || '',
        goals: c.goals || '',
        fears: c.fears || '',
        secrets: c.secrets || '',
        relationship_to_protagonist: c.relationship_to_protagonist || '',
        extra_information: c.extra_information || '',
        ...(c.voice ? { voice: c.voice } : {}),
        image_url: c.image_url || null,
      }).select().single()

      if (newChar) {
        if (c.expressions && typeof c.expressions === 'object') {
          for (const [exprType, imgUrl] of Object.entries(c.expressions)) {
            if (typeof imgUrl === 'string' && imgUrl) {
              await saveExpression(newChar.id, exprType, imgUrl, '')
            }
          }
        }
        if (c.relationship && typeof c.relationship.relationship_value === 'number') {
          await supabase.from('character_relationships').insert({
            story_id: storyId,
            character_a_id: newChar.id,
            relationship_value: c.relationship.relationship_value,
          })
        }
      }
    }
  }

  // 8. Tags da história
  if (Array.isArray(campaign.tags)) {
    for (const t of campaign.tags) {
      if (t.name) {
        await supabase.from('story_tags').insert({
          story_id: storyId,
          name: t.name,
          prompt: t.prompt || '',
          category: t.category || 'Geral',
          color: t.color || '#e5b869',
        })
      }
    }
  }

  return check(await supabase.from('stories').select('*').eq('id', storyId).single()) as Story
}


