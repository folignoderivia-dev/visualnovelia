// extract-story-memory — extrai memórias importantes das últimas mensagens sob demanda.
// (No fluxo normal, generate-story-response já extrai memórias no mesmo turno.)
import { authenticate, assertStoryOwner, corsHeaders, errorResponse, json } from '../_shared/common.ts'
import { callGemini, parseJson } from '../_shared/gemini.ts'

const TYPES = ['world', 'character', 'relationship', 'event', 'fact', 'player', 'plot', 'scene', 'preference']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const ctx = await authenticate(req)
    const body = await req.json().catch(() => ({}))
    const story = await assertStoryOwner(ctx, body.story_id)

    const { data: msgs } = await ctx.admin.from('story_messages').select('sender_type,content')
      .eq('story_id', story.id).order('sequence_number', { ascending: false }).limit(15)
    if (!msgs?.length) return json({ saved: 0 })

    const transcript = msgs.reverse().map((m: any) => `${m.sender_type}: ${m.content}`).join('\n')
    const out = parseJson<{ memories: { memory_type: string; content: string; importance: number }[] }>(
      await callGemini({
        system: 'Extraia apenas fatos duradouros e importantes de uma história (revelações, promessas, mudanças de relação). Português do Brasil. Se nada for importante, devolva lista vazia.',
        prompt: transcript, temperature: 0.2, maxOutputTokens: 800,
        schema: {
          type: 'OBJECT',
          properties: { memories: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
            memory_type: { type: 'STRING', enum: TYPES }, content: { type: 'STRING' }, importance: { type: 'INTEGER' } },
            required: ['memory_type', 'content'] } } },
          required: ['memories'],
        },
      }),
    )
    const rows = (out.memories ?? []).slice(0, 5).filter((m) => m.content?.length > 7).map((m) => ({
      story_id: story.id,
      memory_type: TYPES.includes(m.memory_type) ? m.memory_type : 'event',
      content: m.content.slice(0, 500),
      importance: Math.min(5, Math.max(1, Number.isInteger(m.importance) ? m.importance : 3)),
    }))
    if (rows.length) await ctx.admin.from('story_memories').insert(rows)
    return json({ saved: rows.length })
  } catch (err) {
    return errorResponse(err)
  }
})
