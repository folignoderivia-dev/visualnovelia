/** 30 vozes pré-prontas do Gemini TTS. Entram no plano gratuito da API (sem cobrança por áudio). */
export const GEMINI_VOICES: { id: string; tone: string }[] = [
  { id: 'Zephyr', tone: 'Brilhante' },
  { id: 'Puck', tone: 'Animada' },
  { id: 'Charon', tone: 'Informativa' },
  { id: 'Kore', tone: 'Firme' },
  { id: 'Fenrir', tone: 'Empolgada' },
  { id: 'Leda', tone: 'Jovem' },
  { id: 'Orus', tone: 'Firme' },
  { id: 'Aoede', tone: 'Leve' },
  { id: 'Callirrhoe', tone: 'Descontraída' },
  { id: 'Autonoe', tone: 'Brilhante' },
  { id: 'Enceladus', tone: 'Sussurrada' },
  { id: 'Iapetus', tone: 'Clara' },
  { id: 'Umbriel', tone: 'Descontraída' },
  { id: 'Algieba', tone: 'Suave' },
  { id: 'Despina', tone: 'Suave' },
  { id: 'Erinome', tone: 'Clara' },
  { id: 'Algenib', tone: 'Grave' },
  { id: 'Rasalgethi', tone: 'Informativa' },
  { id: 'Laomedeia', tone: 'Animada' },
  { id: 'Achernar', tone: 'Suave' },
  { id: 'Alnilam', tone: 'Firme' },
  { id: 'Schedar', tone: 'Equilibrada' },
  { id: 'Gacrux', tone: 'Madura' },
  { id: 'Pulcherrima', tone: 'Direta' },
  { id: 'Achird', tone: 'Amigável' },
  { id: 'Zubenelgenubi', tone: 'Casual' },
  { id: 'Vindemiatrix', tone: 'Gentil' },
  { id: 'Sadachbia', tone: 'Viva' },
  { id: 'Sadaltager', tone: 'Sábia' },
  { id: 'Sulafat', tone: 'Acolhedora' },
]

export const GEMINI_VOICE_IDS = new Set(GEMINI_VOICES.map((v) => v.id))

/** Tira rubricas de cena para a voz ler só o que o personagem diz. */
export function spokenText(raw: string): string {
  const cleaned = raw
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\*[^*]*\*/g, ' ')
    .replace(/[#*_>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const text = cleaned || raw.replace(/\s+/g, ' ').trim()
  return text.slice(0, 1200)
}
