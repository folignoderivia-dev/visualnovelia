'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, ChevronRight, Save, Settings, Sparkles, Trash2, UserRound, UsersRound, X, Pencil, ImagePlus, Check, RotateCcw, Tag, Map as MapIcon, Smartphone, Heart, MessageCircle, Download, Upload, Phone, Video, Send, Flame, CheckCheck, Swords, Camera, Smile } from 'lucide-react'
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
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [tinderIndex, setTinderIndex] = useState(0)
  const [tinderMatched, setTinderMatched] = useState<Character | null>(null)
  const [tinderChatContact, setTinderChatContact] = useState<Character | null>(null)
  const [tinderInput, setTinderInput] = useState('')
  const [wppContact, setWppContact] = useState<Character | null>(null)
  const [wppInput, setWppInput] = useState('')
  const [showMobileLeft, setShowMobileLeft] = useState(false)
  const [showMobileRight, setShowMobileRight] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [editingMsg, setEditingMsg] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadTarget, setUploadTarget] = useState<'scenario' | 'character' | string>(null as any)
  const [editingChar, setEditingChar] = useState<Character | null>(null)
  const retry = useRef<null | (() => void)>(null)
  const startedRef = useRef(false)
  const wppEndRef = useRef<HTMLDivElement>(null)
  const tinderEndRef = useRef<HTMLDivElement>(null)

  const handleInsertTag = useCallback((tagText: string) => {
    setInput((prev) => (prev.trim() ? `${prev.trim()} ${tagText} ` : `${tagText} `))
    notify(`Tag adicionada: ${tagText}`)
    setShowShortcuts(false)
    setShowMobileLeft(false)
  }, [notify])

  useEffect(() => {
    if (panel === 'whatsapp' && wppContact) {
      setTimeout(() => wppEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
    }
  }, [panel, wppContact, messages, thinking])

  useEffect(() => {
    if (panel === 'tinder' && tinderChatContact) {
      setTimeout(() => tinderEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
    }
  }, [panel, tinderChatContact, messages, thinking])

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
        setActionImage(null);
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
    const hasText = input.trim().length > 0
    const hasImg = Boolean(actionImage)
    if ((!hasText && !hasImg) || busy.current || thinking || !atEnd) return
    const action = hasText ? input.trim() : '[O jogador mostra uma foto/imagem e aguarda sua reação]'
    const imgToSend = actionImage || undefined
    run('turn', action, imgToSend)
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
    const isExpr = uploadTarget.startsWith('expr:') || uploadTarget.startsWith('expr_')
    let id: string | undefined
    let exprType = ''
    if (isExpr) {
      const parts = uploadTarget.split(':')
      if (parts.length >= 3) {
        id = parts[1]
        exprType = parts[2]
      } else {
        const uParts = uploadTarget.split('_')
        id = uParts[1]
        exprType = uParts.slice(2).join('_')
      }
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
    } catch (err: any) {
      console.error('[UPLOAD_ERROR]', err);
      const details = err?.message || err?.error_description || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      notify('Erro ao enviar imagem: ' + details, 'error')
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
      {/* TOP BAR MOBILE - COMPACTA E NÃO ATROPELA A TELA */}
      <div className="vn-mobile-top-bar" onClick={(e) => e.stopPropagation()}>
        <button className="vn-mobile-trigger" onClick={() => { setShowMobileLeft(!showMobileLeft); setShowMobileRight(false); }}>
          <Swords size={14}/> <span>RPG</span>
        </button>
        <span className="vn-mobile-title">{title}</span>
        <button className="vn-mobile-trigger" onClick={() => { setShowMobileRight(!showMobileRight); setShowMobileLeft(false); }}>
          <Settings size={14}/> <span>MENU</span>
        </button>
      </div>

      {(showMobileLeft || showMobileRight) && (
        <div className="vn-mobile-scrim" onClick={() => { setShowMobileLeft(false); setShowMobileRight(false); }} />
      )}

      {/* HUD LATERAL ESQUERDO: COMANDOS DE NARRATIVA & RPG */}
      <aside className={`vn-game-sidebar-left ${showMobileLeft ? 'mobile-open' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="vn-side-brand">
          <span className="vn-brand-crest">❖</span>
          <span className="vn-brand-title">{title}</span>
          {showMobileLeft && <button className="icon-button light mobile-close" onClick={() => setShowMobileLeft(false)}><X size={14}/></button>}
        </div>
        <nav className="vn-side-actions">
          <button className="vn-side-btn" onClick={() => { openPanel('history'); setShowMobileLeft(false); }} title="Histórico da História"><BookOpen size={15}/> <span>LOG / HISTÓRICO</span></button>
          <button className="vn-side-btn" onClick={() => { openPanel('cast'); setShowMobileLeft(false); }} title="Elenco de Personagens"><UsersRound size={15}/> <span>ELENCO</span></button>
          <button className="vn-side-btn" onClick={() => { openPanel('memory'); setShowMobileLeft(false); }} title="Memória do Mundo"><Sparkles size={15}/> <span>MEMÓRIA</span></button>
          <button className="vn-side-btn" onClick={() => { regenerateTurn(); setShowMobileLeft(false); }} title="Regerar Cena / Trocar Personagem"><RotateCcw size={15}/> <span>REGERAR</span></button>
          {current && <button className="vn-side-btn" onClick={() => { setEditingMsg(current.id); setEditText(current.content); setShowMobileLeft(false); }} title="Editar fala"><Pencil size={15}/> <span>EDITAR FALA</span></button>}
          
          <div className="vn-side-divider" />

          {/* Grimório / Ações RPG */}
          <button className={`vn-side-btn vn-side-rpg ${showShortcuts ? 'active' : ''}`} onClick={() => { setShowShortcuts(true); setShowMobileLeft(false); }} title="Abrir Grimório de Ações e Tags RPG">
            <Swords size={15}/> <span>⚔️ AÇÕES RPG</span> <small>▶</small>
          </button>
        </nav>
      </aside>

      {/* HUD LATERAL DIREITO: MENU DE SISTEMA, VIAGEM & CONFIGURAÇÕES */}
      <aside className={`vn-game-sidebar-right ${showMobileRight ? 'mobile-open' : ''}`} onClick={(e) => e.stopPropagation()}>
        <nav className="vn-side-actions">
          <button className="vn-side-btn" onClick={() => { notify('Progresso salvo automaticamente.'); setShowMobileRight(false); }} title="Salvar progresso"><Save size={15}/> <span>SALVAR</span></button>
          <button className="vn-side-btn" onClick={() => { openPanel('tags'); setShowMobileRight(false); }} title="Gerenciar Tags"><Tag size={15}/> <span>TAGS</span></button>
          <button className="vn-side-btn" onClick={() => { openPanel('map'); setShowMobileRight(false); }} title="Mapa Mundi"><MapIcon size={15}/> <span>MAPA</span></button>
          <button className="vn-side-btn vn-side-accent" onClick={() => { openPanel('tinder'); setShowMobileRight(false); }} title="App de Encontros"><Smartphone size={15}/> <span>TINDER</span></button>
          <button className="vn-side-btn vn-side-whatsapp" onClick={() => { openPanel('whatsapp'); setShowMobileRight(false); }} title="Chat Celular"><MessageCircle size={15}/> <span>WHATSAPP</span></button>
          {onEdit && <button className="vn-side-btn vn-side-editor" onClick={() => { onEdit(); setShowMobileRight(false); }} title="Editor do Criador"><Pencil size={15}/> <span>EDITOR</span></button>}
          <div className="vn-side-divider" />
          <button className="vn-side-btn" onClick={() => { handleRestart(); setShowMobileRight(false); }} title="Reiniciar do zero"><RotateCcw size={15}/> <span>REINICIAR</span></button>
          <button className="vn-side-btn vn-side-exit" onClick={() => { onBack(); setShowMobileRight(false); }} title="Sair do Jogo"><ArrowLeft size={16}/> <span>SAIR</span></button>
        </nav>
      </aside>

      <section className="novel-stage" onClick={advance}>
        <div className="chapter-label">
          <span>CAPÍTULO {String(state?.current_chapter ?? 1).padStart(2, '0')}</span>
          <span className="dot">•</span>
          <span>{(state?.current_location || scenario?.name || 'PRIMEIRA CENA').toString().toUpperCase()}</span>
        </div>

        {scenario && (
          <button className="icon-button light edit-scenario-bg" aria-label="Alterar Fundo" title="Alterar fundo do cenário" onClick={(e) => { e.stopPropagation(); setUploadTarget('scenario'); fileInputRef.current?.click() }}>
            <ImagePlus size={18} />
          </button>
        )}

        {/* SPRITE DO PERSONAGEM EM PÉ NO CENÁRIO (Sem atravessar o diálogo, com moldura e alta definição) */}
        {speaker && speakerImg && (
          <div key={speaker.id} className="novel-portrait-frame">
            <div className="novel-portrait-inner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={speakerImg} alt={speaker.name} />
              <button className="icon-button edit-char-img" aria-label="Alterar Imagem do Personagem" title="Alterar imagem do personagem" onClick={(e) => { e.stopPropagation(); setUploadTarget('character'); fileInputRef.current?.click() }}>
                <ImagePlus size={16} />
              </button>
            </div>
          </div>
        )}

        {!speakerImg && !current && !thinking && !error && (
          <div className="novel-hint"><Sparkles /> Preparando o palco…</div>
        )}

        {!speakerImg && speaker && (
          <div className="novel-portrait-frame missing-img">
            <button className="outline-button light" onClick={(e) => { e.stopPropagation(); setUploadTarget('character'); fileInputRef.current?.click() }}>
              <ImagePlus size={18} /> Adicionar imagem
            </button>
          </div>
        )}

        {/* BALÕES DE ESCOLHAS NO ESTILO DA IMAGEM 3 (Speech bubble choice buttons) */}
        {!loadingInit && !thinking && !error && atEnd && Array.isArray((state?.state_data as any)?.pending_choices) && ((state?.state_data as any)?.pending_choices.length > 0) && (
          <div className="vn-choices-balloon-row" onClick={(e) => e.stopPropagation()}>
            {(state?.state_data as any).pending_choices.map((choice: string, idx: number) => (
              <button
                key={idx}
                className="vn-choice-bubble"
                onClick={() => run('turn', choice)}
              >
                <span className="vn-bubble-pointer" />
                <span className="vn-bubble-text">{choice}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* CAIXA DE DIÁLOGO PURA DA PERSONAGEM (Exatamente igual à Alisa - Imagem 2) */}
      <section className="dialogue-panel vn-dialogue-window" onClick={(e) => { e.stopPropagation(); if (!atEnd) advance(); }}>
        <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleFileChange} />
        
        {loadingInit ? (
          <div className="vn-dialogue-loading"><Sparkles className="pulse" /> Carregando crônicas...</div>
        ) : thinking ? (
          <div className="vn-dialogue-loading">
            <div className="vn-thinking-badge"><Sparkles size={14} className="pulse"/> O NARRADOR ESTÁ RESPONDENDO...</div>
            <div className="dots"><i>.</i><i>.</i><i>.</i></div>
          </div>
        ) : error ? (
          <div className="vn-dialogue-error">
            <div className="vn-error-title">⚠️ AVISO</div>
            <p>{error}</p>
            <div className="novel-retry">
              {retry.current && <button className="outline-button light" onClick={() => retry.current?.()}>Tentar de novo</button>}
              {current && <button className="ghost-button light" onClick={() => setError('')}>Continuar</button>}
              <button className="ghost-button light" onClick={onBack}>Voltar</button>
            </div>
          </div>
        ) : current ? (
          <div className="vn-dialogue-content">
            {/* Nameplate com Brasão no topo esquerdo da moldura (exatamente como em "Alisa" - Imagem 2) */}
            <div className="vn-nameplate-alisa-wrap">
              <div className="vn-alisa-seal">
                {speakerImg ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={speakerImg} alt="" />
                ) : (
                  <span>❖</span>
                )}
              </div>
              <div className="vn-alisa-ribbon">
                <span className="vn-alisa-name">{label}</span>
                {current.expression && current.expression !== 'neutral' && (
                  <span className="vn-alisa-mood">({current.expression})</span>
                )}
              </div>
            </div>

            {/* Conteúdo da Mensagem ou Caixa de Edição */}
            {editingMsg === current.id ? (
              <div className="edit-message-box vn-edit-message-box" onClick={(e) => e.stopPropagation()}>
                <textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="dialogue-edit-input vn-dialogue-edit-input" />
                <button className="icon-button light" onClick={saveEdit}><Check size={18} /></button>
                <button className="icon-button light" onClick={() => setEditingMsg(null)}><X size={18} /></button>
              </div>
            ) : (
              <div className="vn-dialogue-body">
                <p className={`dialogue-text vn-dialogue-text ${current.message_type === 'narration' ? 'is-narration' : ''}`}>
                  {current.content}
                </p>
                {!atEnd && <span className="vn-alisa-pointer">▶</span>}
              </div>
            )}
          </div>
        ) : null}
      </section>

      {/* PAINEL SEPARADO E AVULSO DE AÇÃO DO JOGADOR NO FIM DA TELA */}
      {!loadingInit && !thinking && !error && current && atEnd && (
        <section className="vn-player-action-console" onClick={(e) => e.stopPropagation()}>
          <div className="vn-action-console-inner">
            <span className="vn-action-console-badge">SUA RESPOSTA</span>
            <div className="vn-action-input-cluster">
              {actionImage && (
                <div className="vn-decision-img-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={actionImage} alt="" />
                  <button type="button" onClick={() => setActionImage(null)}>✕</button>
                </div>
              )}
              <input
                type="file"
                ref={actionImageRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={(e) => {
                  const f = (e.target as any)?.files?.[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = (re) => setActionImage(re.target?.result as string);
                  reader.readAsDataURL(f);
                }}
              />
              <button
                type="button"
                className={`vn-decision-attach ${actionImage ? 'active' : ''}`}
                onClick={() => actionImageRef.current?.click()}
                title="Anexar Imagem para a Personagem Ver"
              >
                <ImagePlus size={15} />
                <span>{actionImage ? 'Foto Carregada' : 'Foto'}</span>
              </button>
              <button
                type="button"
                className={`vn-decision-rpg-btn ${showShortcuts ? 'active' : ''}`}
                onClick={() => setShowShortcuts(!showShortcuts)}
                title="Ações RPG, D20 e Tags Clicáveis"
              >
                <Swords size={15} />
                <span>Ações RPG</span>
              </button>
              <input
                className="vn-decision-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={2000}
                placeholder={`Como ${player?.name || 'você'} reage ou responde agora...?`}
                aria-label="Resposta do jogador"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) send() }}
              />
              <button
                type="button"
                className="vn-decision-submit"
                onClick={send}
                disabled={!input.trim() && !actionImage}
                title="Confirmar sua ação"
              >
                <span>AGIR</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* MODAL / GRIMÓRIO DE AÇÕES RPG & TAGS CLICÁVEIS */}
      {showShortcuts && (
        <div className="vn-rpg-modal-backdrop" onClick={() => setShowShortcuts(false)}>
          <div className="vn-rpg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="vn-rpg-modal-header">
              <div className="vn-rpg-modal-title">
                <Swords size={18} color="#e5b869" />
                <strong>GRIMÓRIO DE AÇÕES & TAGS RPG</strong>
              </div>
              <button className="icon-button light" onClick={() => setShowShortcuts(false)} aria-label="Fechar"><X size={18} /></button>
            </div>
            
            <p className="vn-rpg-modal-subtitle">
              Clique em qualquer ação ou tag abaixo para inseri-la instantaneamente na sua resposta:
            </p>

            <div className="vn-rpg-modal-body">
              {/* MODOS NARRATIVOS */}
              <div className="vn-rpg-group">
                <span className="vn-rpg-group-title">🎭 MODOS NARRATIVOS</span>
                <div className="vn-rpg-chips">
                  <button type="button" className="vn-rpg-chip" onClick={() => handleInsertTag('[Roleplay Imersivo]')}>🎭 Imersivo</button>
                  <button type="button" className="vn-rpg-chip" onClick={() => handleInsertTag('[Batalha / Combate]')}>⚔️ Combate</button>
                  <button type="button" className="vn-rpg-chip" onClick={() => handleInsertTag('[Romance]')}>❤️ Romance</button>
                  <button type="button" className="vn-rpg-chip" onClick={() => handleInsertTag('[Modo Íntimo +18]')}>🌶️ Íntimo +18</button>
                  <button type="button" className="vn-rpg-chip" onClick={() => handleInsertTag('[Investigação e Mistério]')}>🔍 Investigação</button>
                  <button type="button" className="vn-rpg-chip" onClick={() => handleInsertTag('[Comédia / Descontração]')}>😄 Cômico</button>
                </div>
              </div>

              {/* D20 E AÇÕES DE CENA */}
              <div className="vn-rpg-group">
                <span className="vn-rpg-group-title">🎲 TESTES DE SORTE & MUDANÇA DE CENA</span>
                <div className="vn-rpg-chips">
                  <button type="button" className="vn-rpg-chip dice" onClick={() => {
                    const r = Math.floor(Math.random() * 20) + 1;
                    handleInsertTag(`[D20: ${r}]`);
                  }}>🎲 Rolar D20</button>
                  <button type="button" className="vn-rpg-chip scene" onClick={() => handleInsertTag('[ENCERRAR CENA]')}>🔚 Encerrar Cena</button>
                  <button type="button" className="vn-rpg-chip scene" onClick={() => {
                    if (characters.length > 0) {
                      const randomNpc = characters[Math.floor(Math.random() * characters.length)];
                      handleInsertTag(`[Trazer ${randomNpc.name}]`);
                    } else {
                      handleInsertTag('[Aparece um desconhecido]');
                    }
                  }}>🎲 NPC Aleatório</button>
                  <button type="button" className="vn-rpg-chip" onClick={() => handleInsertTag('[Quebra da 4ª Parede]')}>⚡ 4ª Parede</button>
                </div>
              </div>

              {/* TAGS CUSTOMIZADAS CRIADAS */}
              <div className="vn-rpg-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span className="vn-rpg-group-title">🏷️ TAGS DA CRÔNICA ({tags.length})</span>
                  <button
                    type="button"
                    className="outline-button light"
                    style={{ fontSize: '10px', padding: '3px 8px' }}
                    onClick={() => { setShowShortcuts(false); openPanel('tags'); }}
                  >
                    + Criar Nova Tag
                  </button>
                </div>
                {tags.length === 0 ? (
                  <p className="vn-rpg-empty">Nenhuma tag criada ainda. Clique em &quot;+ Criar Nova Tag&quot; para criar atalhos personalizados!</p>
                ) : (
                  <div className="vn-rpg-chips">
                    {tags.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="vn-rpg-chip custom-tag"
                        onClick={() => handleInsertTag(`[${t.name}]`)}
                        title={t.prompt}
                      >
                        🏷️ <strong>{t.name}</strong>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* CHAMAR PERSONAGENS DO ELENCO */}
              {characters.length > 0 && (
                <div className="vn-rpg-group">
                  <span className="vn-rpg-group-title">👤 CHAMAR PERSONAGEM DO ELENCO</span>
                  <div className="vn-rpg-chips">
                    {characters.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="vn-rpg-chip char-chip"
                        onClick={() => handleInsertTag(`[Chamar ${c.name}]`)}
                      >
                        {c.image_url ? (
                          <img src={c.image_url} alt="" className="vn-chip-avatar" />
                        ) : (
                          <span>👤</span>
                        )}
                        <span>{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <button
                    className="outline-button light"
                    style={{ flex: 1, minWidth: '150px' }}
                    onClick={() => {
                      const i = document.createElement('input')
                      i.type = 'file'
                      i.accept = '.json'
                      i.onchange = async (e) => {
                        const f = (e.target as any)?.files?.[0]
                        if (!f) return
                        try {
                          const t = await f.text()
                          const d = JSON.parse(t)
                          const list = Array.isArray(d) ? d : [d]
                          const { supabase } = await import('@/lib/supabase/client')
                          const created: Character[] = []
                          for (const item of list) {
                            const { data: nc } = await supabase.from('characters').insert({
                              story_id: storyId,
                              name: item.name || 'Personagem Importado',
                              nickname: item.nickname,
                              age: item.age,
                              appearance: item.appearance,
                              personality: item.personality,
                              history: item.history,
                              goals: item.goals,
                              fears: item.fears,
                              secrets: item.secrets,
                              speech_style: item.speech_style,
                              relationship_to_protagonist: item.relationship_to_protagonist,
                              extra_information: item.extra_information,
                              image_url: item.image_url,
                              expressions: item.expressions || {}
                            }).select().single()
                            if (nc) created.push(nc)
                          }
                          if (created.length > 0) {
                            setCharacters((prev) => [...prev, ...created])
                            notify(`${created.length} personagem(ns) importado(s) com sucesso para esta aventura!`)
                          }
                        } catch {
                          notify('Erro ao processar arquivo JSON.', 'error')
                        }
                      }
                      i.click()
                    }}
                    title="Importar um personagem ou elenco completo via JSON"
                  >
                    <Upload size={14} /> Importar Elenco (JSON)
                  </button>
                  <button
                    className="outline-button light"
                    style={{ flex: 1, minWidth: '150px' }}
                    onClick={() => {
                      if (characters.length === 0) {
                        notify('Nenhum personagem no elenco para exportar.', 'error')
                        return
                      }
                      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(characters, null, 2))
                      const el = document.createElement('a')
                      el.setAttribute('href', dataStr)
                      el.setAttribute('download', `elenco_${story?.title ? story.title.replace(/\s+/g, '_').toLowerCase() : 'aventura'}.json`)
                      document.body.appendChild(el)
                      el.click()
                      el.remove()
                      notify(`Elenco completo (${characters.length} personagens) exportado com sucesso!`)
                    }}
                    title="Exportar todos os personagens com suas fotos e regras para um arquivo JSON"
                  >
                    <Download size={14} /> Exportar Elenco ({characters.length})
                  </button>
                </div>
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
                  <div className="field"><span>Passado / História</span><textarea value={editingChar.history} onChange={(e) => setEditingChar({ ...editingChar, history: e.target.value })} rows={3} /></div>
                  <div style={{ border: '1.5px solid #e5b869', borderRadius: '8px', padding: '12px', background: 'rgba(229, 184, 105, 0.08)', margin: '10px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e5b869', fontWeight: 'bold', fontSize: '11px', marginBottom: '4px' }}>
                      <Sparkles size={13} /> ⭐ O QUE PENSA ATUALMENTE SOBRE VOCÊ (REGRA DE OURO DA IA)
                    </div>
                    <p style={{ fontSize: '10px', color: '#aaa', margin: '0 0 6px 0', lineHeight: 1.4 }}>
                      Regra de ouro inegociável: O Gemini seguirá à risca este campo para ditar o comportamento e as intenções reais deste personagem.
                    </p>
                    <textarea value={editingChar.relationship_to_protagonist} onChange={(e) => setEditingChar({ ...editingChar, relationship_to_protagonist: e.target.value })} rows={3} placeholder="O que este personagem pensa secretamente sobre você agora..." style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(229,184,105,0.3)', borderRadius: '4px', color: '#fff', padding: '8px', fontSize: '12px' }} />
                  </div><div className="field"><span>Estilo de Fala</span><textarea value={editingChar.speech_style} onChange={(e) => setEditingChar({ ...editingChar, speech_style: e.target.value })} rows={2} /></div><div className="field"><span>Objetivos e Medos</span><textarea value={editingChar.goals} onChange={(e) => setEditingChar({ ...editingChar, goals: e.target.value })} rows={2} /></div>{editingChar.relationship && typeof editingChar.relationship.relationship_value === "number" && (<div className="field"><span>Pontos de Relacionamento (0 a 100)</span><input type="number" min={0} max={100} value={editingChar.relationship.relationship_value} onChange={(e) => setEditingChar({ ...editingChar, relationship: { ...editingChar.relationship!, relationship_value: Number(e.target.value) } })} style={{ padding: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid #444", color: "#fff" }} /></div>)}
                  
                  <div className="expressions-grid">
                    <span>Expressões Visuais</span>
                    <div className="expr-slots">
                      {['neutral', 'happy', 'angry', 'ashamed', 'intimate', 'foto_casual', 'foto_sensual', 'foto_pe', 'foto_18'].map((expr) => {
                        const img = (editingChar as any).expressions?.[expr] || (expr === 'neutral' ? editingChar.image_url : null)
                        return (
                          <div key={expr} className="expr-slot" onClick={() => { setUploadTarget(`expr:${editingChar.id}:${expr}`); fileInputRef.current?.click() }}>
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
            </div>
          </aside>
        </div>
      )}

      {/* SMARTPHONE IMERSIVO: WHATSAPP */}
      {panel === 'whatsapp' && (
        <div className="phone-screen-modal" onClick={() => { setPanel(null); setWppContact(null); }}>
          <div className="phone-device-wrap wpp-phone-frame" onClick={(e) => e.stopPropagation()}>
            {/* Status bar */}
            <div className="phone-status-bar wpp-bar">
              <span>12:45</span>
              <div className="phone-notch" />
              <div className="phone-status-icons">📶 100% 🔋</div>
            </div>

            {!wppContact ? (
              /* LISTA DE CONVERSAS DO WHATSAPP */
              <div className="wpp-app-view">
                <div className="wpp-header-main">
                  <div className="wpp-header-title">
                    <strong>WhatsApp</strong>
                    <button className="icon-button light" onClick={() => setPanel(null)}><X size={18}/></button>
                  </div>
                  <div className="wpp-header-tabs">
                    <span className="wpp-tab active">CONVERSAS ({characters.length})</span>
                    <span className="wpp-tab">STATUS</span>
                    <span className="wpp-tab">CHAMADAS</span>
                  </div>
                </div>

                <div className="wpp-chats-list">
                  {characters.length === 0 && (
                    <p className="wpp-empty-hint">Nenhum contato encontrado no celular.</p>
                  )}
                  {characters.map((c) => {
                    const lastNpcMsg = messages.filter(m => m.character_id === c.id || (m.sender_type === 'player' && m.content.includes(c.name))).slice(-1)[0]
                    const intimacy = c.relationship?.relationship_value ?? 0
                    return (
                      <div key={c.id} className="wpp-chat-item" onClick={() => setWppContact(c)}>
                        <div className="wpp-avatar-wrap">
                          {c.image_url ? <img src={c.image_url} alt="" /> : <UserRound size={22}/>}
                          <span className="wpp-online-badge" />
                        </div>
                        <div className="wpp-chat-details">
                          <div className="wpp-chat-top">
                            <strong>{c.name}</strong>
                            <small>12:44</small>
                          </div>
                          <div className="wpp-chat-preview">
                            <span className="wpp-check">✓✓</span>
                            <p>{lastNpcMsg ? lastNpcMsg.content.slice(0, 38) + (lastNpcMsg.content.length > 38 ? '...' : '') : (c.nickname || 'Olá! Estou online.')}</p>
                          </div>
                        </div>
                        <div className="wpp-intimacy-chip" title="Intimidade">
                          {intimacy >= 50 ? '❤️' : intimacy >= 20 ? '💬' : '👋'} {intimacy}/100
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              /* TELA DE CHAT ATIVA DO WHATSAPP */
              <div className="wpp-chat-view">
                <div className="wpp-chat-header">
                  <button className="wpp-back-btn" onClick={() => setWppContact(null)}><ArrowLeft size={18}/></button>
                  <div className="wpp-header-avatar">
                    {wppContact.image_url ? <img src={wppContact.image_url} alt="" /> : <UserRound size={18}/>}
                  </div>
                  <div className="wpp-header-info">
                    <strong>{wppContact.name}</strong>
                    <span>online</span>
                  </div>
                  <div className="wpp-header-actions">
                    <button className="icon-button light" onClick={() => notify('Iniciando chamada de vídeo...') as any}><Video size={16}/></button>
                    <button className="icon-button light" onClick={() => notify('Iniciando chamada de áudio...') as any}><Phone size={16}/></button>
                    <button className="icon-button light" onClick={() => { setPanel(null); setWppContact(null); }}><X size={18}/></button>
                  </div>
                </div>

                <div className="wpp-messages-canvas">
                  <div className="wpp-encryption-notice">
                    🔒 As mensagens e chamadas são protegidas com a criptografia de ponta a ponta.
                  </div>

                  {messages
                    .filter((m) => m.character_id === wppContact.id || (m.sender_type === 'player' && (m.content.includes(wppContact.name) || m.content.includes('[MENSAGEM DE WHATSAPP'))))
                    .slice(-15)
                    .map((m, idx) => {
                      const isMe = m.sender_type === 'player'
                      const isPhoto = m.expression && m.expression.startsWith('foto_')
                      const photoUrl = isPhoto ? ((wppContact as any).expressions?.[m.expression!] || wppContact.image_url) : null

                      return (
                        <div key={m.id || idx} className={`wpp-bubble-wrap ${isMe ? 'is-me' : 'is-them'}`}>
                          <div className={`wpp-bubble ${isMe ? 'me' : 'them'}`}>
                            {photoUrl && (
                              <div className="wpp-photo-message">
                                <img src={photoUrl} alt="Foto enviada" />
                                <span className="wpp-photo-badge">📷 Foto recebida</span>
                              </div>
                            )}
                            <p className="wpp-bubble-text">{m.content.replace(/\[MENSAGEM DE WHATSAPP PARA .*?\]:\s*"?/, '').replace(/"?\.\s*RESPONDA NO MODO WHATSAPP:.*$/, '')}</p>
                            <div className="wpp-bubble-meta">
                              <span>12:45</span>
                              {isMe && <span className="wpp-double-check">✓✓</span>}
                            </div>
                          </div>
                        </div>
                      )
                    })}

                  {thinking && (
                    <div className="wpp-bubble-wrap is-them">
                      <div className="wpp-bubble them wpp-typing">
                        <span>{wppContact.name} está digitando</span>
                        <div className="dots"><i>.</i><i>.</i><i>.</i></div>
                      </div>
                    </div>
                  )}
                  <div ref={wppEndRef} />
                </div>

                {/* BARRA DE INPUT DO WHATSAPP */}
                <div className="wpp-input-bar">
                  <button type="button" className="wpp-icon-btn"><Smile size={20}/></button>
                  <input
                    className="wpp-text-input"
                    value={wppInput}
                    onChange={(e) => setWppInput(e.target.value)}
                    placeholder="Mensagem"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                        if (!wppInput.trim() || busy.current) return
                        const msg = wppInput.trim()
                        setWppInput('')
                        run('turn', `[MENSAGEM DE WHATSAPP PARA ${wppContact.name}]: "${msg}". RESPONDA NO MODO WHATSAPP: responda como mensagens de celular (WhatsApp) de ${wppContact.name}. Se o clima for propício ou o jogador pedir fotos, use expressões foto_casual, foto_sensual, foto_pe ou foto_18.`)
                      }
                    }}
                  />
                  <button type="button" className="wpp-icon-btn" onClick={() => { setUploadTarget(`expr:${wppContact.id}:foto_casual`); fileInputRef.current?.click(); }} title="Enviar foto"><Camera size={20}/></button>
                  <button
                    type="button"
                    className="wpp-send-btn"
                    disabled={!wppInput.trim() || busy.current}
                    onClick={() => {
                      if (!wppInput.trim() || busy.current) return
                      const msg = wppInput.trim()
                      setWppInput('')
                      run('turn', `[MENSAGEM DE WHATSAPP PARA ${wppContact.name}]: "${msg}". RESPONDA NO MODO WHATSAPP: responda como mensagens de celular (WhatsApp) de ${wppContact.name}. Se o clima for propício ou o jogador pedir fotos, use expressões foto_casual, foto_sensual, foto_pe ou foto_18.`)
                    }}
                  >
                    <Send size={16}/>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SMARTPHONE IMERSIVO: TINDER */}
      {panel === 'tinder' && (() => {
        const tinderList = characters.filter(c => !c.relationship || c.relationship.relationship_value < 20);
        const activeList = tinderList.length > 0 ? tinderList : characters;
        const currentTinder = activeList[tinderIndex % Math.max(1, activeList.length)];

        return (
          <div className="phone-screen-modal" onClick={() => { setPanel(null); setTinderChatContact(null); setTinderMatched(null); }}>
            <div className="phone-device-wrap tinder-phone-frame" onClick={(e) => e.stopPropagation()}>
              <div className="phone-status-bar tinder-bar">
                <span>12:45</span>
                <div className="phone-notch" />
                <div className="phone-status-icons">📶 100% 🔋</div>
              </div>

              {tinderChatContact ? (
                /* CHAT DO TINDER APÓS MATCH */
                <div className="tinder-chat-view">
                  <div className="tinder-chat-header">
                    <button className="tinder-back-btn" onClick={() => setTinderChatContact(null)}><ArrowLeft size={18}/></button>
                    <div className="tinder-chat-avatar">
                      {tinderChatContact.image_url ? <img src={tinderChatContact.image_url} alt="" /> : <UserRound size={18}/>}
                    </div>
                    <strong>{tinderChatContact.name}</strong>
                    <button className="icon-button light" style={{ marginLeft: 'auto' }} onClick={() => { setPanel(null); setTinderChatContact(null); }}><X size={18}/></button>
                  </div>
                  <div className="tinder-messages-canvas">
                    <div className="tinder-match-banner">
                      <Flame size={20} color="#ff4458"/>
                      <span>VOCÊS DERAM MATCH! Digite um oi para quebrar o gelo.</span>
                    </div>
                    {messages
                      .filter((m) => m.character_id === tinderChatContact.id || (m.sender_type === 'player' && m.content.includes(tinderChatContact.name)))
                      .slice(-10)
                      .map((m, idx) => {
                        const isMe = m.sender_type === 'player'
                        return (
                          <div key={idx} className={`tinder-bubble-wrap ${isMe ? 'is-me' : 'is-them'}`}>
                            <div className={`tinder-bubble ${isMe ? 'me' : 'them'}`}>
                              <p>{m.content.replace(/\[MENSAGEM NO TINDER PARA .*?\]:\s*"?/, '').replace(/"?\.\s*RESPONDA NO MODO TINDER CHAT:.*$/, '')}</p>
                            </div>
                          </div>
                        )
                      })}
                    {thinking && (
                      <div className="tinder-bubble-wrap is-them">
                        <div className="tinder-bubble them tinder-typing">
                          <small>{tinderChatContact.name} está digitando...</small>
                        </div>
                      </div>
                    )}
                    <div ref={tinderEndRef} />
                  </div>
                  <div className="tinder-input-bar">
                    <input
                      className="tinder-text-input"
                      value={tinderInput}
                      onChange={(e) => setTinderInput(e.target.value)}
                      placeholder="Diga algo interessante..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                          if (!tinderInput.trim() || busy.current) return
                          const msg = tinderInput.trim()
                          setTinderInput('')
                          run('turn', `[MENSAGEM NO TINDER PARA ${tinderChatContact.name}]: "${msg}". RESPONDA NO MODO TINDER CHAT: seja provocativa, casual, flerte como em um app de namoro.`)
                        }
                      }}
                    />
                    <button
                      className="tinder-send-btn"
                      disabled={!tinderInput.trim() || busy.current}
                      onClick={() => {
                        if (!tinderInput.trim() || busy.current) return
                        const msg = tinderInput.trim()
                        setTinderInput('')
                        run('turn', `[MENSAGEM NO TINDER PARA ${tinderChatContact.name}]: "${msg}". RESPONDA NO MODO TINDER CHAT: seja provocativa, casual, flerte como em um app de namoro.`)
                      }}
                    >
                      <Send size={16}/>
                    </button>
                  </div>
                </div>
              ) : tinderMatched ? (
                /* TELA POPUP DE MATCH */
                <div className="tinder-match-celebration">
                  <div className="match-title">IT'S A MATCH!</div>
                  <p>Você e {tinderMatched.name} curtiram um ao outro!</p>
                  <div className="match-avatars-row">
                    <div className="match-avatar-circle">
                      {player?.image_url ? <img src={player.image_url} alt="" /> : <UserRound size={32}/>}
                    </div>
                    <div className="match-heart-pulse">❤️</div>
                    <div className="match-avatar-circle">
                      {tinderMatched.image_url ? <img src={tinderMatched.image_url} alt="" /> : <UserRound size={32}/>}
                    </div>
                  </div>
                  <button className="tinder-match-action-btn" onClick={() => { setTinderChatContact(tinderMatched); setTinderMatched(null); }}>
                    MANDAR MENSAGEM AGORA
                  </button>
                  <button className="tinder-match-ghost-btn" onClick={() => { setTinderMatched(null); setTinderIndex(i => i + 1); }}>
                    CONTINUAR DESLIZANDO
                  </button>
                </div>
              ) : (
                /* TELA DE SWIPE CARDS DO TINDER */
                <div className="tinder-swipe-view">
                  <div className="tinder-header">
                    <div className="tinder-logo-badge">
                      <Flame size={22} color="#ff4458" />
                      <strong>tinder</strong>
                    </div>
                    <button className="icon-button light" onClick={() => setPanel(null)}><X size={18}/></button>
                  </div>

                  {!currentTinder ? (
                    <div className="tinder-empty-state">
                      <Flame size={40} color="#ff4458" />
                      <h3>Sem pessoas novas por perto</h3>
                      <p>Crie novos personagens no elenco para encontrar novas pessoas para paquerar!</p>
                    </div>
                  ) : (
                    <div className="tinder-card-deck">
                      <div className="tinder-card-visual">
                        {currentTinder.image_url ? (
                          <img src={currentTinder.image_url} alt="" className="tinder-card-img" />
                        ) : (
                          <div className="tinder-no-img"><UserRound size={60}/></div>
                        )}
                        <div className="tinder-card-overlay">
                          <div className="tinder-card-name-row">
                            <h3>{currentTinder.name}</h3>
                            <span>{currentTinder.age || '22'}</span>
                          </div>
                          <p className="tinder-card-role">{currentTinder.nickname || 'Procurando alguém legal'}</p>
                          <p className="tinder-card-bio">{currentTinder.personality ? currentTinder.personality.slice(0, 110) + '...' : 'Vamos conversar e ver no que dá!'}</p>
                        </div>
                      </div>

                      <div className="tinder-actions-bar">
                        <button className="tinder-action-btn rewind" onClick={() => setTinderIndex(Math.max(0, tinderIndex - 1))} title="Voltar">↺</button>
                        <button className="tinder-action-btn nope" onClick={() => setTinderIndex(tinderIndex + 1)} title="Passar"><X size={26}/></button>
                        <button className="tinder-action-btn star" onClick={() => setTinderMatched(currentTinder)} title="Super Like">★</button>
                        <button className="tinder-action-btn like" onClick={() => setTinderMatched(currentTinder)} title="Like"><Heart size={26}/></button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })()}
    </main>
  )
}
