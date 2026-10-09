// Chamadas às Edge Functions (a chave do Gemini NUNCA passa por aqui).
import { supabase } from '@/lib/supabase/client'
import { AppError } from '@/lib/errors'
import type { GeminiResponse } from '@/lib/types'

const CLIENT_TIMEOUT_MS = 90_000

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new AppError('Você está sem conexão. Tente novamente quando a internet voltar.', 'offline')

  const call = supabase.functions.invoke(name, { body })
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new AppError('O narrador demorou demais para responder. Tente novamente.', 'timeout')), CLIENT_TIMEOUT_MS))
  const { data, error } = await Promise.race([call, timeout])

  if (error) {
    // FunctionsHttpError traz a Response original em error.context
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try {
        const payload = await ctx.json()
        if (payload?.error?.message) throw new AppError(payload.error.message, payload.error.code)
      } catch (e) {
        if (e instanceof AppError) throw e
      }
    }
    if (error.name === 'FunctionsFetchError') throw new AppError('Não foi possível conectar ao narrador. Verifique sua conexão e se a função foi publicada.', 'network')
    throw new AppError('Não foi possível falar com o narrador. Tente novamente.')
  }
  if (data?.error) throw new AppError(data.error.message, data.error.code)
  return data as T
}

export const startStory = (storyId: string) =>
  invoke<GeminiResponse>('generate-story-response', { story_id: storyId, mode: 'start' })

export const sendPlayerAction = (storyId: string, action: string, image?: string) =>
  invoke<GeminiResponse>('generate-story-response', { story_id: storyId, mode: 'turn', action, image })

export const requestSummary = (storyId: string) =>
  invoke<{ summary: unknown }>('create-story-summary', { story_id: storyId, force: true })
