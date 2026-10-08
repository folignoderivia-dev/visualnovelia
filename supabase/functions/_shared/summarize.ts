// Lógica de resumo de história (usada por generate-story-response e create-story-summary).
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { callGemini, parseJson } from './gemini.ts'

export const SUMMARY_EVERY = 30 // mensagens novas necessárias para gerar novo resumo

export async function summarizeStory(admin: SupabaseClient, storyId: string, force = false) {
  const { data: lastSummary } = await admin.from('story_summaries').select('*')
    .eq('story_id', storyId).order('covers_until_sequence', { ascending: false }).limit(1).maybeSingle()
  const from = lastSummary?.covers_until_sequence ?? 0

  const { data: msgs } = await admin.from('story_messages')
    .select('sequence_number, sender_type, content, characters(name)')
    .eq('story_id', storyId).gt('sequence_number', from).order('sequence_number', { ascending: true }).limit(80)

  if (!msgs || msgs.length === 0 || (!force && msgs.length < SUMMARY_EVERY)) return null

  const { data: state } = await admin.from('story_state').select('current_chapter').eq('story_id', storyId).maybeSingle()

  const transcript = msgs.map((m: any) => {
    const who = m.sender_type === 'player' ? 'PROTAGONISTA' : m.sender_type === 'npc' ? (m.characters?.name ?? 'NPC') : 'NARRAÇÃO'
    return `${who}: ${m.content}`
  }).join('\n')

  const out = parseJson<{ summary: string; important_events: string[]; current_state_summary: string }>(
    await callGemini({
      system: 'Você resume histórias interativas de forma fiel e compacta, em português do Brasil. Nunca invente fatos.',
      prompt:
        `RESUMO ANTERIOR:\n${lastSummary?.summary ?? '(nenhum)'}\n\nNOVOS TRECHOS:\n${transcript}\n\n` +
        'Produza um resumo ATUALIZADO e compacto (máx. 1200 caracteres) unindo o resumo anterior e os novos trechos.',
      temperature: 0.3,
      maxOutputTokens: 1200,
      schema: {
        type: 'OBJECT',
        properties: {
          summary: { type: 'STRING' },
          important_events: { type: 'ARRAY', items: { type: 'STRING' } },
          current_state_summary: { type: 'STRING' },
        },
        required: ['summary', 'important_events', 'current_state_summary'],
      },
    }),
  )

  const row = {
    story_id: storyId,
    chapter: state?.current_chapter ?? 1,
    summary: String(out.summary ?? '').slice(0, 3000),
    important_events: (out.important_events ?? []).slice(0, 15).map((e) => String(e).slice(0, 300)),
    current_state_summary: String(out.current_state_summary ?? '').slice(0, 1000),
    covers_until_sequence: msgs[msgs.length - 1].sequence_number,
  }
  const { data, error } = await admin.from('story_summaries').insert(row).select().single()
  if (error) throw error
  return data
}
