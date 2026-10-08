// generate-scenario — PREPARADA (fase 3). Gerar imagem por IA ainda não está ativa;
// o upload manual de imagem é o caminho principal e sempre funciona.
// Para ativar no futuro: chame um provedor de imagem aqui, salve no bucket
// "scenario-assets" em <user_id>/<story_id>/ e devolva a URL pública.
import { authenticate, assertStoryOwner, corsHeaders, errorResponse, json } from '../_shared/common.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const ctx = await authenticate(req)
    const body = await req.json().catch(() => ({}))
    await assertStoryOwner(ctx, body.story_id)
    return json({
      error: { code: 'not_available', message: 'A geração de imagens por IA chegará em breve. Por enquanto, envie uma imagem.' },
    }, 501)
  } catch (err) {
    return errorResponse(err)
  }
})
