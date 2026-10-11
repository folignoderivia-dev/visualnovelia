'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, ChevronRight, Save, Settings, Sparkles, Trash2, UserRound, UsersRound, X, Pencil, ImagePlus, Check, RotateCcw, Tag, Map as MapIcon, Smartphone, Heart, MessageCircle, Download, Upload } from 'lucide-react'
import type { Character, PlayerCharacter, Scenario, Story, StoryMemory, StoryMessage, StoryState } from '@/lib/types'
import * as svc from '@/lib/story/service'
import { sendPlayerAction, startStory } from '@/lib/gemini/client'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/ui/toast'

type Panel = null | 'history' | 'cast' | 'memory' | 'tags' | 'map' | 'tinder' | 'whatsapp'
const HIDDEN: StoryMessage['message_type'][] = ['scene_change', 'system']

export function VisualNovel({ storyId, onBack, onEdit }: { storyId: string; onBack: () => void; onEdit?: () => void }) {
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
  const [actionImage, setActionImage] = useState<string | null>(null)
  const actionImageRef = useRef<HTMLInputElement>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [memories, setMemories] = useState<StoryMemory[]>([])
  const [tags, setTags] = useState<any[]>([])
  const [tinderIndex, setTinderIndex] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [editingMsg, setEditingMsg] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadTarget, setUploadTarget] = useState<'scenario' | 'character' | string>(null as any)
  const [editingChar, setEditingChar] = useState<Character | null>(null)
  const retry = useRef<null | (() => void)>(null)
  const startedRef = useRef(false)

  const visible = useMemo(() => messages.filter((m) => !HIDDEN.includes(m.message_type)), [messages])
  const current = visible[Math.min(cursor, visible.length - 1)]
  const atEnd = visible.length === 0 || cursor >= visible.length - 1
  const npcById = useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters])
  const scenario = scenarios.find((s) => s.id === state?.current_scenario_id) ?? scenarios.find((s) => s.is_starting_scenario) ?? scenarios[0]
  const speaker = current?.sender_type === 'npc' && current.character_id ? npcById.get(current.character_id) : current?.sender_type === 'player' ? player : undefined
  const currentExpr = current?.expression || 'neutral'
  const speakerImg = speaker ? ((speaker as any).expressions?.[currentExpr] || speaker.image_url) : null

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

  const run = useCallback(async (kind: 'start' | 'turn', action = '', img?: string) => {
    if (busy.current) return
    busy.current = true
    const prevVisible = visibleCountRef.current
    retry.current = () => { run(kind, action, img) }
    setThinking(true); setError('')
    try {
      let res: { messages: StoryMessage[]; state: StoryState }
      try {
        res = kind === 'start' ? await startStory(storyId) : await sendPlayerAction(storyId, action, img)
      } catch (e) {
        const recovered = await recover(kind, action)
        if (!recovered) throw e
        res = recovered
      }
      applyResponse(res.messages, res.state)
      setCursor(prevVisible) // primeiro bloco novo
      if (kind === 'turn') {
        setInput('');
      }
    } catch (e) {
      setError(friendlyError(e, 'O narrador não conseguiu responder. Tente novamente.'))
    } finally { busy.current = false; setThinking(false) }
  }, [storyId, applyResponse, recover])

  async function regenerateTurn() {
    if (busy.current || thinking) return;
    const lastPlayerIdx = messages.findLastIndex(m => m.sender_type === 'player');
    if (lastPlayerIdx === -1) { notify('Nenhuma ação encontrada.', 'error'); return; }
    const toDelete = messages.slice(lastPlayerIdx);
    const oldAction = messages[lastPlayerIdx].content;
    setMessages(prev => prev.slice(0, lastPlayerIdx));
    setCursor(Math.max(0, messages.slice(0, lastPlayerIdx).filter(m => !HIDDEN.includes(m.message_type)).length - 1));
    try {
      await Promise.all(toDelete.map(m => svc.deleteMessage(m.id)));
    } catch(e) { console.error(e); }
    run('turn', oldAction + '\n\n[SISTEMA: REFAÇA A CENA. DESTA VEZ OBRIGATORIAMENTE DESTAQUE E TRAGA UM PERSONAGEM DIFERENTE PARA A CENA. TENTE USAR O MÁXIMO DE PERSONAGENS DO ELENCO.]');
  }

  // ---------- carga inicial / continuar ----------
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [b, st, msgs] = await Promise.all([svc.loadBundle(storyId), svc.loadState(storyId), svc.loadRecentMessages(storyId, 40)])
        if (!alive) return
        setStory(b.story); setScenarios(b.scenarios); setCharacters(b.characters); setPlayer(b.player); setState(st); setTags(b.tags || [])
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
    const isExpr = uploadTarget.startsWith('expr_')
    let id: string | undefined
    let exprType = ''
    if (isExpr) {
      const parts = uploadTarget.split('_')
      id = parts[1]
      exprType = parts[2]
    } else {
      id = uploadTarget === 'scenario' ? scenario?.id : speaker?.id
    }
    if (!id) return
    try {
      const ext = file.name.split('.').pop()
      const path = `${story?.user_id}/${storyId}/${id}-${Date.now()}.${ext}`
      const isPlayer = !isExpr && uploadTarget !== 'scenario' && current?.sender_type === 'player'; const bucket = uploadTarget === 'scenario' ? 'scenario-assets' : isPlayer ? 'player-assets' : 'character-assets'
      const { supabase } = await import('@/lib/supabase/client')
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
      if (error) throw error
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path)
      
      if (uploadTarget === 'scenario' && scenario) {
        const up = { ...scenario, image_url: pub.publicUrl, image_path: path }
        await svc.saveScenario(up)
        setScenarios((s) => s.map((x) => x.id === id ? up : x))
      } else if (isExpr) {
        await svc.saveExpression(id, exprType, pub.publicUrl, path)
        const c = characters.find(x => x.id === id)
        if (c) {
          const up = { ...c, expressions: { ...(c as any).expressions, [exprType]: pub.publicUrl } }
          if (exprType === 'neutral') up.image_url = pub.publicUrl
          await svc.saveCharacter(up as any)
          setCharacters((ch) => ch.map((x) => x.id === id ? up : x))
          if (editingChar?.id === id) setEditingChar(up)
        }
      } else if (speaker) {
        const up = { ...speaker, image_url: pub.publicUrl, image_path: path }
        if (isPlayer) {
          await svc.savePlayer(up as any)
          setPlayer(up as any)
        } else {
          await svc.saveCharacter(up as any)
          setCharacters((c) => c.map((x) => x.id === id ? (up as any) : x))
        }
      }
      notify('Imagem atualizada com sucesso.')
    } catch (err) {
      notify(friendlyError(err, 'Erro ao enviar imagem.'), 'error')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
      setUploadTarget(null as any)
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
      await run('start')
      setLoadingInit(false)
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
        <div className="novel-actions"><button className="icon-button light" aria-label="Reiniciar História" title="Recomeçar do zero" onClick={handleRestart}><RotateCcw /></button><button className="icon-button light" aria-label="Salvar" onClick={() => notify('Seu progresso é salvo automaticamente.')}><Save /></button><button className="icon-button light" aria-label="Configurações" onClick={() => openPanel('memory')}><Settings /></button><button className="icon-button light" onClick={() => openPanel('tags')}><Tag /></button><button className="icon-button light" aria-label="Mapa / Viagem Rápida" onClick={() => openPanel('map')}><MapIcon /></button><button className="icon-button light" aria-label="App de Namoro" title="Dating App / Tinder" onClick={() => openPanel('tinder')}><Smartphone /></button><button className="icon-button light" aria-label="WhatsApp" title="WhatsApp Chat" onClick={() => openPanel('whatsapp')}><MessageCircle /></button>{onEdit && <button className="icon-button light" aria-label="Abrir Painel do Criador" title="Ir para o Editor (Cenários, Regras, Resumo)" onClick={onEdit}><Pencil /></button>}</div>
      </header>

      <section className="novel-stage" onClick={advance}>
        <div className="chapter-label">CAPÍTULO {String(state?.current_chapter ?? 1).padStart(2, '0')} <span>—</span> {(state?.current_location || scenario?.name || 'PRIMEIRA CENA').toString().toUpperCase()}</div>
        {scenario && <button className="icon-button light edit-scenario-bg" aria-label="Alterar Fundo" title="Alterar fundo" onClick={(e) => { e.stopPropagation(); setUploadTarget('scenario'); fileInputRef.current?.click() }}><ImagePlus size={18} /></button>}
        {speaker && speakerImg && <div key={speaker.id} className="novel-portrait">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={speakerImg} alt={speaker.name} /><button className="icon-button edit-char-img" aria-label="Alterar Imagem do Personagem" title="Alterar imagem" onClick={(e) => { e.stopPropagation(); setUploadTarget('character'); fileInputRef.current?.click() }}><ImagePlus size={18} /></button></div>}
        {!speakerImg && !current && !thinking && !error && <div className="novel-hint"><Sparkles /> Preparando o palco…</div>}
        {!speakerImg && speaker && <div className="novel-portrait missing-img"><button className="outline-button light" onClick={(e) => { e.stopPropagation(); setUploadTarget('character'); fileInputRef.current?.click() }}><ImagePlus size={18} /> Adicionar imagem</button></div>}
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
            <div className="dialogue-meta"><div className="speaker-mark" /><span>{label.toUpperCase()}</span>{current.expression && current.expression !== 'neutral' && <span className="muted">{current.expression}</span>}<span className="meta-line" /><span className="muted">{cursor + 1}/{visible.length}</span><button className="icon-button light edit-msg-btn" aria-label="Regerar com outro personagem" title="Regerar Cena (Trocar Personagem)" onClick={regenerateTurn}><RotateCcw size={14}/></button><button className="icon-button light edit-msg-btn" aria-label="Editar mensagem" onClick={() => { setEditingMsg(current.id); setEditText(current.content) }}><Pencil size={14}/></button></div>
            {editingMsg === current.id ? (
              <div className="edit-message-box"><textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="dialogue-edit-input" /><button className="icon-button light" onClick={saveEdit}><Check size={18} /></button><button className="icon-button light" onClick={() => setEditingMsg(null)}><X size={18} /></button></div>
            ) : (
              <p className={`dialogue-text ${current.message_type === 'narration' ? 'is-narration' : ''}`} onClick={advance}>{current.message_type === 'dialogue' ? `“${current.content}”` : current.content}</p>
            )}
          </>
        ) : null}

        {!loadingInit && !thinking && !error && current && (
          atEnd ? (
            <div className="player-input-area">
              {Array.isArray((state?.state_data as any)?.pending_choices) && ((state?.state_data as any)?.pending_choices.length > 0) && (
                <div className="choices-grid">
                  {(state?.state_data as any).pending_choices.map((choice: string, idx: number) => (
                    <button key={idx} className="choice-button outline-button light" onClick={() => run('turn', choice)}>
                      {choice}
                    </button>
                  ))}
                </div>
              )}
              <div className="player-toolbar">
                <button onClick={() => setInput(input + "[Roleplay Imersivo] ")} title="Narrativa detalhada">🎭</button>
                <button onClick={() => setInput(input + "[Batalha] ")} title="Focar em combate">⚔️</button>
                <button onClick={() => setInput(input + "[Romance] ")} title="Focar em romance">❤️</button>
                {tags.map(t => <button key={t.id} onClick={() => setInput(input + `[${t.name}] `)} title={t.prompt}>🏷️ {t.name}</button>)}
                <button onClick={() => { const r = Math.floor(Math.random()*20)+1; setInput(input + `[O jogador rolou um D20 e tirou: ${r}] `) }} title="Rolar D20">🎲 D20</button>
                <button onClick={() => setInput(input + "[ENCERRAR CENA: Finalize a conversa atual. Force uma despedida e na próxima cena dê prioridade a OUTROS personagens do elenco.] ")} title="Encerrar cena e trocar elenco">🔚 Encerrar Cena</button>
                <button onClick={() => {
                  const npcs = characters;
                  if (npcs.length > 0) {
                    const randomNpc = npcs[Math.floor(Math.random() * npcs.length)];
                    setInput(input + `[INCLUIR PERSONAGEM: Traga ${randomNpc.name} para a cena agora.] `);
                  }
                }} title="Forçar um personagem aleatório a aparecer">🎲 Aleatório</button>
                <select onChange={(e) => {
                  if (e.target.value) {
                    setInput(input + `[INCLUIR PERSONAGEM: Traga ${e.target.value} para a cena agora.] `);
                    e.target.value = "";
                  }
                }} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '2px 8px', fontSize: '11px', outline: 'none', cursor: 'pointer' }}>
                  <option value="">👤 Chamar...</option>
                  {characters.map(c => <option key={c.id} value={c.name} style={{ color: '#000' }}>{c.name}</option>)}
                </select>
              </div>
              <div className="player-input">
                {actionImage && <div style={{ position: 'absolute', bottom: 'calc(100% + 10px)', left: 0, padding: '4px', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)' }}>
                  <img src={actionImage} style={{ height: '60px', borderRadius: '4px' }} alt="" />
                  <button onClick={() => setActionImage(null)} style={{ position: 'absolute', top: '-8px', right: '-8px', background: 'red', color: 'white', borderRadius: '50%', width: '20px', height: '20px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none' }}>X</button>
                </div>}
                <input type="file" ref={actionImageRef} className="sr-only" accept="image/*" onChange={(e) => {
                  const f = (e.target as any)?.files?.[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = (re) => setActionImage(re.target?.result as string);
                  reader.readAsDataURL(f);
                }} />
                <button className="icon-button light" style={{ opacity: 0.5 }} onClick={() => actionImageRef.current?.click()} title="Anexar Imagem para Visão IA"><ImagePlus size={18} /></button>
                <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={2000} placeholder={`Ou digite o que ${player?.name || 'você'} faz, diz ou pergunta livremente...`} aria-label="Ação livre" onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) send() }} />
                <button className="send-button" onClick={send} disabled={!input.trim()} aria-label="Enviar"><ArrowRight /></button>
              </div>
            </div>
          ) : (
            <div className="novel-nav-buttons">
              {cursor > 0 && <button className="novel-prev" onClick={(e) => { e.stopPropagation(); setCursor((c) => Math.max(0, c - 1)) }}><ChevronRight style={{ transform: 'rotate(180deg)' }} /> Voltar</button>}
              <button className="novel-next" onClick={advance}>Continuar <ChevronRight /></button>
            </div>
          )
        )}
        <div className="novel-controls"><button onClick={() => openPanel('history')}><BookOpen /> Histórico</button><button onClick={() => openPanel('cast')}><UsersRound /> Elenco</button><button onClick={() => openPanel('memory')}><Sparkles /> Memória</button><button onClick={onBack}><X /> Sair</button></div>
      </section>

      {panel && (
        <div className="drawer-backdrop" onClick={() => setPanel(null)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="drawer-head"><strong>{panel === 'history' ? 'Histórico' : panel === 'cast' ? 'Elenco' : panel === 'tags' ? 'Tags Customizadas' : panel === 'map' ? 'Viagem Rápida' : panel === 'tinder' ? 'App de Namoro' : 'Memória do narrador'}</strong><button className="icon-button light" onClick={() => setPanel(null)} aria-label="Fechar"><X /></button></div>
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
              {panel === 'cast' && !editingChar && <>
<div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}><button className="outline-button light" onClick={() => { const i = document.createElement('input'); i.type='file'; i.accept='.json'; i.onchange=async(e)=>{ const f = (e.target as any)?.files?.[0]; if(f){ try{ const t = await f.text(); const d = JSON.parse(t); const { supabase } = await import('@/lib/supabase/client'); const { data: nc } = await supabase.from('characters').insert({ story_id: storyId, name: d.name, nickname: d.nickname, age: d.age, appearance: d.appearance, personality: d.personality, history: d.history, goals: d.goals, fears: d.fears, secrets: d.secrets, speech_style: d.speech_style, relationship_to_protagonist: d.relationship_to_protagonist, extra_information: d.extra_information, image_url: d.image_url }).select().single(); if(nc) { setCharacters(x => [...x, nc]); notify('Personagem importado com sucesso!'); } }catch(err){ notify('Erro ao importar JSON', 'error'); } } }; i.click(); }}><Upload size={14}/> Importar Personagem</button></div>
                {player && <div className="cast-item"><div className="cast-avatar">{player.image_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={player.image_url} alt="" /> : <UserRound />}</div><div><strong>{player.name}</strong><span>VOCÊ CONTROLA</span></div></div>}
                {characters.map((c) => (
                  <div key={c.id} className="cast-item">
                    <div className="cast-avatar">{c.image_url ? <img src={c.image_url} alt="" /> : <UserRound />}</div>
                    <div style={{ flex: 1 }}><strong>{c.name || "Sem nome"}</strong><span>{c.nickname || c.relationship_to_protagonist || "NPC"}</span>{c.relationship && typeof c.relationship.relationship_value === "number" && (<div className="rel-bar-wrap" title={c.relationship.description}><div className="rel-bar"><div className="rel-fill" style={{ width: `${Math.max(0, Math.min(100, c.relationship.relationship_value))}%` }} /></div><span className="rel-val">{c.relationship.relationship_value}/100</span></div>)}</div>
                    <button className="icon-button light" onClick={() => setEditingChar(c)} aria-label="Editar Personagem"><Pencil size={15} /></button>
                  </div>
                ))}
                {characters.length === 0 && <p className="drawer-empty">Nenhum personagem criado.</p>}
              </>}
              {panel === 'cast' && editingChar && (
                <div className="char-editor-panel" style={{ overflowY: "auto", maxHeight: "75vh", paddingRight: "8px" }}>
                  <div className="drawer-head" style={{ padding: 0, marginBottom: '20px', background: 'none' }}>
                    <button className="outline-button light" onClick={() => setEditingChar(null)}><ArrowLeft size={16} /> Voltar</button><button className="icon-button light" title="Exportar JSON" onClick={() => { const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(editingChar, null, 2)); const el = document.createElement('a'); el.setAttribute('href', dataStr); el.setAttribute('download', editingChar.name + '.json'); document.body.appendChild(el); el.click(); el.remove(); notify('Exportado!'); }}><Download size={16} /></button>
                    <strong style={{ flex: 1, textAlign: 'right' }}>{editingChar.name}</strong>
                  </div>
                  <div className="field"><span>Nome</span><input value={editingChar.name} onChange={(e) => setEditingChar({ ...editingChar, name: e.target.value })} /></div>
                  <div className="field"><span>Apelido / Função</span><input value={editingChar.nickname} onChange={(e) => setEditingChar({ ...editingChar, nickname: e.target.value })} /></div><div className="field"><span>Personalidade (Prompt)</span><textarea value={editingChar.personality} onChange={(e) => setEditingChar({ ...editingChar, personality: e.target.value })} rows={3} /></div><div className="field"><span>Passado / História</span><textarea value={editingChar.history} onChange={(e) => setEditingChar({ ...editingChar, history: e.target.value })} rows={3} /></div><div className="field"><span>Pensamentos e Objetivos com você</span><textarea value={editingChar.relationship_to_protagonist} onChange={(e) => setEditingChar({ ...editingChar, relationship_to_protagonist: e.target.value })} rows={3} placeholder="Diário ou pensamentos secretos do NPC em relação ao seu personagem..." /></div><div className="field"><span>Aparência Física</span><textarea value={editingChar.appearance} onChange={(e) => setEditingChar({ ...editingChar, appearance: e.target.value })} rows={2} /></div><div className="field"><span>Estilo de Fala</span><textarea value={editingChar.speech_style} onChange={(e) => setEditingChar({ ...editingChar, speech_style: e.target.value })} rows={2} /></div><div className="field"><span>Objetivos e Medos</span><textarea value={editingChar.goals} onChange={(e) => setEditingChar({ ...editingChar, goals: e.target.value })} rows={2} /></div>{editingChar.relationship && typeof editingChar.relationship.relationship_value === "number" && (<div className="field"><span>Pontos de Relacionamento (0 a 100)</span><input type="number" min={0} max={100} value={editingChar.relationship.relationship_value} onChange={(e) => setEditingChar({ ...editingChar, relationship: { ...editingChar.relationship!, relationship_value: Number(e.target.value) } })} style={{ padding: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid #444", color: "#fff" }} /></div>)}
                  
                  <div className="expressions-grid">
                    <span>Expressões Visuais</span>
                    <div className="expr-slots">
                      {['neutral', 'happy', 'angry', 'ashamed', 'intimate', 'foto_casual', 'foto_sensual', 'foto_pe', 'foto_18'].map((expr) => {
                        const img = (editingChar as any).expressions?.[expr] || (expr === 'neutral' ? editingChar.image_url : null)
                        return (
                          <div key={expr} className="expr-slot" onClick={() => { setUploadTarget(`expr_${editingChar.id}_${expr}`); fileInputRef.current?.click() }}>
                            {img ? <img src={img} alt={expr} /> : <div className="expr-empty"><ImagePlus size={16}/></div>}
                            <small>{expr.replace('foto_', 'foto ')}</small>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <button className="primary-button" style={{ marginTop: '20px', width: '100%' }} onClick={async () => {
                    try {
                      await svc.saveCharacter(editingChar)
                      setCharacters(ch => ch.map(c => c.id === editingChar.id ? editingChar : c))
                      setEditingChar(null)
                    } catch (e) { notify(friendlyError(e), 'error') }
                  }}>Salvar Alterações</button>
                </div>
              )}
              {panel === 'memory' && <>
                <p className="drawer-note">Fatos importantes que o narrador guardou. Você pode apagar o que não quiser que seja lembrado.</p>
                {memories.map((m) => <div key={m.id} className="mem-item"><div><span>{m.memory_type.toUpperCase()}</span><p>{m.content}</p></div><button className="icon-button light" aria-label="Apagar memória" onClick={() => svc.deleteMemory(m.id).then(() => setMemories((x) => x.filter((y) => y.id !== m.id))).catch((e) => notify(friendlyError(e), 'error'))}><Trash2 /></button></div>)}
                {memories.length === 0 && <p className="drawer-empty">Ainda não há memórias importantes.</p>}
              </>}
              {panel === 'tags' && <>
                <p className="drawer-note">Crie atalhos rápidos de contexto (ex: "Minigame") para injetar regras e forçar a IA a alterar o rumo da cena.</p>
                {tags.map((t) => (
                  <div key={t.id} className="mem-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <strong>{t.name}</strong>
                      <button className="icon-button light" aria-label="Apagar" onClick={() => svc.deleteTag(t.id).then(() => setTags((x) => x.filter((y) => y.id !== t.id))).catch((e) => notify(friendlyError(e), 'error'))}><Trash2 /></button>
                    </div>
                    <p style={{ fontSize: '11px', marginTop: '4px' }}>{t.prompt}</p>
                  </div>
                ))}
                <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input id="newTagName" placeholder="Nome da Tag (ex: Sala de Aula)" style={{ padding: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid #444', color: '#fff' }} />
                  <textarea id="newTagPrompt" placeholder="Prompt a ser forçado (ex: A aula do professor começou, ele fará perguntas aos alunos.)" rows={3} style={{ padding: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid #444', color: '#fff' }} />
                  <button className="primary-button" onClick={async () => {
                    const name = (document.getElementById('newTagName') as HTMLInputElement).value
                    const prompt = (document.getElementById('newTagPrompt') as HTMLTextAreaElement).value
                    if (!name || !prompt) return
                    try {
                      const saved = await svc.saveTag({ story_id: storyId, name, prompt, id: 'new-' + Date.now() })
                      setTags(x => [...x, saved])
                      ;(document.getElementById('newTagName') as HTMLInputElement).value = '';
                      ;(document.getElementById('newTagPrompt') as HTMLTextAreaElement).value = '';
                    } catch(e) { notify(friendlyError(e), 'error') }
                  }}>Adicionar Tag</button>
                </div>
              </>}
              {panel === 'map' && <>
                <p className="drawer-note">Viagem Rápida. Clique em um cenário para forçar a história a mudar para lá agora.</p>
                <div className="map-grid" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {scenarios.map(sc => (
                    <div key={sc.id} className="map-node" onClick={() => {
                      setInput(input + `[MUDAR PARA O CENÁRIO: ${sc.name}] `)
                      setPanel(null)
                    }} style={{ cursor: 'pointer', position: 'relative', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)' }}>
                      {sc.image_url ? <img src={sc.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }} /> : <div style={{ width: '100%', height: '100%', background: '#222' }} />}
                      <div style={{ position: 'absolute', inset: 0, padding: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}>
                        <strong style={{ fontSize: '14px', color: '#fff' }}>{sc.name}</strong>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input id="newScenName" placeholder="Nome do novo local (ex: Floresta Negra)" style={{ padding: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid #444', color: '#fff' }} />
                  <button className="primary-button" onClick={async () => {
                    const name = (document.getElementById('newScenName') as HTMLInputElement).value;
                    if (!name) return;
                    try {
                      const { supabase } = await import('@/lib/supabase/client');
                      const { data: newSc } = await supabase.from('scenarios').insert({ story_id: storyId, name }).select().single();
                      if (newSc) setScenarios(s => [...s, newSc]);
                      (document.getElementById('newScenName') as HTMLInputElement).value = '';
                    } catch(e) { notify(String(e), 'error') }
                  }}>Criar Novo Cenário</button>
                </div>
              </>}
              {panel === 'tinder' && (() => {
                const tinderCharacters = characters.filter(c => !c.relationship || c.relationship.relationship_value < 10);
                if (tinderCharacters.length === 0) return <p className="drawer-note">Ninguém novo por perto... Tente criar novos personagens ou abaixar os pontos de amizade de alguém!</p>;
                const currentTinder = tinderCharacters[tinderIndex % tinderCharacters.length];
                return <>
                  <p className="drawer-note">Modo Aplicativo de Namoro. Apenas desconhecidos (Relacionamento &lt; 10).</p>
                  <div className="tinder-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(30,30,30,0.9)', padding: '20px', borderRadius: '16px', textAlign: 'center', border: '1px solid #444', marginTop: '20px' }}>
                     {currentTinder.image_url ? (
                       <img src={currentTinder.image_url!} style={{ width: '200px', height: '200px', objectFit: 'cover', borderRadius: '12px' }} alt="" />
                     ) : (
                       <div style={{ width: '200px', height: '200px', background: '#333', borderRadius: '12px', display: 'grid', placeItems: 'center' }}><UserRound size={40} /></div>
                     )}
                     <h3 style={{ marginTop: '15px', fontSize: '24px', color: '#fff' }}>{currentTinder.name}</h3>
                     <p style={{ fontSize: '14px', color: '#ccc', margin: '10px 0', minHeight: '40px' }}>{currentTinder.nickname || 'Buscando conexão...'}</p>
                     <div style={{ display: 'flex', gap: '30px', marginTop: '20px' }}>
                        <button className="icon-button" style={{ width: '60px', height: '60px', background: '#333', color: '#ff4444', borderRadius: '50%', display: 'flex', placeItems: 'center', justifyContent: 'center' }} onClick={() => setTinderIndex(tinderIndex + 1)} title="Passar"><X size={30}/></button>
                        <button className="icon-button" style={{ width: '60px', height: '60px', background: '#333', color: '#44ff44', borderRadius: '50%', display: 'flex', placeItems: 'center', justifyContent: 'center' }} onClick={() => {
                           setInput(input + `[O JOGADOR DEU MATCH NO APLICATIVO COM ${currentTinder.name} E ELES COMEÇARAM A CONVERSAR. FAÇA UM ROLEPLAY IMERSIVO DE CHAT DE CELULAR AGORA. AJA COMO UM APLICATIVO DE CELULAR.] `);
                           setPanel(null);
                        }} title="Dar Match"><Heart size={30}/></button>
                     </div>
                  </div>
                </>;
              })()}
              {panel === 'whatsapp' && (() => {
                const wppCharacters = characters.filter(c => c.relationship && c.relationship.relationship_value >= 10);
                return <>
                  <p className="drawer-note">WhatsApp. Selecione um contato conhecido (Amizade &gt;= 10) para abrir o chat.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                    {wppCharacters.length === 0 && <p style={{color: '#999'}}>Nenhum contato com intimidade suficiente ainda.</p>}
                    {wppCharacters.map(c => (
                       <button key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', background: 'rgba(37, 211, 102, 0.1)', border: '1px solid #25D366', padding: '15px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', color: '#fff' }} onClick={() => {
                          setInput(input + `[O JOGADOR ABRIU O WHATSAPP E MANDOU MENSAGEM PARA ${c.name}. INICIE O MODO MENSAGEM DE TEXTO: a partir de agora, responda apenas como as mensagens de celular dela, curtas, ignorando se a amizade for baixa, ou enviando fotos sensuais/casuais se a amizade for alta e o jogador pedir.] `);
                          setPanel(null);
                       }}>
                          <img src={c.image_url || ''} style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }} alt=""/>
                          <div style={{ flex: 1 }}>
                             <strong style={{ display: 'block', fontSize: '16px' }}>{c.name}</strong>
                             <span style={{ fontSize: '12px', color: '#25D366' }}>Online</span>
                          </div>
                          <MessageCircle color="#25D366" />
                       </button>
                    ))}
                  </div>
                </>;
              })()}
            </div>
          </aside>
        </div>
      )}
    </main>
  )
}
