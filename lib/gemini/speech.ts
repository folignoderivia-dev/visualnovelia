import { speakLine } from '@/lib/gemini/client'

const cache = new Map<string, string>()
let current: HTMLAudioElement | null = null
let seq = 0

export function stopSpeech() {
  seq++
  current?.pause()
  current = null
}

/** Gera (ou reaproveita) o áudio e toca. Cancela a fala anterior. */
export async function playSpeech(opts: {
  text: string
  voice: string
  cacheKey?: string
  onEnded?: () => void
}): Promise<'played' | 'cancelled'> {
  const my = ++seq
  current?.pause()
  current = null

  let audio = opts.cacheKey ? cache.get(opts.cacheKey) : undefined
  if (!audio) {
    const res = await speakLine(opts.text, opts.voice)
    if (my !== seq) return 'cancelled'
    audio = res.audio
    if (opts.cacheKey) {
      cache.set(opts.cacheKey, audio)
      if (cache.size > 40) cache.delete(cache.keys().next().value as string)
    }
  }
  if (my !== seq) return 'cancelled'

  const el = new Audio(`data:audio/wav;base64,${audio}`)
  current = el
  el.onended = () => {
    if (current === el) current = null
    opts.onEnded?.()
  }
  await el.play()
  return 'played'
}
