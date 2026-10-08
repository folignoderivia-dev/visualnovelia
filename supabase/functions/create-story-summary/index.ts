// create-story-summary — gera (ou força) um resumo atualizado da história.
import { authenticate, assertStoryOwner, corsHeaders, errorResponse, json } from '../_shared/common.ts'
import { summarizeStory } from '../_shared/summarize.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const ctx = await authenticate(req)
    const body = await req.json().catch(() => ({}))
    const story = await assertStoryOwner(ctx, body.story_id)
    const summary = await summarizeStory(ctx.admin, story.id, body.force !== false)
    return json({ summary })
  } catch (err) {
    return errorResponse(err)
  }
})
