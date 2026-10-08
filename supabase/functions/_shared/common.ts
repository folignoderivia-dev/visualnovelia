// Utilitários compartilhados entre as Edge Functions.
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { checkOwnership, HttpError, isUuid } from './core.ts'

export { HttpError }

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Converte qualquer erro em resposta amigável. Detalhes técnicos vão só para o log. */
export function errorResponse(err: unknown) {
  if (err instanceof HttpError) return json({ error: { code: err.code, message: err.message } }, err.status)
  console.error('[edge-function] erro inesperado:', err)
  return json({ error: { code: 'internal', message: 'Algo deu errado do nosso lado. Tente novamente.' } }, 500)
}

export interface AuthContext {
  userId: string
  /** Cliente com o token do usuário: respeita RLS. */
  userClient: SupabaseClient
  /** Cliente com service role: SÓ usar depois de validar dono da história. */
  admin: SupabaseClient
}

/** Identifica o usuário a partir do token (nunca do corpo da requisição). */
export async function authenticate(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) throw new HttpError(401, 'unauthenticated', 'Sua sessão expirou. Entre novamente.')

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } })
  // Valida o JWT no servidor de Auth (token passado explicitamente: não depende de sessão em memória)
  const { data, error } = await userClient.auth.getUser(authHeader.slice('Bearer '.length))
  if (error || !data.user) throw new HttpError(401, 'unauthenticated', 'Sua sessão expirou. Entre novamente.')

  const admin = createClient(url, service, { auth: { persistSession: false } })
  return { userId: data.user.id, userClient, admin }
}

/** Garante que a história existe e pertence ao usuário (RLS + checagem explícita). */
export async function assertStoryOwner(ctx: AuthContext, storyId: unknown) {
  if (!isUuid(storyId)) throw new HttpError(400, 'bad_request', 'História inválida.')
  const { data, error } = await ctx.userClient.from('stories').select('*').eq('id', storyId).maybeSingle()
  if (error) throw error
  checkOwnership(data, ctx.userId)
  return data as Record<string, any>
}
