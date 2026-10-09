// Cliente mínimo da API REST do Google Gemini (a chave fica SOMENTE aqui, no backend).
import { HttpError, parseJson } from './core.ts'

export { parseJson }

const MODEL = () => Deno.env.get('GEMINI_MODEL') || 'gemini-3.5-flash-lite'
const TIMEOUT_MS = 50_000

export async function callGemini(opts: {
  system: string
  prompt: string
  schema?: Record<string, unknown>
  temperature?: number
  maxOutputTokens?: number
  image?: string // data URL
}): Promise<string> {
  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) throw new HttpError(503, 'ai_not_configured', 'A IA ainda não foi configurada neste projeto.')

  const model = MODEL()
  const parts: any[] = [{ text: opts.prompt }]
  if (opts.image) {
    const match = opts.image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/)
    if (match) {
      parts.push({ inlineData: { mimeType: match[1], data: match[2] } })
    }
  }

  const body = {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: opts.temperature ?? 0.9,
      maxOutputTokens: opts.maxOutputTokens ?? 3072,
      ...(opts.schema ? { responseMimeType: 'application/json', responseSchema: opts.schema } : {}),
    },
  }

  const delays = [2000, 4000, 0]
  let attempts = 0

  while (attempts < 3) {
    attempts++
    let res: Response
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch (e) {
      console.error(`[gemini] falha de rede/timeout (tentativa ${attempts})`, e)
      if ((e as Error)?.name === 'TimeoutError') throw new HttpError(504, 'ai_timeout', 'O narrador demorou demais para responder. Tente novamente.')
      throw new HttpError(503, 'ai_unavailable', 'O narrador está indisponível no momento. Tente novamente em instantes.')
    }

    if (res.status === 503) {
      console.warn(`[gemini] 503 recebido. Tentativa ${attempts} falhou.`)
      if (attempts < 3) {
        await new Promise((r) => setTimeout(r, delays[attempts - 1]))
        continue // Retry
      }
    }

    if (!res.ok) {
      console.error('[gemini] erro', res.status, (await res.text()).slice(0, 500))
      if (res.status === 429) throw new HttpError(429, 'ai_rate_limit', 'O narrador está sobrecarregado. Aguarde alguns segundos.')
      if (res.status === 400 || res.status === 403) throw new HttpError(503, 'ai_config_error', 'A chave da IA parece inválida ou sem permissão. Verifique a configuração.')
      throw new HttpError(503, 'ai_unavailable', 'O narrador está indisponível no momento. Tente novamente em instantes.')
    }

    const data = await res.json()
    const cand = data?.candidates?.[0]
    const text = cand?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? ''
    
    if (data?.promptFeedback?.blockReason || cand?.finishReason === 'SAFETY') {
      throw new HttpError(422, 'ai_blocked', 'O narrador não pôde continuar com essa ação. Tente reformular.')
    }
    
    if (cand?.finishReason === 'MAX_TOKENS') {
      console.error('[gemini] resposta truncada (MAX_TOKENS)')
      throw new HttpError(502, 'ai_bad_format', 'O narrador respondeu de forma incompleta. Tente novamente.')
    }
    
    if (!text.trim()) {
      console.error('[gemini] resposta vazia', JSON.stringify(data).slice(0, 500))
      throw new HttpError(502, 'ai_empty', 'O narrador não respondeu. Tente reformular sua ação.')
    }
    
    return text
  }

  throw new HttpError(503, 'ai_unavailable', 'O narrador está indisponível no momento (tentativas excedidas).')
}
