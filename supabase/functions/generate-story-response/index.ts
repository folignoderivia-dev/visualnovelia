// generate-story-response
// Recebe a ação do jogador, monta um contexto COMPACTO, chama o Gemini, valida tudo
// e só então grava (mensagens + estado numa única transação via commit_story_turn).
import { authenticate, assertStoryOwner, corsHeaders, errorResponse, HttpError, json } from '../_shared/common.ts'
import {
  buildPrompt, computeNextState, MAX_ACTION, parseJson, RECENT_MESSAGES, s, selectRelevantNpcs,
  SYSTEM_RULES, validateAiResponse, EXPRESSIONS, MEMORY_TYPES, MAX_BEATS,
} from '../_shared/core.ts'
import { callGemini } from '../_shared/gemini.ts'
import { summarizeStory } from '../_shared/summarize.ts'

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    beats: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING', enum: ['narration', 'dialogue'] },
          character_id: { type: 'STRING', nullable: true },
          text: { type: 'STRING' },
          expression: { type: 'STRING', enum: [...EXPRESSIONS], nullable: true },
        },
        required: ['type', 'text'],
      },
    },
    current_scenario_id: { type: 'STRING', nullable: true },
    state_updates: {
      type: 'OBJECT',
      properties: {
        current_location: { type: 'STRING', nullable: true },
        story_time: { type: 'STRING', nullable: true },
        new_chapter: { type: 'BOOLEAN', nullable: true }, pending_choices: { type: 'ARRAY', items: { type: 'STRING' } },
        flags: {
          type: 'ARRAY',
          items: { type: 'OBJECT', properties: { key: { type: 'STRING' }, value: { type: 'STRING' } }, required: ['key', 'value'] },
        },
      },
    },
    memories: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          memory_type: { type: 'STRING', enum: [...MEMORY_TYPES] },
          content: { type: 'STRING' },
          importance: { type: 'INTEGER' },
          character_ids: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['memory_type', 'content'],
      },
    },
    relationship_updates: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          character_id: { type: 'STRING' },
          relationship_type: { type: 'STRING' },
          description: { type: 'STRING' },
          value: { type: 'INTEGER', nullable: true },
        },
        required: ['character_id', 'relationship_type'],
      },
    },
  },
  required: ['beats'],
}
void MAX_BEATS

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  let release: (() => Promise<unknown>) | null = null
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'Método não permitido.')
    const ctx = await authenticate(req)
    const body = await req.json().catch(() => ({}))
    const story = await assertStoryOwner(ctx, body.story_id)
    const { admin, userEmail, userId } = ctx
    const ADMIN_EMAILS = ['guifoligno@gmail.com', 'guilhermefoligno@gmail.com']
    const isWhitelisted = ADMIN_EMAILS.includes(userEmail)

    // Rate limit blindado: se não for admin, máximo de 20 mensagens diárias (24h)
    let usedToday = 0
    const DAILY_LIMIT = 20
    if (!isWhitelisted) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data: userStories } = await admin.from('stories').select('id').eq('user_id', userId)
      const storyIds = (userStories ?? []).map((s: any) => s.id)

      if (storyIds.length > 0) {
        const { count, error: countErr } = await admin
          .from('story_messages')
          .select('id', { count: 'exact', head: true })
          .in('story_id', storyIds)
          .eq('sender_type', 'player')
          .gte('created_at', since)
        if (!countErr && typeof count === 'number') {
          usedToday = count
        }
      }

      if (usedToday >= DAILY_LIMIT) {
        throw new HttpError(
          429,
          'daily_limit_reached',
          `Você atingiu o limite de ${DAILY_LIMIT} mensagens diárias como convidado! Seu limite é renovado a cada 24 horas.`
        )
      }
    if (body.mode === 'creation_assist') {
      const step = Number(body.step ?? 0)
      const theme = s(body.theme, 400) || 'Fantasia Medieval'
      const existingTitle = s(body.existing_title, 200)

      const systemPrompt = 'Você é um diretor criativo e roteirista mestre de RPGs e Visual Novels. Responda em Português do Brasil com qualidade cinematográfica, alta riqueza de detalhes e fidelidade temática ao universo pedido.'
      let userPrompt = ''
      let schema: Record<string, unknown> = {}

      if (step === 0) {
        userPrompt = `Gere os dados iniciais de uma história interativa no universo ou tema: "${theme}". Crie um título imersivo, uma sinopse empolgante (2 a 3 parágrafos apresentando o conflito central), o gênero e o tom.`
        schema = {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING' },
            description: { type: 'STRING' },
            genre: { type: 'STRING' },
            tone: { type: 'STRING' },
          },
          required: ['title', 'description', 'genre', 'tone'],
        }
      } else if (step === 1) {
        userPrompt = `Gere a ambientação detalhada de mundo para uma história sobre "${theme}" ${existingTitle ? `(História: ${existingTitle})` : ''}. Defina o nome do mundo/cenário, descrição rica, época, local inicial de partida, regras fundamentais (magia, leis, perigos), atmosfera sensorial, informações importantes/segredos do mundo e os dados de um cenário inicial icônico.`
        schema = {
          type: 'OBJECT',
          properties: {
            world_name: { type: 'STRING' },
            description: { type: 'STRING' },
            era: { type: 'STRING' },
            starting_location: { type: 'STRING' },
            world_rules: { type: 'STRING' },
            atmosphere: { type: 'STRING' },
            important_information: { type: 'STRING' },
            starting_scenario_name: { type: 'STRING' },
            starting_scenario_description: { type: 'STRING' },
          },
          required: ['world_name', 'description', 'era', 'starting_location', 'world_rules', 'atmosphere', 'important_information', 'starting_scenario_name', 'starting_scenario_description'],
        }
      } else if (step === 2) {
        userPrompt = `Gere as instruções do mestre/narrador de IA para uma história sobre "${theme}". Escreva instruções ricas para guiar a narração, o estilo narrativo, a personalidade do narrador, regras de continuidade e regras adicionais de ritmo, romance e escolhas.`
        schema = {
          type: 'OBJECT',
          properties: {
            master_prompt: { type: 'STRING' },
            narrative_style: { type: 'STRING' },
            narrator_personality: { type: 'STRING' },
            continuity_rules: { type: 'STRING' },
            additional_rules: { type: 'STRING' },
          },
          required: ['master_prompt', 'narrative_style', 'narrator_personality', 'continuity_rules', 'additional_rules'],
        }
      } else if (step === 3) {
        userPrompt = `Crie um elenco de 3 personagens marcantes do universo de "${theme}". Para cada um defina: nome, apelido, idade, aparência física detalhada, personalidade, passado/história, objetivos, medos, segredos, estilo de fala e o campo CRÍTICO "relationship_to_protagonist" (o que o personagem pensa atualmente em segredo sobre o protagonista, pois isso é a regra de ouro da IA).`
        schema = {
          type: 'OBJECT',
          properties: {
            characters: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  name: { type: 'STRING' },
                  nickname: { type: 'STRING' },
                  age: { type: 'STRING' },
                  appearance: { type: 'STRING' },
                  personality: { type: 'STRING' },
                  history: { type: 'STRING' },
                  goals: { type: 'STRING' },
                  fears: { type: 'STRING' },
                  secrets: { type: 'STRING' },
                  speech_style: { type: 'STRING' },
                  relationship_to_protagonist: { type: 'STRING' },
                  extra_information: { type: 'STRING' },
                },
                required: ['name', 'appearance', 'personality', 'relationship_to_protagonist'],
              },
            },
          },
          required: ['characters'],
        }
      } else if (step === 4) {
        userPrompt = `Crie o protagonista controlado pelo jogador no universo de "${theme}". Crie um personagem fascinante com nome, apelido, idade, aparência marcante, personalidade, passado intrigante, objetivos e medos.`
        schema = {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING' },
            nickname: { type: 'STRING' },
            age: { type: 'STRING' },
            appearance: { type: 'STRING' },
            personality: { type: 'STRING' },
            history: { type: 'STRING' },
            goals: { type: 'STRING' },
            fears: { type: 'STRING' },
          },
          required: ['name', 'appearance', 'personality', 'history', 'goals'],
        }
      }

      const rawAi = await callGemini({
        system: systemPrompt,
        prompt: userPrompt,
        schema,
        temperature: 0.85,
      })
      const parsed = parseJson(rawAi)
      return json({ step, result: parsed })
    }

    const mode: 'start' | 'turn' = body.mode === 'start' ? 'start' : 'turn'
    let action = s(body.action, MAX_ACTION)
    const image = body.image
    if (mode === 'turn' && !action && image) {
      action = '[O jogador mostra esta foto/imagem e aguarda sua reação]'
    }
    if (mode === 'turn' && !action) throw new HttpError(400, 'empty_action', 'Escreva o que seu protagonista faz ou diz, ou anexe uma imagem.')

    // ---------- trava de concorrência: uma geração por vez por história ----------
    const { data: claimed, error: claimErr } = await admin.rpc('claim_story_generation', { p_story_id: story.id, p_seconds: 90 })
    if (claimErr) throw claimErr
    if (!claimed) throw new HttpError(409, 'busy', 'O narrador ainda está respondendo. Aguarde um instante.')
    release = () => admin.rpc('release_story_generation', { p_story_id: story.id })

    // ---------- 1. Carrega dados (consultas seletivas) ----------
    const [world, master, player, characters, scenarios, stateRes, summaryRes, recentRes, countRes] = await Promise.all([
      admin.from('story_worlds').select('*').eq('story_id', story.id).maybeSingle(),
      admin.from('story_master_settings').select('*').eq('story_id', story.id).maybeSingle(),
      admin.from('player_characters').select('*').eq('story_id', story.id).maybeSingle(),
      admin.from('characters').select('*').eq('story_id', story.id).order('created_at'),
      admin.from('scenarios').select('id,name,description,is_starting_scenario').eq('story_id', story.id).order('created_at'),
      admin.from('story_state').select('*').eq('story_id', story.id).maybeSingle(),
      admin.from('story_summaries').select('*').eq('story_id', story.id).order('covers_until_sequence', { ascending: false }).limit(1).maybeSingle(),
      admin.from('story_messages').select('id,sequence_number,sender_type,character_id,content,message_type')
        .eq('story_id', story.id).order('sequence_number', { ascending: false }).limit(RECENT_MESSAGES),
      admin.from('story_messages').select('id', { count: 'exact', head: true }).eq('story_id', story.id),
    ])
    for (const r of [world, master, player, characters, scenarios, stateRes, summaryRes, recentRes, countRes]) if (r.error) throw r.error

    if (mode === 'start' && (countRes.count ?? 0) > 0) throw new HttpError(409, 'already_started', 'Esta história já foi iniciada.')
    if (!player.data?.name?.trim()) throw new HttpError(422, 'missing_player', 'Dê um nome ao seu protagonista antes de começar.')

    const npcs = characters.data ?? []
    const scs = scenarios.data ?? []
    const recent = (recentRes.data ?? []).slice().reverse()
    const state = stateRes.data

    const relevant = npcs
    const currentScenarioId: string | null = state?.current_scenario_id ?? scs.find((x) => x.is_starting_scenario)?.id ?? scs[0]?.id ?? null
    const currentScenario = scs.find((x) => x.id === currentScenarioId)

    // ---------- 2. Memórias relevantes (palavras-chave + personagens + importância) ----------
    const { data: tags } = await admin.from('story_tags').select('*').eq('story_id', story.id);
    const { data: memories, error: memErr } = await admin.rpc('search_story_memories', {
      p_story_id: story.id, p_query: action, p_character_ids: relevant.map((c) => c.id), p_limit: 8,
    })
    if (memErr) throw memErr

    // ---------- 3. Prompt compacto + Gemini ----------
    const prompt = buildPrompt({
      story, world: world.data, master: master.data, player: player.data,
      npcs: relevant, allNpcs: npcs, scenarios: scs, tags: tags || [], currentScenarioId, state,
      memories: memories ?? [], summary: summaryRes.data?.summary ?? null, recent, mode, action,
    })
    const ai = parseJson(await callGemini({ system: SYSTEM_RULES, prompt, schema: RESPONSE_SCHEMA, image }))

    // ---------- 4. VALIDAÇÃO — o modelo não tem poder sobre o banco ----------
    const turn = validateAiResponse(ai, {
      npcIds: new Set(npcs.map((c) => c.id)), scenarioIds: new Set(scs.map((x) => x.id)), currentScenarioId,
    })
    const nextState = computeNextState(state, turn, {
      scenarioId: currentScenarioId, location: currentScenario?.name || world.data?.starting_location || '',
    })

    // ---------- 5. Grava mensagens + estado numa única transação ----------
    const msgs: Record<string, unknown>[] = []
    if (mode === 'turn') msgs.push({ sender_type: 'player', content: action + (image ? '\n[Uma imagem foi anexada nesta ação]' : ''), message_type: 'action' })
    if (turn.newScenarioId) {
      msgs.push({ sender_type: 'system', content: scs.find((x) => x.id === turn.newScenarioId)?.name || 'Nova cena',
        message_type: 'scene_change', metadata: { scenario_id: turn.newScenarioId } })
    }
    for (const b of turn.beats) {
      msgs.push({ sender_type: b.type === 'dialogue' ? 'npc' : 'narrator', character_id: b.character_id,
        content: b.text, message_type: b.type, expression: b.expression })
    }
    const { data: saved, error: commitErr } = await admin.rpc('commit_story_turn', {
      p_story_id: story.id, p_messages: msgs, p_state: nextState, p_is_start: mode === 'start',
    })
    if (commitErr) {
      if (String(commitErr.message).includes('already_started')) throw new HttpError(409, 'already_started', 'Esta história já foi iniciada.')
      throw commitErr
    }
    const savedMsgs = (saved ?? []) as { id: string; sequence_number: number }[]
    const lastSavedId = savedMsgs[savedMsgs.length - 1]?.id ?? null

    // ---------- 6. Memórias e relacionamentos (secundários: falha NÃO derruba o turno) ----------
    let memoriesSaved = 0
    try {
      const wanted = turn.memories.filter((m) => !(memories ?? []).some((x: any) => x.content.toLowerCase() === m.content.toLowerCase()))
      if (wanted.length) {
        const { data: dup } = await admin.from('story_memories').select('content').eq('story_id', story.id).in('content', wanted.map((m) => m.content))
        const known = new Set((dup ?? []).map((d: any) => d.content.toLowerCase()))
        const rows = wanted.filter((m) => !known.has(m.content.toLowerCase())).map((m) => ({
          story_id: story.id, ...m, source_message_id: lastSavedId, scenario_id: nextState.current_scenario_id,
        }))
        if (rows.length) { const { error } = await admin.from('story_memories').insert(rows); if (error) throw error; memoriesSaved = rows.length }
      }
      for (const r of turn.relationships) {
        const payload = {
          story_id: story.id, character_a_id: r.character_id, character_b_id: null as string | null,
          relationship_type: r.relationship_type, description: r.description, relationship_value: r.value,
        }
        const { data: ex } = await admin.from('character_relationships').select('id')
          .eq('story_id', story.id).eq('character_a_id', r.character_id).is('character_b_id', null).maybeSingle()
        if (ex) await admin.from('character_relationships').update(payload).eq('id', ex.id)
        else await admin.from('character_relationships').insert(payload)
      }
    } catch (e) {
      console.error('[memory/relationships] falha não-crítica:', e)
    }

    // ---------- 7. Resumo em segundo plano (não atrasa a resposta) ----------
    const bg = summarizeStory(admin, story.id).catch((e) => console.error('[summary]', e))
    // deno-lint-ignore no-explicit-any
    ;(globalThis as any).EdgeRuntime?.waitUntil?.(bg)

    return json({
      messages: savedMsgs,
      state: { story_id: story.id, ...nextState },
      scenario_changed: !!turn.newScenarioId,
      memories_saved: memoriesSaved,
      daily_limit: {
        is_whitelisted: isWhitelisted,
        used: isWhitelisted ? 0 : usedToday + 1,
        max: DAILY_LIMIT,
        remaining: isWhitelisted ? 9999 : Math.max(0, DAILY_LIMIT - (usedToday + 1)),
      },
    })
  } catch (err) {
    return errorResponse(err)
  } finally {
    if (release) { try { const res = await release(); if (res.error) console.error('[release]', res.error); } catch (e) { console.error('[release]', e); } }
  }
})
