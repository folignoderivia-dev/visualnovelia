'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, ChevronRight, Save, Settings, Sparkles, Trash2, UserRound, UsersRound, X, Pencil, ImagePlus, Check, RotateCcw } from 'lucide-react'
import type { Character, PlayerCharacter, Scenario, Story, StoryMemory, StoryMessage, StoryState } from '@/lib/types'
import * as svc from '@/lib/story/service'
import { sendPlayerAction, startStory } from '@/lib/gemini/client'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/ui/toast'

type Panel = null | 'history' | 'cast' | 'memory'
const HIDDEN: StoryMessage['message_type'][] = ['action', 'scene_change', 'system']

export function VisualNovel({ storyId, onBack }: { storyId: string; onBack: () => void }) {
  const { notify } = useToast()
  const [story, setStory] = useState<Story | null>(null)
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [player, setPlayer] = useState<PlayerCharacter | null>(null)
  const [state, setState] = useState<StoryState | null>(null)
  const [messages, setMessages] = useState<StoryMessage[]>([])
  const [cursor, setCursor] = useState(0)
  const [loadingInit, setLoadingInit] = useState(true)
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState('')
  const [input, setInput] = useState('')
  const [panel, setPanel] = useState<Panel>(null)
  const [memories, setMemories] = useState<StoryMemory[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [editingMsg, setEditingMsg] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadTarget, setUploadTarget] = useState<'scenario' | 'character' | null>(null)
  const retry = useRef<null | (() => void)>(null)
  const startedRef = useRef(false)

  const visible = useMemo(() => messages.filter((m) => !HIDDEN.includes(m.message_type)), [messages])
  const current = visible[Math.min(cursor, visible.length - 1)]
  const atEnd = visible.length === 0 || cursor >= visible.length - 1
  const npcById = useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters])
  const scenario = scenarios.find((s) => s.id === state?.current_scenario_id) ?? scenarios.find((s) => s.is_starting_scenario) ?? scenarios[0]
  const speaker = current?.sender_type === 'npc' && current.character_id ? npcById.get(current.character_id) : undefined

  const applyResponse = useCallback((newMsgs: StoryMessage[], newState: StoryState) => {
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id))
      return [...prev, ...newMsgs.filter((m) => !seen.has(m.id))]
    })
    setState(newState)
  }, [])

  // refs com o último estado conhecido (usados dentro de callbacks assíncronos)
  const visibleCountRef = useRef(0)
  const lastSeqRef = useRef(0)
  visibleCountRef.current = visible.length
  lastSeqRef.current = messages.length ? messages[messages.length - 1].sequence_number : 0
  const busy = useRef(false) // trava síncrona: impede dois envios no mesmo instante

  /**
   * Se a chamada falhou DEPOIS do servidor gravar (ex.: internet caiu na volta), o turno já existe no banco.
   * Conferimos antes de mostrar erro/permitir retry, para nunca duplicar a ação do jogador.
   */
  const recover = useCallback(async (kind: 'start' | 'turn', action: string) => {
    try {
      const latest = await svc.loadRecentMessages(storyId, 30)
      const fresh = latest.filter((m) => m.sequence_number > lastSeqRef.current)
      const ok = kind === 'start' ? fresh.length > 0 : fresh.some((m) => m.sender_type === 'player' && m.content === action)
      if (!ok) return null
      const st = await svc.loadState(storyId)
      return { messages: fresh, state: st as StoryState }
    } catch { return null }
  }, [storyId])

  const run = useCallback(async (kind: 'start' | 'turn', action = '') => {
    if (busy.current) return
    busy.current = true
    const prevVisible = visibleCountRef.current
    retry.current = () => { run(kind, action) }
    setThinking(true); setError('')
    try {
      let res: { messages: StoryMessage[]; state: StoryState }
      try {
        res = kind === 'start' ? await startStory(storyId) : await sendPlayerAction(storyId, action)
      } catch (e) {
        const recovered = await recover(kind, action)
        if (!recovered) throw e
        res = recovered
      }
      applyResponse(res.messages, res.state)
      setCursor(prevVisible) // primeiro bloco novo
      if (kind === 'turn') setInput('')
    } catch (e) {
      setError(friendlyError(e, 'O narrador não conseguiu responder. Tente novamente.'))
    } finally { busy.current = false; setThinking(false) }
  }, [storyId, applyResponse, recover])

  // ---------- carga inicial / continuar ----------
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [b, st, msgs] = await Promise.all([svc.loadBundle(storyId), svc.loadState(storyId), svc.loadRecentMessages(storyId, 40)])
        if (!alive) return
        setStory(b.story); setScenarios(b.scenarios); setCharacters(b.characters); setPlayer(b.player); setState(st)
        setMessages(msgs); setHasMore(msgs.length >= 40)
        const vis = msgs.filter((m) => !HIDDEN.includes(m.message_type))
        setCursor(Math.max(0, vis.length - 1))
        setLoadingInit(false)
        if (msgs.length === 0 && !startedRef.current) { startedRef.current = true; run('start') }
      } catch (e) {
        if (alive) { setError(friendlyError(e, 'Não foi possível abrir a história.')); setLoadingInit(false) }
      }
    })()
    return () => { alive = false }
  }, [storyId, run])

  function send() {
    const action = input.trim()
    if (!action || busy.current || thinking || !atEnd) return
    run('turn', action) // o texto só é limpo quando a resposta chega; se falhar, continua no campo
  }

  const advance = () => { if (!atEnd) setCursor((c) => c + 1) }

  async function openPanel(p: Panel) {
    setPanel(p)
    if (p === 'memory') svc.loadTopMemories(storyId).then(setMemories).catch((e) => notify(friendlyError(e), 'error'))
  }
  async function olderMessages() {
    const first = messages[0]
    if (!first) return
    try {
      const older = await svc.loadOlderMessages(storyId, first.sequence_number, 40)
      setHasMore(older.length >= 40)
      setMessages((prev) => [...older, ...prev])
      setCursor((c) => c + older.filter((m) => !HIDDEN.includes(m.message_type)).length)
    } catch (e) { notify(friendlyError(e), 'error') }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !uploadTarget) return
    const id = uploadTarget === 'scenario' ? scenario?.id : speaker?.id
    if (!id) return
    try {
      const ext = file.name.split('.').pop()
      const path = `${story?.user_id}/${storyId}/${id}-${Date.now()}.${ext}`
      const bucket = uploadTarget === 'scenario' ? 'scenario-assets' : 'character-assets'
      const { supabase } = await import('@/lib/supabase/client')
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
      if (error) throw error
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path)
      
      if (uploadTarget === 'scenario' && scenario) {
        const up = { ...scenario, image_url: pub.publicUrl, image_path: path }
        await svc.saveScenario(up)
        setScenarios((s) => s.map((x) => x.id === id ? up : x))
      } else if (speaker) {
        const up = { ...speaker, image_url: pub.publicUrl, image_path: path }
        await svc.saveCharacter(up)
        setCharacters((c) => c.map((x) => x.id === id ? up : x))
      }
      notify('Imagem atualizada com sucesso.')
    } catch (err) {
      notify(friendlyError(err, 'Erro ao enviar imagem.'), 'error')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
      setUploadTarget(null)
    }
  }

  async function saveEdit() {
    if (!editingMsg || !current) return
    try {
      await svc.updateMessageContent(editingMsg, editText)
      setMessages((m) => m.map((x) => x.id === editingMsg ? { ...x, content: editText } : x))
      setEditingMsg(null)
    } catch (e) { notify(friendlyError(e), 'error') }
  }

  async function handleRestart() {
    if (!confirm('Tem certeza que deseja apagar todo o progresso (mensagens e memórias) e recomeçar esta história do zero? Seus personagens e cenários NÃO serão apagados.')) return
    try {
      setLoadingInit(true)
      await svc.restartStory(storyId)
      setMessages([])
      setMemories([])
      setState(null)
      setCursor(0)
      startedRef.current = false
      run('start')
    } catch (e) {
      notify(friendlyError(e), 'error')
      setLoadingInit(false)
    }
  }

  // ---------- teclas ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (panel || (e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); advance() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const title = story?.title || 'Minha história'
  const label = current?.sender_type === 'npc' ? (speaker?.name ?? 'NPC') : 'NARRADOR'

  return (
    <main className="novel-mode">
      <div className="novel-backdrop">
        {scenario?.image_url && /* eslint-disable-next-line @next/next/no-img-element */ <img key={scenario.id} className="novel-bg-img" src={scenario.image_url} alt="" />}
        {!scenario?.image_url && <div className="backdrop-grid" />}
        {scenario?.image_url && <div className="novel-bg-shade" />}
      </div>
      <header className="novel-topbar">
        <button className="icon-button light" onClick={onBack} aria-label="Voltar ao editor"><ArrowLeft /></button>
        <div className="novel-brand"><span className="eyebrow">AI NOVEL / VISUAL NOVEL</span><strong>{title}</strong></div>
        <div className="novel-actions"><button className="icon-button light" aria-label="Reiniciar História" title="Recomeçar do zero" onClick={handleRestart}><RotateCcw /></button><button className="icon-button light" aria-label="Salvar" onClick={() => notify('Seu progresso é salvo automaticamente.')}><Save /></button><button className="icon-button light" aria-label="Configurações" onClick={() => openPanel('memory')}><Settings /></button></div>
      </header>

      <section className="novel-stage" onClick={advance}>
        <div className="chapter-label">CAPÍTULO {String(state?.current_chapter ?? 1).padStart(2, '0')} <span>—</span> {(state?.current_location || scenario?.name || 'PRIMEIRA CENA').toString().toUpperCase()}</div>
        {scenario && <button className="icon-button light edit-scenario-bg" aria-label="Alterar Fundo" title="Alterar fundo" onClick={(e) => { e.stopPropagation(); setUploadTarget('scenario'); fileInputRef.current?.click() }}><ImagePlus size={18} /></button>}
        {speaker?.image_url && <div key={speaker.id} className="novel-portrait">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={speaker.image_url} alt={speaker.name} /><button className="icon-button edit-char-img" aria-label="Alterar Imagem do Personagem" title="Alterar imagem" onClick={(e) => { e.stopPropagation(); setUploadTarget('character'); fileInputRef.current?.click() }}><ImagePlus size={18} /></button></div>}
        {!speaker?.image_url && !current && !thinking && !error && <div className="novel-hint"><Sparkles /> Preparando o palco…</div>}
        {!speaker?.image_url && speaker && <div className="novel-portrait missing-img"><button className="outline-button light" onClick={(e) => { e.stopPropagation(); setUploadTarget('character'); fileInputRef.current?.click() }}><ImagePlus size={18} /> Adicionar imagem</button></div>}
      </section>

      <section className="dialogue-panel">
        <input type="file" ref={fileInputRef} className="sr-only" accept="image/*" onChange={handleFileChange} />
        {loadingInit ? (
          <p className="dialogue-text dim">Abrindo sua história…</p>
        ) : thinking ? (
          <>
            <div className="dialogue-meta"><div className="speaker-mark pulse" /><span>NARRADOR</span><span className="meta-line" /></div>
            <p className="dialogue-text thinking">A história está se desenrolando<span className="dots"><i>.</i><i>.</i><i>.</i></span></p>
          </>
        ) : error ? (
          <>
            <div className="dialogue-meta"><div className="speaker-mark" /><span>AVISO</span><span className="meta-line" /></div>
            <p className="dialogue-text">{error}</p>
            <div className="novel-retry">{retry.current && <button className="outline-button light" onClick={() => retry.current?.()}>Tentar de novo</button>}{current && <button className="ghost-button light" onClick={() => setError('')}>Editar minha ação</button>}<button className="ghost-button light" onClick={onBack}>Voltar ao editor</button></div>
          </>
        ) : current ? (
          <>
            <div className="dialogue-meta"><div className="speaker-mark" /><span>{label.toUpperCase()}</span>{current.expression && current.expression !== 'neutral' && <span className="muted">{current.expression}</span>}<span className="meta-line" /><span className="muted">{cursor + 1}/{visible.length}</span><button className="icon-button light edit-msg-btn" aria-label="Editar mensagem" onClick={() => { setEditingMsg(current.id); setEditText(current.content) }}><Pencil size={14}/></button></div>
            {editingMsg === current.id ? (
              <div className="edit-message-box"><textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="dialogue-edit-input" /><button className="icon-button light" onClick={saveEdit}><Check size={18} /></button><button className="icon-button light" onClick={() => setEditingMsg(null)}><X size={18} /></button></div>
            ) : (
              <p className={`dialogue-text ${current.message_type === 'narration' ? 'is-narration' : ''}`} onClick={advance}>{current.message_type === 'dialogue' ? `“${current.content}”` : current.content}</p>
            )}
          </>
        ) : null}

        {!loadingInit && !thinking && !error && current && (
          atEnd ? (
            <div className="player-input"><input value={input} onChange={(e) => setInput(e.target.value)} maxLength={2000} placeholder={`O que ${player?.name || 'você'} faz, diz ou pergunta?`} aria-label="O que seu protagonista faz, diz ou pergunta" onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) send() }} /><button className="send-button" onClick={send} disabled={!input.trim()} aria-label="Enviar"><ArrowRight /></button></div>
          ) : (
            <button className="novel-next" onClick={advance}>Continuar <ChevronRight /></button>
          )
        )}
        <div className="novel-controls"><button onClick={() => openPanel('history')}><BookOpen /> Histórico</button><button onClick={() => openPanel('cast')}><UsersRound /> Elenco</button><button onClick={() => openPanel('memory')}><Sparkles /> Memória</button><button onClick={onBack}><X /> Sair</button></div>
      </section>

      {panel && (
        <div className="drawer-backdrop" onClick={() => setPanel(null)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="drawer-head"><strong>{panel === 'history' ? 'Histórico' : panel === 'cast' ? 'Elenco' : 'Memória do narrador'}</strong><button className="icon-button light" onClick={() => setPanel(null)} aria-label="Fechar"><X /></button></div>
            <div className="drawer-body">
              {panel === 'history' && <>
                {hasMore && <button className="outline-button light drawer-more" onClick={olderMessages}>Carregar mensagens anteriores</button>}
                {messages.map((m, i) => {
                  const idx = visible.findIndex((v) => v.id === m.id)
                  const who = m.sender_type === 'player' ? player?.name || 'Você' : m.sender_type === 'npc' ? npcById.get(m.character_id ?? '')?.name ?? 'NPC' : m.sender_type === 'system' ? 'CENA' : 'Narrador'
                  return <button key={m.id} className={`hist-item hist-${m.sender_type}`} disabled={idx < 0} onClick={() => { if (idx >= 0) { setCursor(idx); setPanel(null) } }} data-i={i}><span>{who}</span><p>{m.content}</p></button>
                })}
                {messages.length === 0 && <p className="drawer-empty">Nada aqui ainda.</p>}
                <p className="drawer-note">O histórico é somente leitura para não quebrar a continuidade da história.</p>
              </>}
              {panel === 'cast' && <>
                {player && <div className="cast-item"><div className="cast-avatar">{player.image_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={player.image_url} alt="" /> : <UserRound />}</div><div><strong>{player.name}</strong><span>VOCÊ CONTROLA</span></div></div>}
                {characters.map((c) => <div key={c.id} className="cast-item"><div className="cast-avatar">{c.image_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={c.image_url} alt="" /> : <UserRound />}</div><div><strong>{c.name || 'Sem nome'}</strong><span>{c.nickname || c.relationship_to_protagonist || 'NPC'}</span></div></div>)}
                {characters.length === 0 && <p className="drawer-empty">Nenhum personagem criado.</p>}
              </>}
              {panel === 'memory' && <>
                <p className="drawer-note">Fatos importantes que o narrador guardou. Você pode apagar o que não quiser que seja lembrado.</p>
                {memories.map((m) => <div key={m.id} className="mem-item"><div><span>{m.memory_type.toUpperCase()}</span><p>{m.content}</p></div><button className="icon-button light" aria-label="Apagar memória" onClick={() => svc.deleteMemory(m.id).then(() => setMemories((x) => x.filter((y) => y.id !== m.id))).catch((e) => notify(friendlyError(e), 'error'))}><Trash2 /></button></div>)}
                {memories.length === 0 && <p className="drawer-empty">Ainda não há memórias importantes.</p>}
              </>}
            </div>
          </aside>
        </div>
      )}
    </main>
  )
}
