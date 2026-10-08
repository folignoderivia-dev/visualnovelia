// search-story-memory — busca memórias relevantes (palavras-chave/personagens/importância).
// Preparada para evoluir para pgvector + embeddings sem mudar o contrato.
import { authenticate, assertStoryOwner, corsHeaders, errorResponse, json } from '../_shared/common.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const ctx = await authenticate(req)
    const body = await req.json().catch(() => ({}))
    const story = await assertStoryOwner(ctx, body.story_id)
    const query = typeof body.query === 'string' ? body.query.slice(0, 500) : ''
    const characterIds = Array.isArray(body.character_ids) ? body.character_ids.filter((x: unknown) => typeof x === 'string') : []
    const { data, error } = await ctx.admin.rpc('search_story_memories', {
      p_story_id: story.id, p_query: query, p_character_ids: characterIds, p_limit: Math.min(Number(body.limit) || 8, 20),
    })
    if (error) throw error
    return json({ memories: data })
  } catch (err) {
    return errorResponse(err)
  }
})
