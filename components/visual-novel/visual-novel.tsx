'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, ChevronRight, Save, Settings, Sparkles, Trash2, UserRound, UsersRound, X, Pencil, ImagePlus, Check, RotateCcw, Tag, Map as MapIcon, Smartphone, Heart, MessageCircle, Download, Upload, Phone, Video, Send, Flame, CheckCheck, Swords, Camera, Smile, Plus, Volume2, VolumeX } from 'lucide-react'
import type { Character, PlayerCharacter, Scenario, Story, StoryMemory, StoryMessage, StoryState } from '@/lib/types'
import * as svc from '@/lib/story/service'
import { sendPlayerAction, startStory } from '@/lib/gemini/client'
import { spokenText } from '@/lib/gemini/voices'
import { playSpeech, stopSpeech } from '@/lib/gemini/speech'
import { VoiceField } from '@/components/ui/form'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/ui/toast'
import { NAMORO_MOVES, NARRATIVE_MODES, REALITY_PHASE_LABEL, addHaremAction, advanceRealityPhase, advanceVerdade, arriveNamoro, collectSignals, focusHarem, focusNamoro, haremFlow, isPhoneMessage, isolatedChatAction, lastAffection, lastDupla, lastProposals, lastTrio, leaveNamoro, namoroFlow, parseNarrativeMode, phoneThread, realityCastWithout, realityFlow, resetHaremChapter, setNamoroTrio, settleHaremTurn, startVerdadeRound, stripStageDirections, verdadeFlow, withChosenCast, withCompanionUpdate, withHaremRoster, withNarrativeMode, withPlayerPhotos, withRealityCast, withRealityOut, withVerdadeRoll, withWebSince, type NarrativeMode } from '@/lib/story/narrative-mode'

type Panel = null | 'history' | 'cast' | 'memory' | 'tags' | 'map' | 'tinder' | 'whatsapp' | 'theme'
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
  const [phoneImage, setPhoneImage] = useState<string | null>(null)
  const phoneImageRef = useRef<HTMLInputElement>(null)
  const [showMobileLeft, setShowMobileLeft] = useState(false)
  const [showMobileRight, setShowMobileRight] = useState(false)
  const [dailyLimit, setDailyLimit] = useState<{ isWhitelisted: boolean; used: number; max: number; remaining: number }>({
    isWhitelisted: true,
    used: 0,
    max: 20,
    remaining: 20,
  })
  const [hasMore, setHasMore] = useState(false)
  const [editingMsg, setEditingMsg] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadTarget, setUploadTarget] = useState<'scenario' | 'character' | string>(null as any)
  const [editingChar, setEditingChar] = useState<Character | null>(null)
  const [editingPlayer, setEditingPlayer] = useState(false)
  const [rulesText, setRulesText] = useState('')
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const [speakBusy, setSpeakBusy] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(false)
  const [narrativeMode, setNarrativeMode] = useState<NarrativeMode>('visual')
  const [pickedIds, setPickedIds] = useState<string[]>([])
  const [reactions, setReactions] = useState<{ id: string; name: string; delta: number }[]>([])
  const narrativeModeRef = useRef<NarrativeMode>('visual')
  narrativeModeRef.current = narrativeMode
  const [themeDraft, setThemeDraft] = useState('')
  const [savingTheme, setSavingTheme] = useState(false)
  const masterRules = useRef('')
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

  const visible = useMemo(
    () => messages.filter((m) => {
      if (HIDDEN.includes(m.message_type) || isPhoneMessage(m.metadata) || m.sender_type === 'player') return false
      if ((narrativeMode === 'verdade' || narrativeMode === 'web') && (m.message_type === 'narration' || m.sender_type === 'narrator')) return false
      return stripStageDirections(m.content).length > 0
    }),
    [messages, narrativeMode],
  )
  const current = visible[Math.min(cursor, visible.length - 1)]
  const atEnd = visible.length === 0 || cursor >= visible.length - 1
  const npcById = useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters])
  const scenario = scenarios.find((s) => s.id === state?.current_scenario_id) ?? scenarios.find((s) => s.is_starting_scenario) ?? scenarios[0]
  const speaker = current?.sender_type === 'npc' && current.character_id ? npcById.get(current.character_id) : current?.sender_type === 'player' ? player : undefined
  const currentExpr = current?.expression || 'neutral'
  let carriedFoto = ''
  const currentSeq = current?.sequence_number ?? Number.POSITIVE_INFINITY
  for (const m of messages) {
    if (m.sequence_number > currentSeq) break
    const hit = m.content.match(/\[\[FOTO_JOGADOR:\s*([a-z0-9_]+)\s*\]\]/i)?.[1]
    if (hit) carriedFoto = hit
    if (m.sender_type === 'player' && m.expression) carriedFoto = m.expression
  }
  const playerFoto = current?.sender_type === 'narrator'
    ? (current.content.match(/\[\[FOTO_JOGADOR:\s*([a-z0-9_]+)\s*\]\]/i)?.[1] || '')
    : current?.sender_type === 'player'
      ? (current.expression || carriedFoto)
      : ''
  const portrait = (current?.sender_type === 'player' || playerFoto) && player ? player : speaker
  const portraitExpr = playerFoto || currentExpr
  const speakerImg = portrait ? ((portrait as { expressions?: Record<string, string> }).expressions?.[portraitExpr] || portrait.image_url) : null
  const speakerVoice = current?.sender_type === 'npc' && speaker && 'voice' in speaker ? (speaker.voice || '') : ''

  const hearLine = useCallback(async (msg: StoryMessage, voice: string) => {
    const text = spokenText(msg.content)
    if (!text) { notify('Essa fala não tem texto para ouvir.', 'error'); return }
    setSpeakingId(msg.id)
    setSpeakBusy(true)
    try {
      const result = await playSpeech({
        text,
        voice,
        cacheKey: `${msg.id}:${voice}`,
        onEnded: () => setSpeakingId((id) => (id === msg.id ? null : id)),
      })
      if (result === 'cancelled') setSpeakingId((id) => (id === msg.id ? null : id))
    } catch (e) {
      setSpeakingId((id) => (id === msg.id ? null : id))
      notify(friendlyError(e, 'Não foi possível ouvir esta fala. Publique a função speak-line.'), 'error')
    } finally { setSpeakBusy(false) }
  }, [notify])

  function toggleSpeak() {
    if (!current || current.sender_type !== 'npc') return
    if (!speakerVoice) {
      notify('Escolha a voz deste personagem no elenco.', 'error')
      setPanel('cast')
      const npc = current.character_id ? npcById.get(current.character_id) : undefined
      if (npc) setEditingChar(npc)
      return
    }
    if (speakingId === current.id) {
      stopSpeech()
      setSpeakingId(null)
      setSpeakBusy(false)
      return
    }
    void hearLine(current, speakerVoice)
  }

  useEffect(() => {
    const saved = localStorage.getItem('vn-auto-speak')
    if (saved === '1') setAutoSpeak(true)
  }, [])

  useEffect(() => {
    return () => {
      stopSpeech()
      setSpeakingId(null)
    }
  }, [current?.id])

  const hearRef = useRef(hearLine)
  hearRef.current = hearLine

  useEffect(() => {
    if (loadingInit || !autoSpeak || !current || current.sender_type !== 'npc' || !speakerVoice) return
    void hearRef.current(current, speakerVoice)
  }, [loadingInit, autoSpeak, current, speakerVoice])

  useEffect(() => () => { stopSpeech() }, [])

  useEffect(() => {
    if (!reactions.length) return
    const timer = window.setTimeout(() => setReactions([]), 4200)
    return () => window.clearTimeout(timer)
  }, [reactions])

  const playerNameRef = useRef('')
  playerNameRef.current = player?.name || ''
  const charactersRef = useRef(characters)
  charactersRef.current = characters

  const applyResponse = useCallback((newMsgs: StoryMessage[], newState: StoryState, fromChannel = false) => {
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id))
      return [...prev, ...newMsgs.filter((m) => !seen.has(m.id))]
    })
    setState(newState)
    const signals = collectSignals(newMsgs)
    if (signals.approvals.length) {
      setReactions(signals.approvals.map((a) => ({ ...a, id: `${a.name}-${a.delta}-${Date.now()}-${Math.random()}` })))
    }
    if (fromChannel) {
      const cut = newMsgs.find((m) => /\[\[DESMATCH\]\]/.test(m.content))
      const id = String(cut?.metadata?.character_id || cut?.character_id || '')
      if (id) {
        svc.setRelationship(storyId, id, 0).then(() => {
          setCharacters((prev) => prev.map((c) => c.id === id ? { ...c, relationship: { ...(c.relationship || {}), relationship_value: 0 } } : c))
        }).catch(() => {})
      }
      return
    }
    const mode = narrativeModeRef.current
    let rules = masterRules.current
    let changed = false
    if (mode === 'companion' && (signals.approvals.length || signals.stays || signals.leaves.length)) {
      rules = withCompanionUpdate(rules, signals.approvals, signals.stays, signals.leaves)
      changed = true
    }
    if (mode === 'harem' && haremFlow(rules).fase !== 'final') {
      const next = settleHaremTurn(rules, lastDupla(newMsgs))
      if (next !== rules) { rules = next; changed = true }
    }
    if (mode === 'reality' && signals.eliminated.length) {
      rules = realityCastWithout(withRealityOut(rules, signals.eliminated), signals.eliminated)
      changed = true
    }
    if (mode === 'verdade') {
      const flow = verdadeFlow(rules)
      if (flow.fase === 'ouvir' || flow.fase === 'escrever' || flow.fase === 'responder') {
        const next = advanceVerdade(rules, playerNameRef.current || 'protagonista', false)
        if (next !== rules) { rules = next; changed = true }
      }
    }
    if (mode === 'namoro') {
      const flow = namoroFlow(rules)
      const trio = lastTrio(newMsgs)
      if (flow.fase === 'trio' && trio.length) {
        rules = setNamoroTrio(rules, trio)
        changed = true
      }
      for (const hit of lastAffection(newMsgs)) {
        const person = charactersRef.current.find((c) => c.name.toLowerCase() === hit.name.toLowerCase())
        if (!person) continue
        const cur = Number(person.relationship?.relationship_value ?? 0)
        svc.setRelationship(storyId, person.id, cur + hit.delta).then((value) => {
          setCharacters((prev) => prev.map((c) => c.id === person.id ? { ...c, relationship: { ...(c.relationship || {}), relationship_value: value } } : c))
        }).catch(() => {})
      }
    }
    if (mode === 'companion') {
      const readable = newMsgs.some((m) => m.sender_type !== 'player' && stripStageDirections(m.content).length > 0)
      const hadNarration = newMsgs.some((m) => m.sender_type !== 'player')
      if (hadNarration && !readable) setError('A cena veio sem texto. Escreva de novo para a equipe reagir.')
    }
    if (changed) {
      masterRules.current = rules
      setRulesText(rules)
      svc.saveNarrativeMode(storyId, rules).catch(() => {})
    }
  }, [storyId])

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

  const run = useCallback(async (kind: 'start' | 'turn', action = '', img?: string, channel?: { channel: 'tinder' | 'whatsapp'; characterId: string }) => {
    if (busy.current) return
    if (kind === 'turn' && !dailyLimit.isWhitelisted && dailyLimit.remaining <= 0) {
      notify('Limite diário de 20 mensagens atingido para sua conta. Tente novamente amanhã!', 'error')
      return
    }
    busy.current = true
    const prevVisible = visibleCountRef.current
    retry.current = () => { run(kind, action, img, channel) }
    setThinking(true); setError('')
    try {
      let res: { messages: StoryMessage[]; state: StoryState }
      try {
        res = kind === 'start' ? await startStory(storyId) : await sendPlayerAction(storyId, action, img, channel)
      } catch (e) {
        const recovered = await recover(kind, action)
        if (!recovered) throw e
        res = recovered
      }
      applyResponse(res.messages, res.state, !!channel)
      if (!channel) setCursor(prevVisible) // primeiro bloco novo da campanha
      if (kind === 'turn') {
        setInput('');
        setActionImage(null);
        if (!dailyLimit.isWhitelisted) {
          setDailyLimit((prev) => ({ ...prev, used: prev.used + 1, remaining: Math.max(0, prev.remaining - 1) }))
        }
      }
    } catch (e) {
      setError(friendlyError(e, 'O narrador não conseguiu responder. Tente novamente.'))
    } finally { busy.current = false; setThinking(false) }
  }, [storyId, applyResponse, recover, dailyLimit, notify])

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

  const runRef = useRef(run)
  runRef.current = run

  // ---------- carga inicial / continuar ----------
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [b, st, msgs, limit] = await Promise.all([
          svc.loadBundle(storyId),
          svc.loadState(storyId),
          svc.loadRecentMessages(storyId, 40),
          svc.getDailyUsage().catch(() => ({ isWhitelisted: true, used: 0, max: 20, remaining: 20 }))
        ])
        if (!alive) return
        setStory(b.story); setScenarios(b.scenarios); setCharacters(b.characters); setPlayer(b.player); setState(st); setTags(b.tags || [])
        masterRules.current = b.master?.additional_rules || ''
        setRulesText(masterRules.current)
        const savedMode = parseNarrativeMode(masterRules.current)
        setNarrativeMode(savedMode.mode)
        setThemeDraft(savedMode.theme)
        if (!masterRules.current.includes('[[MODO_NARRATIVO]]')) {
          const next = withNarrativeMode(masterRules.current, 'visual')
          masterRules.current = next
          setRulesText(next)
          svc.saveNarrativeMode(storyId, next).catch(() => {})
        } else {
          const next = withNarrativeMode(masterRules.current, savedMode.mode, savedMode.theme)
          if (next !== masterRules.current) {
            masterRules.current = next
            setRulesText(next)
            svc.saveNarrativeMode(storyId, next).catch(() => {})
          }
        }
        setMessages(msgs); setHasMore(msgs.length >= 40)
        setDailyLimit(limit)
        const vis = msgs.filter((m) => !HIDDEN.includes(m.message_type))
        setCursor(Math.max(0, vis.length - 1))
        setLoadingInit(false)
        if (msgs.length === 0 && !startedRef.current) {
          startedRef.current = true
          runRef.current('start')
        }
      } catch (e) {
        if (alive) { setError(friendlyError(e, 'Não foi possível abrir a história.')); setLoadingInit(false) }
      }
    })()
    return () => { alive = false }
  }, [storyId])

  async function send() {
    const hasText = input.trim().length > 0
    const hasImg = Boolean(actionImage)
    if ((!hasText && !hasImg) || busy.current || thinking || !atEnd) return
    if (!dailyLimit.isWhitelisted && dailyLimit.remaining <= 0) {
      notify('Limite diário de 20 mensagens atingido!', 'error')
      return
    }
    let action = hasText ? input.trim() : '[O jogador mostra uma foto/imagem e aguarda sua reação]'
    if (narrativeMode === 'namoro') {
      const flow = namoroFlow(masterRules.current)
      if (flow.fase === 'onde') {
        const next = arriveNamoro(masterRules.current, action)
        masterRules.current = next
        setRulesText(next)
        try { await svc.saveNarrativeMode(storyId, next) } catch { /* o lugar segue na ação */ }
        action = `Eu vou para: ${action}. Carregue esse lugar em Hogwarts. Traga exatamente 3 mulheres da ficha, nunca mais que 3. Escreva [[TRIO:Nome|Nome|Nome]]. Antes de cada uma aparecer, use a ficha inteira.`
      } else if (flow.fase === 'fala' && flow.foco) {
        action = `Eu estou só com ${flow.foco}, em ${flow.lugar || 'Hogwarts'}: ${action}`
      }
    }
    if (narrativeMode === 'harem') {
      const flow = haremFlow(masterRules.current)
      if (flow.fase !== 'solo' || !flow.foco) return
      const next = addHaremAction(masterRules.current, flow.foco)
      masterRules.current = next
      setRulesText(next)
      try { await svc.saveNarrativeMode(storyId, next) } catch { /* a cena segue na ação */ }
      action = `Eu interajo só com ${flow.foco}, e com mais ninguém: ${action}`
    }
    if (narrativeMode === 'verdade') {
      const flow = verdadeFlow(masterRules.current)
      if (flow.fase !== 'escrever' && flow.fase !== 'responder' && flow.fase !== 'cumprir') return
      action = flow.fase === 'cumprir'
        ? `Ainda não terminou. Continue a mesma verdade ou o mesmo desafio até o fim: ${action}`
        : flow.passo === 0
          ? `D6 caiu em ${flow.alvo}. Minha pergunta, e ela é obrigada a dizer a verdade até o fim: ${action}`
          : flow.passo === 2
            ? `D6 caiu em ${flow.alvo}. Meu desafio, e ela é obrigada a cumprir até o fim: ${action}`
            : `Minha resposta, até concluir: ${action}`
    }
    const imgToSend = actionImage || undefined
    run('turn', action, imgToSend)
  }

  function sendPhone(channel: 'tinder' | 'whatsapp', contact: Character, text: string, image?: string | null) {
    if (busy.current) return
    const unmatched = messages.some((m) => /\[\[DESMATCH\]\]/.test(m.content) && String(m.metadata?.character_id || m.character_id || '') === contact.id)
    if (unmatched) { notify(channel === 'tinder' ? 'Ela desfez o match.' : 'Esta conversa foi encerrada.', 'error'); return }
    if (!text.trim() && !image) return
    if (!dailyLimit.isWhitelisted && dailyLimit.remaining <= 0) {
      notify('Limite diário de 20 mensagens atingido!', 'error')
      return
    }
    if (channel === 'tinder') setTinderInput('')
    else setWppInput('')
    setPhoneImage(null)
    run('turn', isolatedChatAction(channel, text.trim() || 'Olha a foto que eu mandei.', contact.relationship?.relationship_value ?? 0), image || undefined, { channel, characterId: contact.id })
  }

  const advance = useCallback(() => {
    if (thinking || loadingInit) return
    setCursor((c) => (c < visible.length - 1 ? c + 1 : c))
  }, [thinking, loadingInit, visible.length])

  const rewind = useCallback(() => {
    if (thinking || loadingInit) return
    setCursor((c) => (c > 0 ? c - 1 : c))
  }, [thinking, loadingInit])

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
    } else if (uploadTarget === 'player' || uploadTarget.startsWith('player_expr:')) {
      id = player?.id || storyId
    } else {
      id = uploadTarget === 'scenario' ? scenario?.id : speaker?.id
    }
    if (!id) return
    try {
      const ext = file.name.split('.').pop()
      const path = `${story?.user_id}/${storyId}/${id}-${Date.now()}.${ext}`
      const isPlayer = uploadTarget === 'player' || uploadTarget.startsWith('player_expr:') || (!isExpr && uploadTarget !== 'scenario' && current?.sender_type === 'player'); const bucket = uploadTarget === 'scenario' ? 'scenario-assets' : isPlayer ? 'player-assets' : 'character-assets'
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
      } else if ((uploadTarget === 'player' || uploadTarget.startsWith('player_expr:')) && player) {
        const expr = uploadTarget.startsWith('player_expr:') ? uploadTarget.slice('player_expr:'.length) : ''
        const expressions = expr ? { ...(player.expressions || {}), [expr]: pub.publicUrl } : player.expressions
        const up = {
          ...player,
          expressions,
          image_url: !expr || expr === 'neutral' ? pub.publicUrl : player.image_url,
          image_path: !expr || expr === 'neutral' ? path : player.image_path,
        }
        await svc.savePlayer(up)
        setPlayer(up)
        const photoRules = withPlayerPhotos(masterRules.current, Object.keys(up.expressions || {}))
        masterRules.current = photoRules
        setRulesText(photoRules)
        svc.saveNarrativeMode(storyId, photoRules).catch(() => {})
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
      if (panel || (e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault()
        advance()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setCursor((c) => Math.max(0, c - 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panel, advance])

  const title = story?.title || 'Minha história'
  const label = playerFoto
    ? (player?.name || 'VOCÊ')
    : current?.sender_type === 'npc'
      ? (speaker?.name ?? 'NPC')
      : current?.sender_type === 'player'
        ? (player?.name || 'VOCÊ')
        : (state?.current_location || scenario?.name || 'Cena')
  const shownText = current ? stripStageDirections(current.content) : ''
  const hFlow = haremFlow(rulesText)
  const rFlow = realityFlow(rulesText)
  const vFlow = verdadeFlow(rulesText)
  const nFlow = namoroFlow(rulesText)
  const haremLocksInput = narrativeMode === 'harem' && hFlow.fase !== 'solo'
  const namoroLocksInput = narrativeMode === 'namoro' && nFlow.fase === 'trio'
  const verdadeCanType = narrativeMode !== 'verdade' || vFlow.fase === 'escrever' || vFlow.fase === 'responder' || vFlow.fase === 'cumprir'
  const haremOffers = lastProposals(messages).flatMap((p) => {
    const name = hFlow.dupla?.find((n) => n.toLowerCase() === p.name.toLowerCase())
    if (!name || (hFlow.acoes[name] || 0) >= 5) return []
    return [{ name, text: p.text }]
  })
  const modelChoices = narrativeMode !== 'web' && narrativeMode !== 'verdade' && narrativeMode !== 'harem' && narrativeMode !== 'namoro'
    && Array.isArray((state?.state_data as any)?.pending_choices)
    ? ((state?.state_data as any).pending_choices as string[])
    : []

  async function playChoice(choice: string) {
    if (narrativeMode === 'harem') {
      const flow = haremFlow(masterRules.current)
      const dupla = flow.dupla || lastDupla(messages)
      const ignore = choice.match(/Ignorar (.+?) para sempre/i)?.[1]?.trim()
      const stay = choice.match(/seguir com (.+?) no jogo/i)?.[1]?.trim()
      if (flow.fase === 'final' && dupla && ignore && stay) {
        const next = resetHaremChapter(withHaremRoster(masterRules.current, [stay], [ignore]))
        masterRules.current = next
        setRulesText(next)
        try { await svc.saveNarrativeMode(storyId, next) } catch { /* a próxima cena ainda recebe a escolha */ }
      }
    }
    run('turn', choice)
  }

  async function rollVerdade() {
    if (thinking) return
    const flow = verdadeFlow(masterRules.current)
    if (flow.elenco.length < 1 || flow.fase !== 'rolar') return
    const faces = Math.min(6, flow.elenco.length)
    const dado = Math.floor(Math.random() * faces) + 1
    const alvo = flow.elenco[dado - 1]
    const fase = flow.passo === 0 || flow.passo === 2 ? 'escrever' as const : 'ouvir' as const
    const next = withVerdadeRoll(masterRules.current, dado, alvo, fase)
    masterRules.current = next
    setRulesText(next)
    try { await svc.saveNarrativeMode(storyId, next) } catch { /* o dado segue na ação */ }
    if (fase === 'ouvir') {
      const kind = flow.passo === 1 ? 'uma pergunta de verdade' : 'um desafio'
      run('turn', `O narrador rolou um D6 e tirou ${dado}. Caiu em ${alvo}. ${alvo} faz ${kind} para o protagonista.`)
    }
  }

  async function presentHarem() {
    if (thinking) return
    const flow = haremFlow(masterRules.current)
    const action = flow.dupla
      ? `Nova cena. ${flow.dupla[0]} e ${flow.dupla[1]} fazem cada uma UMA proposta concreta para mim, ousada e no jeito da ficha. Escreva [[PROPOSTA:Nome|a proposta]] para cada uma. Eu ainda não escolhi o caminho.`
      : 'Apresente exatamente duas mulheres da ficha que ainda não foram eliminadas. Cada uma faz uma proposta para mim. Escreva [[PROPOSTA:Nome|a proposta]] e [[DUPLA:Nome A|Nome B]].'
    run('turn', action)
  }

  async function followProposal(name: string, text: string) {
    if (thinking) return
    const next = addHaremAction(focusHarem(masterRules.current, name), name)
    masterRules.current = next
    setRulesText(next)
    try { await svc.saveNarrativeMode(storyId, next) } catch { /* a proposta segue na ação */ }
    run('turn', `Eu escolho o caminho de ${name}: ${text}. Só ela. A outra não entra nesta cena.`)
  }

  async function confirmVerdade(done: boolean) {
    if (thinking) return
    if (!done) {
      run('turn', 'Ainda não terminou. Continue só com a mesma pessoa e a mesma verdade ou o mesmo desafio. Não troque de personagem, não narre e não repita.')
      return
    }
    const next = advanceVerdade(masterRules.current, playerNameRef.current || 'protagonista', true)
    masterRules.current = next
    setRulesText(next)
    try { await svc.saveNarrativeMode(storyId, next) } catch { /* o dado seguinte usa o texto salvo */ }
  }

  async function namoroTalk(name: string) {
    if (thinking) return
    const next = focusNamoro(masterRules.current, name)
    masterRules.current = next
    setRulesText(next)
    try { await svc.saveNarrativeMode(storyId, next) } catch { /* a conversa segue na ação */ }
    run('turn', `Eu escolho falar só com ${name} em ${namoroFlow(next).lugar || 'Hogwarts'}. Antes da fala, carregue a ficha inteira dela. Só ela.`)
  }

  async function namoroMove(label: string) {
    if (thinking) return
    const flow = namoroFlow(masterRules.current)
    if (!flow.foco) return
    const person = characters.find((c) => c.name.toLowerCase() === flow.foco.toLowerCase())
    const pts = Number(person?.relationship?.relationship_value ?? 0)
    run('turn', `Eu estou só com ${flow.foco}. Pontos de relacionamento: ${pts}/100. Minha tentativa: ${label}. Julgue com a ficha inteira. Se for cedo ou contra a ficha, recuse. Escreva [[AFETO:${flow.foco}:+N]].`)
  }

  async function namoroBack() {
    if (thinking) return
    const next = leaveNamoro(masterRules.current)
    masterRules.current = next
    setRulesText(next)
    try { await svc.saveNarrativeMode(storyId, next) } catch { /* o lugar volta a ser perguntado */ }
  }

  async function wipePhone() {
    if (thinking) return
    try {
      await svc.deletePhoneChats(storyId)
      setMessages((prev) => prev.filter((m) => !isPhoneMessage(m.metadata)))
      notify('Memória do Tinder e do WhatsApp apagada.', 'ok')
    } catch (e) {
      notify(friendlyError(e, 'Não foi possível apagar os chats.'), 'error')
    }
  }

  async function resetPoints() {
    if (thinking) return
    try {
      await svc.resetAllRelationships(storyId, characters.map((c) => c.id))
      setCharacters((prev) => prev.map((c) => ({ ...c, relationship: { ...(c.relationship || {}), relationship_value: 10 } })))
      notify('Pontos de todas voltaram para 10.', 'ok')
    } catch (e) {
      notify(friendlyError(e, 'Não foi possível resetar os pontos.'), 'error')
    }
  }

  async function nextRealityPart() {
    if (thinking) return
    const next = advanceRealityPhase(masterRules.current)
    masterRules.current = next
    setRulesText(next)
    try { await svc.saveNarrativeMode(storyId, next) } catch { /* a parte nova segue na ação */ }
    const fase = REALITY_PHASE_LABEL[realityFlow(next).fase]
    run('turn', `A parte anterior terminou. Comece agora a parte: ${fase}.`)
  }

  function publicVote() {
    const roll = Math.floor(Math.random() * 20) + 1
    run('turn', `[D20: ${roll}]\n[O jogador rolou um D20 e tirou: ${roll}. Este é o voto do público.]`)
  }

  async function applyTheme(mode: NarrativeMode, theme = themeDraft, names?: string[]) {
    if (mode === 'tema' && !theme.trim()) {
      notify('Escreva o filme, jogo ou campanha que a história deve seguir.', 'error')
      return
    }
    if (mode === 'verdade' && (names?.length ?? 0) !== 6) {
      notify('Escolha 6 personagens para o verdade ou desafio.', 'error')
      return
    }
    if (mode === 'web' && (names?.length ?? 0) !== 1) {
      notify('Escolha uma personagem para a web namorada.', 'error')
      return
    }
    setSavingTheme(true)
    try {
      let next = (mode === 'verdade' || mode === 'web')
        ? withChosenCast(masterRules.current, mode, names || [])
        : withNarrativeMode(masterRules.current, mode, theme)
      if (mode === 'verdade') next = startVerdadeRound(next, names || [], player?.name || 'protagonista')
      if (mode === 'web') {
        const seq = messages.length ? messages[messages.length - 1].sequence_number : 0
        next = withWebSince(next, seq)
      }
      if (mode === 'reality') {
        const pool = characters.map((c) => c.name).filter(Boolean)
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          const tmp = pool[i]
          pool[i] = pool[j]
          pool[j] = tmp
        }
        next = withRealityCast(next, pool.slice(0, 7))
      }
      if (mode === 'harem') next = resetHaremChapter(next)
      await svc.saveNarrativeMode(storyId, next)
      masterRules.current = next
      setRulesText(next)
      setNarrativeMode(mode)
      setThemeDraft(theme)
      notify('Tema salvo. A próxima resposta já segue esse modo.', 'ok')
      setPanel(null)
    } catch (e) {
      notify(friendlyError(e, 'Não foi possível salvar o tema.'), 'error')
    } finally { setSavingTheme(false) }
  }

  function togglePick(id: string) {
    setPickedIds((prev) => {
      if (narrativeMode === 'web') return prev[0] === id ? [] : [id]
      if (prev.includes(id)) return prev.filter((item) => item !== id)
      if (prev.length >= 6) return prev
      return [...prev, id]
    })
  }

  return (
    <main
      className="novel-mode"
      onClick={() => {
        if (!atEnd && !thinking && !loadingInit) advance()
      }}
    >
      {reactions.length > 0 && (
        <div className="vn-approval-stack" onClick={(e) => e.stopPropagation()}>
          {reactions.map((r) => (
            <div key={r.id} className={`vn-approval ${r.delta > 0 ? 'up' : 'down'}`}>
              <strong>{r.name}</strong>
              <span>{r.delta > 0 ? 'aprovou' : 'desaprovou'} {r.delta > 0 ? `+${r.delta}` : r.delta}</span>
            </div>
          ))}
        </div>
      )}
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
          <button className="vn-side-btn" onClick={() => { openPanel('theme'); setShowMobileRight(false); }} title="Mudar o tema da narrativa"><Settings size={15}/> <span>TEMA</span></button>
          <button className="vn-side-btn" onClick={() => { openPanel('map'); setShowMobileRight(false); }} title="Mapa Mundi"><MapIcon size={15}/> <span>MAPA</span></button>
          <button className="vn-side-btn vn-side-accent" onClick={() => { openPanel('tinder'); setShowMobileRight(false); }} title="App de Encontros"><Smartphone size={15}/> <span>TINDER</span></button>
          <button className="vn-side-btn vn-side-whatsapp" onClick={() => { openPanel('whatsapp'); setShowMobileRight(false); }} title="Chat Celular"><MessageCircle size={15}/> <span>WHATSAPP</span></button>
          {onEdit && <button className="vn-side-btn vn-side-editor" onClick={() => { onEdit(); setShowMobileRight(false); }} title="Editor do Criador"><Pencil size={15}/> <span>EDITOR</span></button>}
          <button
            className="vn-side-btn"
            onClick={async () => {
              try {
                notify('Exportando campanha completa...')
                await svc.exportFullCampaign(storyId)
                notify('Campanha baixada com sucesso!')
                setShowMobileRight(false)
              } catch(e: any) {
                notify('Erro ao exportar: ' + (e.message || String(e)), 'error')
              }
            }}
            title="Exportar Campanha Completa com todos personagens e regras (JSON)"
          >
            <Download size={15}/> <span>EXPORTAR</span>
          </button>
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
          {!dailyLimit.isWhitelisted && (
            <>
              <span className="dot">•</span>
              <span
                style={{
                  color: dailyLimit.remaining <= 5 ? '#ff4d4f' : '#e5b869',
                  fontWeight: 'bold',
                  letterSpacing: '0.5px'
                }}
                title={`Limite diário: ${dailyLimit.used}/${dailyLimit.max} usadas. Restam ${dailyLimit.remaining} mensagens nas últimas 24h.`}
              >
                ⚡ {dailyLimit.remaining}/{dailyLimit.max} MSG
              </span>
            </>
          )}
          <button
            type="button"
            className={`vn-autospeak ${autoSpeak ? 'on' : ''}`}
            title={autoSpeak ? 'Voz automática ligada' : 'Ouvir as falas dos personagens automaticamente'}
            onClick={(e) => {
              e.stopPropagation()
              setAutoSpeak((v) => {
                const next = !v
                localStorage.setItem('vn-auto-speak', next ? '1' : '0')
                if (!next) { stopSpeech(); setSpeakingId(null); setSpeakBusy(false) }
                return next
              })
            }}
          >
            <Volume2 size={12} /> {autoSpeak ? 'VOZ ON' : 'VOZ'}
          </button>
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
      </section>

      {/* ÁREA INFERIOR DE INTERAÇÃO (DIÁLOGO ACIMA DAS OPÇÕES, OPÇÕES ACIMA DA RESPOSTA) */}
      <div className="vn-bottom-interaction-stack">
        {/* 1. CAIXA DE DIÁLOGO PURA DA PERSONAGEM (Abaixo da foto do personagem e acima das opções) */}
        <section className="dialogue-panel vn-dialogue-window" onClick={(e) => { e.stopPropagation(); if (!atEnd) advance(); }}>
          <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleFileChange} />
          <input type="file" ref={phoneImageRef} style={{ display: 'none' }} accept="image/*" onChange={(e) => {
            const f = e.target.files?.[0]
            if (!f) return
            const reader = new FileReader()
            reader.onload = (re) => setPhoneImage(re.target?.result as string)
            reader.readAsDataURL(f)
          }} />
          
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
                  {current.sender_type === 'npc' && (
                    <button
                      type="button"
                      className={`vn-speak-btn ${speakingId === current.id ? 'is-on' : ''}`}
                      title={speakerVoice ? `Ouvir com a voz ${speakerVoice}` : 'Escolher voz no elenco'}
                      onClick={(e) => { e.stopPropagation(); toggleSpeak() }}
                    >
                      {speakBusy && speakingId === current.id ? <span className="vn-speak-spin" /> : speakingId === current.id ? <VolumeX size={13} /> : <Volume2 size={13} />}
                    </button>
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
                    {shownText}
                  </p>
                  {cursor > 0 && (
                    <button type="button" className="vn-rewind" onClick={(e) => { e.stopPropagation(); rewind() }}>← Anterior</button>
                  )}
                  {!atEnd && <span className="vn-alisa-pointer">▶</span>}
                </div>
              )}
            </div>
          ) : null}
        </section>

        {/* 2. BALÕES / BOTÕES DE ESCOLHAS (Abaixo do diálogo e acima da caixa de resposta) */}
        {!loadingInit && !thinking && !error && atEnd && (narrativeMode === 'verdade' || narrativeMode === 'harem' || narrativeMode === 'reality' || narrativeMode === 'companion' || narrativeMode === 'web' || narrativeMode === 'namoro') && (
          <div className="vn-mode-banner" onClick={(e) => e.stopPropagation()}>
            {narrativeMode === 'verdade' && (vFlow.elenco.length < 6
              ? 'Abra o tema e confirme os 6 personagens.'
              : vFlow.fase === 'cumprir'
                ? `Só ${vFlow.alvo} nesta jogada. Já terminou a ${vFlow.passo >= 2 ? 'desafio' : 'verdade'}?`
                : vFlow.fase === 'escrever' && vFlow.passo === 0
                ? `D6 caiu em ${vFlow.alvo}. Escreva a pergunta. Ela responde com a verdade da ficha.`
                : vFlow.fase === 'responder' && vFlow.passo === 1
                  ? `${vFlow.alvo} te perguntou. Responda em texto.`
                  : vFlow.fase === 'escrever' && vFlow.passo === 2
                    ? `D6 caiu em ${vFlow.alvo}. Escreva o desafio. Ela é obrigada a cumprir.`
                    : vFlow.fase === 'responder' && vFlow.passo === 3
                      ? `${vFlow.alvo} te desafiou. Escreva como você enfrenta.`
                      : vFlow.passo === 0
                        ? 'Sua vez. Role o D6 para ver a quem você pergunta.'
                        : vFlow.passo === 1
                          ? 'Vez do dado escolher quem te pergunta.'
                          : vFlow.passo === 2
                            ? 'Sua vez. Role o D6 para ver quem cumpre o seu desafio.'
                            : 'Vez do dado escolher quem te desafia.')}
            {narrativeMode === 'harem' && (hFlow.fase === 'final' && hFlow.dupla
              ? `${hFlow.dupla[0]} e ${hFlow.dupla[1]} já tiveram 5 ações cada. Decida quem segue.`
              : hFlow.fase === 'solo'
                ? `Só com ${hFlow.foco}. ${hFlow.dupla?.map((n) => `${n} ${hFlow.acoes[n] || 0}/5`).join(' · ') || ''}`
                : hFlow.dupla
                  ? `Cada uma fez uma proposta. Escolha o caminho. ${hFlow.dupla.map((n) => `${n} ${hFlow.acoes[n] || 0}/5`).join(' · ')}`
                  : 'Duas mulheres vão fazer uma proposta. Você escolhe qual caminho seguir.')}
            {narrativeMode === 'reality' && `Parte: ${REALITY_PHASE_LABEL[rFlow.fase]}. Elenco: ${rFlow.elenco.join(', ') || 'abra o tema para sortear 7'}.`}
            {narrativeMode === 'companion' && 'Cada frase sua faz a equipe aprovar ou desaprovar.'}
            {narrativeMode === 'web' && 'Conversa do zero, sem narrador. Escreva o que você diz.'}
            {narrativeMode === 'namoro' && (nFlow.fase === 'fala'
              ? `Só com ${nFlow.foco} em ${nFlow.lugar || 'Hogwarts'}. Pontos: ${characters.find((c) => c.name.toLowerCase() === nFlow.foco.toLowerCase())?.relationship?.relationship_value ?? 0}/100.`
              : nFlow.fase === 'trio'
                ? `${nFlow.lugar || 'O lugar'}: escolha uma das três.`
                : 'Para onde você vai? Escreva o lugar.')}
          </div>
        )}
        {!loadingInit && !thinking && !error && atEnd && narrativeMode === 'verdade' && vFlow.fase === 'cumprir' && (
          <div className="vn-choices-balloon-row" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="vn-choice-bubble" onClick={() => void confirmVerdade(true)}>
              <span className="vn-bubble-pointer" />
              <span className="vn-bubble-text">Sim, já terminou</span>
            </button>
            <button type="button" className="vn-choice-bubble" onClick={() => void confirmVerdade(false)}>
              <span className="vn-bubble-pointer" />
              <span className="vn-bubble-text">Não, continua</span>
            </button>
          </div>
        )}
        {!loadingInit && !thinking && !error && atEnd && narrativeMode === 'namoro' && nFlow.fase === 'trio' && (
          <div className="vn-choices-balloon-row" onClick={(e) => e.stopPropagation()}>
            {nFlow.trio.slice(0, 3).map((name) => (
              <button key={name} type="button" className="vn-choice-bubble" onClick={() => void namoroTalk(name)}>
                <span className="vn-bubble-pointer" />
                <span className="vn-bubble-text">Falar com {name}</span>
              </button>
            ))}
            <button type="button" className="vn-choice-bubble" onClick={() => void namoroBack()}>
              <span className="vn-bubble-pointer" />
              <span className="vn-bubble-text">Ir para outro lugar</span>
            </button>
          </div>
        )}
        {!loadingInit && !thinking && !error && atEnd && narrativeMode === 'namoro' && nFlow.fase === 'fala' && (
          <div className="vn-choices-balloon-row" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="vn-choice-bubble" onClick={() => void namoroBack()}>
              <span className="vn-bubble-pointer" />
              <span className="vn-bubble-text">Ver quem está no lugar</span>
            </button>
            {NAMORO_MOVES.map((move) => {
              const pts = Number(characters.find((c) => c.name.toLowerCase() === nFlow.foco.toLowerCase())?.relationship?.relationship_value ?? 0)
              const locked = pts < move.min
              return (
                <button key={move.id} type="button" className={`vn-choice-bubble${locked ? ' is-locked' : ''}`} disabled={locked} title={locked ? `Precisa de ${move.min} pontos` : move.label} onClick={() => void namoroMove(move.label)}>
                  <span className="vn-bubble-pointer" />
                  <span className="vn-bubble-text">{locked ? `${move.label} (${move.min})` : move.label}</span>
                </button>
              )
            })}
          </div>
        )}
        {!loadingInit && !thinking && !error && atEnd && narrativeMode === 'verdade' && vFlow.fase === 'rolar' && vFlow.elenco.length >= 6 && (
          <div className="vn-choices-balloon-row" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="vn-choice-bubble" onClick={() => void rollVerdade()}>
              <span className="vn-bubble-pointer" />
              <span className="vn-bubble-text">{vFlow.passo === 0 || vFlow.passo === 2 ? 'Rolar o D6' : 'Narrador rola o D6'}</span>
            </button>
          </div>
        )}
        {!loadingInit && !thinking && !error && atEnd && narrativeMode === 'harem' && hFlow.fase === 'apresenta' && !hFlow.dupla && (
          <div className="vn-choices-balloon-row" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="vn-choice-bubble" onClick={() => void presentHarem()}>
              <span className="vn-bubble-pointer" />
              <span className="vn-bubble-text">Ver as duas</span>
            </button>
          </div>
        )}
        {!loadingInit && !thinking && !error && atEnd && narrativeMode === 'harem' && hFlow.fase === 'apresenta' && hFlow.dupla && haremOffers.length > 0 && (
          <div className="vn-choices-balloon-row" onClick={(e) => e.stopPropagation()}>
            {haremOffers.map((offer) => (
              <button key={offer.name} type="button" className="vn-choice-bubble" onClick={() => void followProposal(offer.name, offer.text)}>
                <span className="vn-bubble-pointer" />
                <span className="vn-bubble-text">{offer.name}: {offer.text}</span>
              </button>
            ))}
          </div>
        )}
        {!loadingInit && !thinking && !error && atEnd && narrativeMode === 'harem' && hFlow.fase === 'apresenta' && hFlow.dupla && haremOffers.length === 0 && (
          <div className="vn-choices-balloon-row" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="vn-choice-bubble" onClick={() => void presentHarem()}>
              <span className="vn-bubble-pointer" />
              <span className="vn-bubble-text">Ouvir as propostas</span>
            </button>
          </div>
        )}
        {!loadingInit && !thinking && !error && atEnd && narrativeMode === 'harem' && hFlow.fase === 'final' && hFlow.dupla && (
          <div className="vn-choices-balloon-row" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="vn-choice-bubble" onClick={() => void playChoice(`Ignorar ${hFlow.dupla?.[1]} para sempre e seguir com ${hFlow.dupla?.[0]} no jogo`)}>
              <span className="vn-bubble-pointer" />
              <span className="vn-bubble-text">Ignorar {hFlow.dupla[1]} para sempre e seguir com {hFlow.dupla[0]}</span>
            </button>
            <button type="button" className="vn-choice-bubble" onClick={() => void playChoice(`Ignorar ${hFlow.dupla?.[0]} para sempre e seguir com ${hFlow.dupla?.[1]} no jogo`)}>
              <span className="vn-bubble-pointer" />
              <span className="vn-bubble-text">Ignorar {hFlow.dupla[0]} para sempre e seguir com {hFlow.dupla[1]}</span>
            </button>
          </div>
        )}
        {!loadingInit && !thinking && !error && atEnd && modelChoices.length > 0 && (
          <div className="vn-choices-balloon-row" onClick={(e) => e.stopPropagation()}>
            {modelChoices.map((choice: string, idx: number) => (
              <button
                key={idx}
                className="vn-choice-bubble"
                onClick={() => void playChoice(choice)}
              >
                <span className="vn-bubble-pointer" />
                <span className="vn-bubble-text">{choice}</span>
              </button>
            ))}
          </div>
        )}
        {!loadingInit && !thinking && !error && atEnd && narrativeMode === 'reality' && rFlow.fase !== 'voto' && (
          <div className="vn-choices-balloon-row" onClick={(e) => e.stopPropagation()}>
            <button className="vn-choice-bubble" onClick={() => void nextRealityPart()}>
              <span className="vn-bubble-pointer" />
              <span className="vn-bubble-text">Terminar esta parte</span>
            </button>
          </div>
        )}
        {!loadingInit && !thinking && !error && atEnd && narrativeMode === 'reality' && rFlow.fase === 'voto' && (
          <div className="vn-choices-balloon-row" onClick={(e) => e.stopPropagation()}>
            <button className="vn-choice-bubble vn-vote-bubble" onClick={publicVote}>
              <span className="vn-bubble-pointer" />
              <span className="vn-bubble-text">Voto do público</span>
            </button>
          </div>
        )}

        {/* 3. PAINEL SEPARADO E AVULSO DE AÇÃO DO JOGADOR NO FIM DA TELA */}
        {!loadingInit && !thinking && !error && current && atEnd && !haremLocksInput && !namoroLocksInput && verdadeCanType && (
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
                disabled={!dailyLimit.isWhitelisted && dailyLimit.remaining <= 0}
                placeholder={!dailyLimit.isWhitelisted && dailyLimit.remaining <= 0 ? '⚠️ Limite diário de 20 mensagens atingido. Retorne amanhã!' : narrativeMode === 'namoro' && nFlow.fase === 'onde' ? 'Para onde você vai?' : narrativeMode === 'harem' && hFlow.foco ? `O que você faz só com ${hFlow.foco}?` : narrativeMode === 'verdade' && vFlow.passo === 0 ? 'Escreva a pergunta' : narrativeMode === 'verdade' && vFlow.passo === 2 ? 'Escreva o desafio' : `Como ${player?.name || 'você'} reage ou responde agora...?`}
                aria-label="Resposta do jogador"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) send() }}
              />
              <button
                type="button"
                className="vn-decision-submit"
                onClick={send}
                disabled={(!dailyLimit.isWhitelisted && dailyLimit.remaining <= 0) || (!input.trim() && !actionImage)}
                title={!dailyLimit.isWhitelisted && dailyLimit.remaining <= 0 ? 'Limite diário atingido' : 'Confirmar sua ação'}
              >
                <span>AGIR</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </section>
      )}
      </div>

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
            <div className="drawer-head"><strong>{panel === 'history' ? 'Histórico' : panel === 'cast' ? 'Elenco' : panel === 'tags' ? 'Tags Customizadas' : panel === 'theme' ? 'Tema da narrativa' : panel === 'map' ? 'Viagem Rápida' : panel === 'tinder' ? 'App de Namoro' : 'Memória do narrador'}</strong><button className="icon-button light" onClick={() => setPanel(null)} aria-label="Fechar"><X /></button></div>
            <div className="drawer-body">
              {panel === 'theme' && <>
                <p className="drawer-note">O tema vale na próxima resposta. A ficha de cada personagem continua sendo a regra de ouro.</p>
                {NARRATIVE_MODES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="outline-button light"
                    style={{ textAlign: 'left', borderColor: narrativeMode === item.id ? '#e5b869' : undefined }}
                    disabled={savingTheme}
                    onClick={() => {
                      if (item.id === 'tema' || item.id === 'verdade' || item.id === 'web') {
                        setNarrativeMode(item.id)
                        if (item.id !== 'tema') setPickedIds([])
                      } else void applyTheme(item.id)
                    }}
                  >
                    <strong>{item.label}</strong>
                    <span style={{ display: 'block', marginTop: 4, fontSize: 11, opacity: 0.8 }}>{item.hint}</span>
                  </button>
                ))}
                {narrativeMode === 'tema' && (
                  <div className="field">
                    <span>Filme, jogo ou campanha</span>
                    <textarea value={themeDraft} rows={4} placeholder="Ex.: Final Fantasy VII, ou a campanha Curse of Strahd" onChange={(e) => setThemeDraft(e.target.value)} />
                    <button className="primary-button" disabled={savingTheme} onClick={() => void applyTheme('tema', themeDraft)}>
                      {savingTheme ? 'Salvando…' : 'Usar este tema'}
                    </button>
                  </div>
                )}
                {(narrativeMode === 'verdade' || narrativeMode === 'web') && (
                  <div className="field">
                    <span>{narrativeMode === 'verdade' ? `Escolha 6 personagens (${pickedIds.length}/6)` : 'Escolha a personagem da web namorada'}</span>
                    {characters.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="outline-button light"
                        style={{ textAlign: 'left', borderColor: pickedIds.includes(c.id) ? '#e5b869' : undefined }}
                        onClick={() => togglePick(c.id)}
                      >
                        {c.name || 'Sem nome'}
                      </button>
                    ))}
                    <button
                      className="primary-button"
                      disabled={savingTheme || (narrativeMode === 'verdade' ? pickedIds.length !== 6 : pickedIds.length !== 1)}
                      onClick={() => {
                        const names = characters.filter((c) => pickedIds.includes(c.id)).map((c) => c.name).filter(Boolean)
                        void applyTheme(narrativeMode, '', names)
                      }}
                    >
                      {savingTheme ? 'Salvando…' : narrativeMode === 'verdade' ? 'Jogar com estes 6' : 'Ficar só com ela'}
                    </button>
                  </div>
                )}
              </>}
              {panel === 'history' && <>
                {hasMore && <button className="outline-button light drawer-more" onClick={olderMessages}>Carregar mensagens anteriores</button>}
                {messages.filter((m) => !isPhoneMessage(m.metadata)).map((m, i) => {
                  const idx = visible.findIndex((v) => v.id === m.id)
                  const who = m.sender_type === 'player' ? player?.name || 'Você' : m.sender_type === 'npc' ? npcById.get(m.character_id ?? '')?.name ?? 'NPC' : m.sender_type === 'system' ? 'CENA' : 'Cena'
                  return <button key={m.id} className={`hist-item hist-${m.sender_type}`} disabled={idx < 0} onClick={() => { if (idx >= 0) { setCursor(idx); setPanel(null) } }} data-i={i}><span>{who}</span><p>{stripStageDirections(m.content)}</p></button>
                })}
                {messages.length === 0 && <p className="drawer-empty">Nada aqui ainda.</p>}
                <p className="drawer-note">O histórico é somente leitura para não quebrar a continuidade da história.</p>
              </>}
              {panel === 'cast' && !editingChar && !editingPlayer && <>
                <button
                  className="primary-button vn-gold-button"
                  style={{ width: '100%', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 14px' }}
                  onClick={async () => {
                    try {
                      notify('Criando novo personagem no elenco...')
                      const newChar = await svc.createCharacter(storyId)
                      setCharacters((prev) => [...prev, newChar])
                      setEditingChar(newChar)
                      notify('Novo personagem criado! Edite os detalhes dele abaixo.', 'ok')
                    } catch (err: any) {
                      notify(friendlyError(err, 'Erro ao criar personagem.'), 'error')
                    }
                  }}
                >
                  <Plus size={16} /> + Criar Novo Personagem
                </button>
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
                              ...(item.voice ? { voice: item.voice } : {}),
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
                  <button type="button" className="outline-button light" style={{ flex: 1, minWidth: '150px' }} onClick={() => void wipePhone()}>Apagar memória do Tinder e WhatsApp</button>
                  <button type="button" className="outline-button light" style={{ flex: 1, minWidth: '150px' }} onClick={() => void resetPoints()}>Resetar pontos para 10</button>
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
                {player && <div className="cast-item"><div className="cast-avatar">{player.image_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={player.image_url} alt="" /> : <UserRound />}</div><div style={{ flex: 1 }}><strong>{player.name}</strong><span>VOCÊ CONTROLA</span></div><button className="icon-button light" onClick={() => setEditingPlayer(true)} aria-label="Editar protagonista"><Pencil size={15} /></button></div>}
                {characters.map((c) => (
                  <div key={c.id} className="cast-item">
                    <div className="cast-avatar">{c.image_url ? <img src={c.image_url} alt="" /> : <UserRound />}</div>
                    <div style={{ flex: 1 }}><strong>{c.name || "Sem nome"}</strong><span>{[c.nickname || c.relationship_to_protagonist || "NPC", c.voice ? `Voz ${c.voice}` : ''].filter(Boolean).join(' · ')}</span>{c.relationship && typeof c.relationship.relationship_value === "number" && (<div className="rel-bar-wrap" title={c.relationship.description}><div className="rel-bar"><div className="rel-fill" style={{ width: `${Math.max(0, Math.min(100, c.relationship.relationship_value))}%` }} /></div><span className="rel-val">{c.relationship.relationship_value}/100</span></div>)}</div>
                    <button className="icon-button light" onClick={() => setEditingChar(c)} aria-label="Editar Personagem"><Pencil size={15} /></button>
                  </div>
                ))}
                {characters.length === 0 && <p className="drawer-empty">Nenhum personagem criado.</p>}
              </>}
              {panel === 'cast' && editingPlayer && player && (
                <div className="char-editor-panel">
                  <div className="drawer-head" style={{ padding: 0, marginBottom: '12px', background: 'none' }}>
                    <button className="outline-button light" onClick={() => setEditingPlayer(false)}><ArrowLeft size={16} /> Voltar</button>
                    <strong style={{ flex: 1, textAlign: 'right' }}>{player.name || 'Protagonista'}</strong>
                  </div>
                  <button type="button" className="outline-button light" onClick={() => { setUploadTarget('player'); fileInputRef.current?.click() }}>Trocar imagem</button>
                  <div className="field"><span>Nome</span><input value={player.name} onChange={(e) => setPlayer({ ...player, name: e.target.value })} /></div>
                  <div className="char-form-grid">
                    <div className="field"><span>Apelido</span><input value={player.nickname} onChange={(e) => setPlayer({ ...player, nickname: e.target.value })} /></div>
                    <div className="field"><span>Idade</span><input value={player.age} onChange={(e) => setPlayer({ ...player, age: e.target.value })} /></div>
                  </div>
                  <div className="field"><span>Aparência</span><textarea value={player.appearance} onChange={(e) => setPlayer({ ...player, appearance: e.target.value })} rows={3} /></div>
                  <div className="field"><span>Personalidade</span><textarea value={player.personality} onChange={(e) => setPlayer({ ...player, personality: e.target.value })} rows={3} /></div>
                  <div className="field"><span>Passado</span><textarea value={player.history} onChange={(e) => setPlayer({ ...player, history: e.target.value })} rows={3} /></div>
                  <div className="field"><span>Estilo de fala</span><textarea value={player.speech_style || ''} onChange={(e) => setPlayer({ ...player, speech_style: e.target.value })} rows={2} /></div>
                  <div className="field"><span>Objetivos</span><textarea value={player.goals} onChange={(e) => setPlayer({ ...player, goals: e.target.value })} rows={2} /></div>
                  <div className="field"><span>Medos</span><textarea value={player.fears} onChange={(e) => setPlayer({ ...player, fears: e.target.value })} rows={2} /></div>
                  <div className="field"><span>Segredos</span><textarea value={player.secrets || ''} onChange={(e) => setPlayer({ ...player, secrets: e.target.value })} rows={2} /></div>
                  <div className="field"><span>Gosta de</span><textarea value={player.likes || ''} onChange={(e) => setPlayer({ ...player, likes: e.target.value })} rows={2} /></div>
                  <div className="field"><span>Não gosta de</span><textarea value={player.dislikes || ''} onChange={(e) => setPlayer({ ...player, dislikes: e.target.value })} rows={2} /></div>
                  <div className="field"><span>Se irrita ao máximo com</span><textarea value={player.irritates || ''} onChange={(e) => setPlayer({ ...player, irritates: e.target.value })} rows={2} /></div>
                  <div className="field"><span>Se magoa com</span><textarea value={player.hurts || ''} onChange={(e) => setPlayer({ ...player, hurts: e.target.value })} rows={2} /></div>
                  <div className="field"><span>Informações extras</span><textarea value={player.extra_information} onChange={(e) => setPlayer({ ...player, extra_information: e.target.value })} rows={2} /></div>
                  <div className="expressions-grid">
                    <span>Expressões e fotos</span>
                    <div className="expr-slots">
                      {['neutral', 'happy', 'angry', 'ashamed', 'intimate', 'foto_casual', 'foto_sensual', 'foto_pe', 'foto_18'].map((expr) => {
                        const img = player.expressions?.[expr] || (expr === 'neutral' ? player.image_url : null)
                        return (
                          <div key={expr} className="expr-slot" onClick={() => { setUploadTarget(`player_expr:${expr}`); fileInputRef.current?.click() }}>
                            {img ? <img src={img} alt={expr} /> : <div className="expr-empty"><ImagePlus size={16}/></div>}
                            <small>{expr.replace('foto_', 'foto ')}</small>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <button className="primary-button" style={{ marginTop: 16 }} onClick={async () => {
                    try {
                      await svc.savePlayer(player)
                      const photoRules = withPlayerPhotos(masterRules.current, Object.keys(player.expressions || {}))
                      masterRules.current = photoRules
                      setRulesText(photoRules)
                      await svc.saveNarrativeMode(storyId, photoRules)
                      setEditingPlayer(false)
                      notify('Protagonista atualizado.', 'ok')
                    } catch (e) {
                      notify(friendlyError(e, 'Não foi possível salvar o protagonista.'), 'error')
                    }
                  }}>Salvar protagonista</button>
                </div>
              )}
              {panel === 'cast' && editingChar && (
                <div className="char-editor-panel">
                  <div className="drawer-head" style={{ padding: 0, marginBottom: '12px', background: 'none' }}>
                    <button className="outline-button light" onClick={() => setEditingChar(null)}><ArrowLeft size={16} /> Voltar</button><button className="icon-button light" title="Exportar JSON" onClick={() => { const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(editingChar, null, 2)); const el = document.createElement('a'); el.setAttribute('href', dataStr); el.setAttribute('download', editingChar.name + '.json'); document.body.appendChild(el); el.click(); el.remove(); notify('Exportado!'); }}><Download size={16} /></button>
                    <strong style={{ flex: 1, textAlign: 'right' }}>{editingChar.name || 'Personagem'}</strong>
                  </div>
                  <div className="field"><span>Nome</span><input value={editingChar.name} onChange={(e) => setEditingChar({ ...editingChar, name: e.target.value })} /></div>
                  <div className="char-form-grid">
                    <div className="field"><span>Apelido</span><input value={editingChar.nickname} onChange={(e) => setEditingChar({ ...editingChar, nickname: e.target.value })} /></div>
                    <div className="field"><span>Idade</span><input value={editingChar.age} onChange={(e) => setEditingChar({ ...editingChar, age: e.target.value })} /></div>
                  </div>
                  <div className="field"><span>Aparência</span><textarea value={editingChar.appearance} onChange={(e) => setEditingChar({ ...editingChar, appearance: e.target.value })} rows={3} placeholder="Como é fisicamente?" /></div>
                  <div className="field"><span>Personalidade</span><textarea value={editingChar.personality} onChange={(e) => setEditingChar({ ...editingChar, personality: e.target.value })} rows={3} placeholder="Como pensa e age?" /></div>
                  <div className="field"><span>Passado / História</span><textarea value={editingChar.history} onChange={(e) => setEditingChar({ ...editingChar, history: e.target.value })} rows={3} /></div>
                  <div className="field"><span>Estilo de fala</span><textarea value={editingChar.speech_style} onChange={(e) => setEditingChar({ ...editingChar, speech_style: e.target.value })} rows={2} placeholder="Gírias, tom, tiques de linguagem" /></div>
                  <VoiceField light value={editingChar.voice ?? ''} onChange={(v) => setEditingChar({ ...editingChar, voice: v || null })} />
                  <div style={{ border: '1.5px solid #e5b869', borderRadius: '8px', padding: '12px', background: 'rgba(229, 184, 105, 0.08)', margin: '10px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e5b869', fontWeight: 'bold', fontSize: '11px', marginBottom: '4px' }}>
                      <Sparkles size={13} /> ⭐ O QUE PENSA ATUALMENTE SOBRE VOCÊ (REGRA DE OURO DA IA)
                    </div>
                    <p style={{ fontSize: '10px', color: '#aaa', margin: '0 0 6px 0', lineHeight: 1.4 }}>
                      Regra de ouro inegociável: O Gemini seguirá à risca este campo para ditar o comportamento e as intenções reais deste personagem.
                    </p>
                    <textarea value={editingChar.relationship_to_protagonist} onChange={(e) => setEditingChar({ ...editingChar, relationship_to_protagonist: e.target.value })} rows={3} placeholder="O que este personagem pensa secretamente sobre você agora..." style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(229,184,105,0.3)', borderRadius: '4px', color: '#fff', padding: '8px', fontSize: '12px' }} />
                  </div>
                  <div className="field"><span>Objetivos</span><textarea value={editingChar.goals} onChange={(e) => setEditingChar({ ...editingChar, goals: e.target.value })} rows={2} /></div>
                  <div className="field"><span>Medos</span><textarea value={editingChar.fears} onChange={(e) => setEditingChar({ ...editingChar, fears: e.target.value })} rows={2} /></div>
                  <div className="field"><span>Segredos</span><textarea value={editingChar.secrets} onChange={(e) => setEditingChar({ ...editingChar, secrets: e.target.value })} rows={2} placeholder="O narrador sabe, mas não revela sem motivo." /></div>
                  <div className="field"><span>Gosta de</span><textarea value={editingChar.likes || ''} onChange={(e) => setEditingChar({ ...editingChar, likes: e.target.value })} rows={2} /></div>
                  <div className="field"><span>Não gosta de</span><textarea value={editingChar.dislikes || ''} onChange={(e) => setEditingChar({ ...editingChar, dislikes: e.target.value })} rows={2} /></div>
                  <div className="field"><span>Se irrita ao máximo com</span><textarea value={editingChar.irritates || ''} onChange={(e) => setEditingChar({ ...editingChar, irritates: e.target.value })} rows={2} /></div>
                  <div className="field"><span>Se magoa com</span><textarea value={editingChar.hurts || ''} onChange={(e) => setEditingChar({ ...editingChar, hurts: e.target.value })} rows={2} /></div>
                  <div className="field"><span>Informações extras</span><textarea value={editingChar.extra_information} onChange={(e) => setEditingChar({ ...editingChar, extra_information: e.target.value })} rows={2} /></div>
                  {editingChar.relationship && typeof editingChar.relationship.relationship_value === "number" && (<div className="field"><span>Pontos de Relacionamento (0 a 100)</span><input type="number" min={0} max={100} value={editingChar.relationship.relationship_value} onChange={(e) => setEditingChar({ ...editingChar, relationship: { ...editingChar.relationship!, relationship_value: Number(e.target.value) } })} style={{ padding: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid #444", color: "#fff" }} /></div>)}
                  
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
                  <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                    <button
                      className="outline-button light"
                      style={{ color: '#ff6b6b', borderColor: 'rgba(255, 107, 107, 0.4)', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={async () => {
                        if (!confirm(`Tem certeza que deseja excluir "${editingChar.name || 'este personagem'}"?`)) return
                        try {
                          await svc.deleteCharacter(editingChar.id)
                          setCharacters((prev) => prev.filter((c) => c.id !== editingChar.id))
                          setEditingChar(null)
                          notify('Personagem excluído do elenco.')
                        } catch (e) {
                          notify(friendlyError(e, 'Erro ao excluir personagem.'), 'error')
                        }
                      }}
                      title="Excluir este personagem do elenco"
                    >
                      <Trash2 size={16} /> Excluir
                    </button>
                    <button
                      className="primary-button"
                      style={{ flex: 1 }}
                      onClick={async () => {
                        try {
                          await svc.saveCharacter(editingChar)
                          setCharacters((ch) => ch.map((c) => c.id === editingChar.id ? editingChar : c))
                          setEditingChar(null)
                          notify('Personagem salvo com sucesso!', 'ok')
                        } catch (e) {
                          notify(friendlyError(e), 'error')
                        }
                      }}
                    >
                      Salvar Alterações
                    </button>
                  </div>
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
                    <button className="outline-button light" type="button" onClick={() => void wipePhone()}>Apagar memória</button>
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
                    const thread = phoneThread(messages, 'whatsapp', c.id)
                    const lastNpcMsg = thread[thread.length - 1]
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
                            <p>{lastNpcMsg ? lastNpcMsg.content.slice(0, 38) + (lastNpcMsg.content.length > 38 ? '...' : '') : 'Conversa nova'}</p>
                          </div>
                        </div>
                        <div className="wpp-intimacy-chip" title="Chance de mandar foto se você pedir">
                          {intimacy >= 50 ? '❤️' : intimacy >= 20 ? '💬' : '👋'} {intimacy}/100 · foto {intimacy}%
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
                    Conversa nova, só neste WhatsApp. A campanha não entra aqui. Foto, se você pedir: {wppContact.relationship?.relationship_value ?? 0}% de chance.
                  </div>

                  {phoneThread(messages, 'whatsapp', wppContact.id)
                    .slice(-20)
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
                            <p className="wpp-bubble-text">{stripStageDirections(m.content).replace(/\[MENSAGEM DE WHATSAPP PARA .*?\]:\s*"?/, '').replace(/"?\.\s*RESPONDA NO MODO WHATSAPP:[\s\S]*$/, '')}</p>
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

                {messages.some((m) => /\[\[DESMATCH\]\]/.test(m.content) && String(m.metadata?.character_id || m.character_id || '') === wppContact.id) ? (
                  <div className="wpp-input-bar"><p>Ela encerrou a conversa.</p></div>
                ) : (
                <div className="wpp-input-bar">
                  <button type="button" className="wpp-icon-btn" title="Enviar foto" onClick={() => phoneImageRef.current?.click()}><Camera size={20}/></button>
                  <button type="button" className="wpp-icon-btn" title="Pedir foto" onClick={() => sendPhone('whatsapp', wppContact, 'Me manda uma foto sua.')}>📷</button>
                  <input
                    className="wpp-text-input"
                    value={wppInput}
                    onChange={(e) => setWppInput(e.target.value)}
                    disabled={!dailyLimit.isWhitelisted && dailyLimit.remaining <= 0}
                    placeholder={phoneImage ? 'Foto pronta para enviar' : 'Mensagem'}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) sendPhone('whatsapp', wppContact, wppInput, phoneImage) }}
                  />
                  <button type="button" className="wpp-send-btn" disabled={(!wppInput.trim() && !phoneImage) || busy.current} onClick={() => sendPhone('whatsapp', wppContact, wppInput, phoneImage)}>
                    <Send size={16}/>
                  </button>
                </div>
                )}
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
                    <button className="outline-button light" type="button" style={{ marginLeft: 'auto' }} onClick={() => void wipePhone()}>Apagar memória</button>
                    <button className="icon-button light" onClick={() => { setPanel(null); setTinderChatContact(null); }}><X size={18}/></button>
                  </div>
                  <div className="tinder-messages-canvas">
                    <div className="tinder-match-banner">
                      <Flame size={20} color="#ff4458"/>
                      <span>Match novo. Esta conversa começa do zero. Foto, se você pedir: {tinderChatContact.relationship?.relationship_value ?? 0}%.</span>
                    </div>
                    {phoneThread(messages, 'tinder', tinderChatContact.id)
                      .slice(-20)
                      .map((m, idx) => {
                        const isMe = m.sender_type === 'player'
                        const photoUrl = m.expression?.startsWith('foto_') ? ((tinderChatContact as { expressions?: Record<string, string> }).expressions?.[m.expression] || tinderChatContact.image_url) : null
                        return (
                          <div key={idx} className={`tinder-bubble-wrap ${isMe ? 'is-me' : 'is-them'}`}>
                            <div className={`tinder-bubble ${isMe ? 'me' : 'them'}`}>
                              {photoUrl && <img src={photoUrl} alt="" />}
                              <p>{stripStageDirections(m.content).replace(/\[MENSAGEM NO TINDER PARA .*?\]:\s*"?/, '').replace(/"?\.\s*RESPONDA NO MODO TINDER CHAT:[\s\S]*$/, '')}</p>
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
                  {messages.some((m) => /\[\[DESMATCH\]\]/.test(m.content) && String(m.metadata?.character_id || m.character_id || '') === tinderChatContact.id) ? (
                    <div className="tinder-input-bar"><p>Ela desfez o match.</p></div>
                  ) : (
                  <div className="tinder-input-bar">
                    <button type="button" className="wpp-icon-btn" title="Enviar foto" onClick={() => phoneImageRef.current?.click()}><Camera size={18}/></button>
                    <button type="button" className="wpp-icon-btn" title="Pedir foto" onClick={() => sendPhone('tinder', tinderChatContact, 'Me manda uma foto sua.')}>📷</button>
                    <input
                      className="tinder-text-input"
                      value={tinderInput}
                      onChange={(e) => setTinderInput(e.target.value)}
                      disabled={!dailyLimit.isWhitelisted && dailyLimit.remaining <= 0}
                      placeholder={phoneImage ? 'Foto pronta para enviar' : 'Diga algo interessante...'}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) sendPhone('tinder', tinderChatContact, tinderInput, phoneImage) }}
                    />
                    <button className="tinder-send-btn" disabled={(!tinderInput.trim() && !phoneImage) || busy.current} onClick={() => sendPhone('tinder', tinderChatContact, tinderInput, phoneImage)}>
                      <Send size={16}/>
                    </button>
                  </div>
                  )}
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
