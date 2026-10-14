import { speakLine } from '@/lib/gemini/client'

const cache = new Map<string, string>()
let current: HTMLAudioElement | null = null
let seq = 0

export function stopSpeech() {
  seq++
  current?.pause()
  current = null
  if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel()
}

function voiceIndex(name: string, total: number) {
  let n = 0
  for (let i = 0; i < name.length; i++) n = (n + name.charCodeAt(i)) % total
  return n
}

/** Usa a voz do navegador quando a função speak-line ainda não está publicada no Supabase. */
async function playWithBrowser(text: string, voiceName: string, token: number, onEnded?: () => void): Promise<void> {
  const synth = window.speechSynthesis
  if (!synth) throw new Error('Este navegador não consegue falar o texto.')
  const ready = synth.getVoices()
  const voices = ready.length ? ready : await new Promise<SpeechSynthesisVoice[]>((resolve) => {
    const finish = () => resolve(synth.getVoices())
    synth.addEventListener('voiceschanged', finish, { once: true })
    setTimeout(finish, 500)
  })
  if (seq !== token) return
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'pt-BR'
  const pt = voices.filter((v) => v.lang.toLowerCase().startsWith('pt'))
  const pool = pt.length ? pt : voices
  if (pool.length) utterance.voice = pool[voiceIndex(voiceName || 'Kore', pool.length)]
  utterance.onend = () => onEnded?.()
  synth.cancel()
  synth.speak(utterance)
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
  if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel()

  try {
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
  } catch {
    if (my !== seq) return 'cancelled'
    await playWithBrowser(opts.text, opts.voice, my, () => { if (my === seq) opts.onEnded?.() })
    return 'played'
  }
}

