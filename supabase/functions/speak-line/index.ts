// Fala uma linha com uma voz pré-pronta do Gemini TTS (plano gratuito).
// A chave fica só aqui. O navegador recebe WAV em base64.
import { authenticate, corsHeaders, errorResponse, HttpError, json } from '../_shared/common.ts'

const VOICES = new Set([
  'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede', 'Callirrhoe', 'Autonoe',
  'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar',
  'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat',
])

const MODEL = () => Deno.env.get('GEMINI_TTS_MODEL') || 'gemini-2.5-flash-preview-tts'

function pcmToWavBase64(pcmB64: string, sampleRate: number): string {
  const binary = atob(pcmB64)
  const pcm = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) pcm[i] = binary.charCodeAt(i)

  const header = new ArrayBuffer(44)
  const view = new DataView(header)
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  const dataSize = pcm.length
  write(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  write(36, 'data')
  view.setUint32(40, dataSize, true)

  const out = new Uint8Array(44 + pcm.length)
  out.set(new Uint8Array(header), 0)
  out.set(pcm, 44)

  let encoded = ''
  const step = 8192
  for (let i = 0; i < out.length; i += step) {
    const slice = out.subarray(i, i + step)
    encoded += String.fromCharCode(...slice)
  }
  return btoa(encoded)
}

function toWavBase64(data: string, mime: string): string {
  if (data.startsWith('UklG') || mime.toLowerCase().includes('wav')) return data
  const rate = Number(mime.match(/rate=(\d+)/i)?.[1] ?? 24000)
  return pcmToWavBase64(data, rate)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    await authenticate(req)
    const body = await req.json().catch(() => ({}))
    const text = String(body.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 1200)
    const voice = String(body.voice ?? '')
    if (!text) throw new HttpError(400, 'bad_request', 'Não há texto para falar.')
    if (!VOICES.has(voice)) throw new HttpError(400, 'bad_request', 'Essa voz não está na biblioteca gratuita do Gemini.')

    const key = Deno.env.get('GEMINI_API_KEY')
    if (!key) throw new HttpError(503, 'ai_not_configured', 'A IA ainda não foi configurada neste projeto.')

    let res: Response
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL()}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          },
        }),
        signal: AbortSignal.timeout(45_000),
      })
    } catch (e) {
      if ((e as Error)?.name === 'TimeoutError') throw new HttpError(504, 'ai_timeout', 'A voz demorou demais para responder. Tente de novo.')
      throw new HttpError(503, 'ai_unavailable', 'Não foi possível gerar a voz agora. Tente de novo.')
    }

    if (!res.ok) {
      console.error('[speak-line]', res.status, (await res.text()).slice(0, 500))
      if (res.status === 429) throw new HttpError(429, 'ai_rate_limit', 'O limite gratuito de voz do Gemini foi atingido. Aguarde um pouco.')
      throw new HttpError(503, 'ai_unavailable', 'Não foi possível gerar a voz agora. Tente de novo.')
    }

    const data = await res.json()
    const part = data?.candidates?.[0]?.content?.parts?.find((p: { inlineData?: { data?: string } }) => p.inlineData?.data)
    const b64 = part?.inlineData?.data as string | undefined
    if (!b64) throw new HttpError(502, 'ai_empty', 'O Gemini não devolveu áudio. Tente de novo.')

    return json({ audio: toWavBase64(b64, String(part.inlineData.mimeType ?? '')), mime: 'audio/wav' })
  } catch (err) {
    return errorResponse(err)
  }
})
