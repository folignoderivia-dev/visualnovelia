'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, Compass, Play, Plus, Save,
  Sparkles, Trash2, UserRound, UsersRound, WandSparkles,
} from 'lucide-react'
import type { Character, MasterSettings, PlayerCharacter, Scenario, Story, StoryBundle, World } from '@/lib/types'
import * as svc from '@/lib/story/service'
import { removeImage, uploadImage } from '@/lib/story/storage'
import { friendlyError } from '@/lib/errors'
import { ChipPicker, Field, ImageUpload } from '@/components/ui/form'
import { useToast } from '@/components/ui/toast'

export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

const steps = [
  { number: '01', label: 'História', icon: BookOpen },
  { number: '02', label: 'Mundo', icon: Compass },
  { number: '03', label: 'Mestre', icon: WandSparkles },
  { number: '04', label: 'Personagens', icon: UsersRound },
  { number: '05', label: 'Protagonista', icon: UserRound },
  { number: '06', label: 'Revisão', icon: Check },
]
const genres = ['Fantasia', 'Romance', 'Terror', 'Mistério', 'Aventura', 'Ficção científica', 'Drama', 'Cyberpunk']
const tones = ['Sombrio', 'Leve', 'Épico', 'Dramático', 'Romântico', 'Misterioso', 'Realista', 'Surreal']

type Section = 'story' | 'world' | 'master' | 'scenario' | 'player'

export function Editor({ storyId, onExit, onPlay, onSaveState }: {
  storyId: string; onExit: () => void; onPlay: (storyId: string) => void; onSaveState: (s: SaveState) => void
}) {
  const { notify } = useToast()
  const [bundle, setBundle] = useState<StoryBundle | null>(null)
  const [loadError, setLoadError] = useState('')
  const [step, setStep] = useState(0)
  const [editing, setEditing] = useState<Character | null>(null)
  const [savingChar, setSavingChar] = useState(false)

  const ref = useRef<StoryBundle | null>(null)
  const dirty = useRef(new Set<Section>())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flushing = useRef<Promise<void>>(Promise.resolve())
  const unmounted = useRef(false)

  // -------- carregar --------
  useEffect(() => {
    let alive = true
    svc.loadBundle(storyId).then((b) => {
      if (!alive) return
      ref.current = b; setBundle(b); setStep(Math.min(5, b.story.editor_step ?? 0))
    }).catch((e) => alive && setLoadError(friendlyError(e, 'Não foi possível abrir esta história.')))
    return () => { alive = false }
  }, [storyId])

  // -------- salvar (autosave com debounce) --------
  const flush = useCallback((): Promise<void> => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    flushing.current = flushing.current.then(async () => {
      const b = ref.current
      const sections = Array.from(dirty.current)
      if (!b || sections.length === 0) return
      dirty.current.clear()
      onSaveState('saving')
      try {
        await Promise.all(sections.map((s) => {
          if (s === 'story') return svc.saveStory(b.story)
          if (s === 'world') return svc.saveWorld(b.world)
          if (s === 'master') return svc.saveMaster(b.master)
          if (s === 'player') return svc.savePlayer(b.player)
          const sc = b.scenarios.find((x) => x.is_starting_scenario) ?? b.scenarios[0]
          return sc ? svc.saveScenario(sc) : Promise.resolve()
        }))
        onSaveState('saved')
      } catch (e) {
        sections.forEach((s) => dirty.current.add(s))
        onSaveState('error')
        notify(friendlyError(e, 'Não foi possível salvar agora. Vamos tentar de novo.'), 'error')
        if (!timer.current && !unmounted.current) timer.current = setTimeout(() => { flush() }, 6000)
      }
    })
    return flushing.current
  }, [notify, onSaveState])

  const update = useCallback((fn: (b: StoryBundle) => StoryBundle, section: Section) => {
    if (!ref.current) return
    ref.current = fn(ref.current)
    setBundle(ref.current)
    dirty.current.add(section)
    onSaveState('pending')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { flush() }, 1200)
  }, [flush, onSaveState])

  // Salva ao sair da aba / fechar
  useEffect(() => {
    unmounted.current = false
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    document.addEventListener('visibilitychange', onHide)
    return () => { document.removeEventListener('visibilitychange', onHide); flush(); unmounted.current = true }
  }, [flush])

  const goStep = (n: number) => {
    setStep(n); setEditing(null)
    update((b) => ({ ...b, story: { ...b.story, editor_step: n } }), 'story')
  }

  const progress = useMemo(() => Math.round(((step + 1) / steps.length) * 100), [step])

  if (loadError) return <section className="editor-page"><div className="empty-state"><h2>{loadError}</h2><button className="outline-button" onClick={onExit}>Voltar às histórias</button></div></section>
  if (!bundle) return <section className="editor-page"><div className="loading-line">Abrindo sua história…</div></section>

  const { story, world, master, player, characters } = bundle
  const startScenario = bundle.scenarios.find((x) => x.is_starting_scenario) ?? bundle.scenarios[0]
  const storyTitle = story.title || 'Nova história sem título'

  const setStory = (p: Partial<Story>) => update((b) => ({ ...b, story: { ...b.story, ...p } }), 'story')
  const setWorld = (p: Partial<World>) => update((b) => ({ ...b, world: { ...b.world, ...p } }), 'world')
  const setMaster = (p: Partial<MasterSettings>) => update((b) => ({ ...b, master: { ...b.master, ...p } }), 'master')
  const setPlayer = (p: Partial<PlayerCharacter>) => update((b) => ({ ...b, player: { ...b.player, ...p } }), 'player')
  const setScenario = (p: Partial<Scenario>) => update((b) => ({ ...b, scenarios: b.scenarios.map((x) => x.id === startScenario?.id ? { ...x, ...p } : x) }), 'scenario')

  async function uploadScenario(file: File) {
    const userId = story.user_id
    const old = startScenario?.image_path ?? null
    const { url, path } = await uploadImage({ bucket: 'scenario-assets', userId, storyId, file, maxSide: 1920 })
    setScenario({ image_url: url, image_path: path })
    await flush()
    removeImage('scenario-assets', old).catch(() => {})
  }
  async function uploadPlayer(file: File) {
    const old = player.image_path
    const { url, path } = await uploadImage({ bucket: 'player-assets', userId: story.user_id, storyId, file, maxSide: 1200 })
    setPlayer({ image_url: url, image_path: path })
    await flush()
    removeImage('player-assets', old).catch(() => {})
  }

  async function newCharacter() {
    try { const c = await svc.createCharacter(storyId); update((b) => ({ ...b, characters: [...b.characters, c] }), 'story'); setEditing(c) }
    catch (e) { notify(friendlyError(e, 'Não foi possível criar o personagem.'), 'error') }
  }
  async function saveChar() {
    if (!editing) return
    setSavingChar(true)
    try {
      await svc.saveCharacter(editing)
      update((b) => ({ ...b, characters: b.characters.map((c) => c.id === editing.id ? editing : c) }), 'story')
      setEditing(null); notify('Personagem salvo.')
    } catch (e) { notify(friendlyError(e, 'Não foi possível salvar o personagem.'), 'error') } finally { setSavingChar(false) }
  }
  async function removeChar(c: Character) {
    if (!confirm(`Excluir ${c.name || 'este personagem'}?`)) return
    try {
      await svc.deleteCharacter(c.id); removeImage('character-assets', c.image_path).catch(() => {})
      update((b) => ({ ...b, characters: b.characters.filter((x) => x.id !== c.id) }), 'story'); setEditing(null)
    } catch (e) { notify(friendlyError(e, 'Não foi possível excluir.'), 'error') }
  }
  async function uploadChar(file: File) {
    if (!editing) return
    const { url, path } = await uploadImage({ bucket: 'character-assets', userId: story.user_id, storyId, file, maxSide: 1200 })
    removeImage('character-assets', editing.image_path).catch(() => {})
    setEditing({ ...editing, image_url: url, image_path: path })
  }

  const missing: string[] = []
  if (!player.name.trim()) missing.push('Dê um nome ao seu protagonista (etapa 05).')
  if (!story.title.trim()) missing.push('Dê um nome à sua história (etapa 01).')
  const canStart = !!player.name.trim()

  async function start() {
    await flush()
    if (dirty.current.size > 0) { notify('Não conseguimos salvar suas alterações. Verifique a conexão e tente de novo.', 'error'); return }
    try { await svc.markReady(storyId) } catch { /* não bloqueia */ }
    onPlay(storyId)
  }

  async function exitEditor() {
    await flush()
    if (dirty.current.size > 0 && !confirm('Algumas alterações ainda não foram salvas (problema de conexão?). Sair mesmo assim e perdê-las?')) return
    onExit()
  }

  const ch = (k: keyof Character) => (v: string) => editing && setEditing({ ...editing, [k]: v })

  return (
    <section className="editor-page">
      <div className="editor-heading"><div><span className="eyebrow">ESTÚDIO DE CRIAÇÃO</span><h1>Construindo sua história</h1></div><button className="ghost-button" onClick={exitEditor}><ArrowLeft /> Sair do editor</button></div>
      <div className="stepper" aria-label="Etapas de criação">{steps.map((item, index) => <button key={item.label} className={`step ${index === step ? 'current' : ''} ${index < step ? 'done' : ''}`} onClick={() => goStep(index)}><span className="step-number">{index < step ? <Check /> : item.number}</span><span className="step-label">{item.label}</span><span className="step-line" /></button>)}</div>
      <div className="progress-mobile"><span>ETAPA {steps[step].number} / 06</span><span>{progress}% concluído</span><div><i style={{ width: `${progress}%` }} /></div></div>
      <div className="editor-layout"><div className="editor-main">

        {step === 0 && <>
          <div className="section-intro"><span className="section-number">01</span><div><h2>Comece pela ideia</h2><p>Que história você quer criar?</p></div></div>
          <div className="form-card">
            <Field label="Nome da história" placeholder="Digite o nome da sua história..." value={story.title} onChange={(v) => setStory({ title: v })} />
            <Field label="Descrição" placeholder="Conte brevemente qual é a ideia desta história." multiline value={story.description} onChange={(v) => setStory({ description: v })} />
            <ChipPicker label="Gênero" hint="Você pode escolher mais de um" options={genres} value={story.genre} onChange={(v) => setStory({ genre: v })} />
            <ChipPicker label="Tom da narrativa" options={tones} value={story.tone} onChange={(v) => setStory({ tone: v })} />
          </div></>}

        {step === 1 && <>
          <div className="section-intro"><span className="section-number">02</span><div><h2>Construa o seu mundo</h2><p>Aqui você define onde sua história existe.</p></div></div>
          <div className="form-card">
            <Field label="Nome do mundo" placeholder="Como este mundo é chamado?" value={world.world_name} onChange={(v) => setWorld({ world_name: v })} />
            <Field label="Descrição do mundo" placeholder="Descreva o que torna este lugar único..." multiline value={world.description} onChange={(v) => setWorld({ description: v })} />
            <div className="two-col"><Field label="Época" placeholder="Ex.: um futuro distante" value={world.era} onChange={(v) => setWorld({ era: v })} /><Field label="Local inicial" placeholder="Onde tudo começa?" value={world.starting_location} onChange={(v) => setWorld({ starting_location: v })} /></div>
            <Field label="Regras do mundo" placeholder="O que é possível — e o que não é — neste mundo?" multiline value={world.world_rules} onChange={(v) => setWorld({ world_rules: v })} />
            <Field label="Atmosfera" placeholder="Que sensação este lugar transmite?" value={world.atmosphere} onChange={(v) => setWorld({ atmosphere: v })} />
            <Field label="Informações importantes" placeholder="Fatos, história, lugares, facções… tudo que o narrador deve saber." multiline value={world.important_information} onChange={(v) => setWorld({ important_information: v })} />
          </div>
          <div className="form-card scene-card"><div className="card-heading"><div><h3>Cenário inicial</h3><p>O palco onde sua primeira cena acontece.</p></div><span className="optional">OPCIONAL</span></div>
            <Field label="Nome do cenário" placeholder="Ex.: Biblioteca antiga" value={startScenario?.name ?? ''} onChange={(v) => setScenario({ name: v })} />
            <Field label="Descrição do cenário" placeholder="Como é este lugar? (ajuda o narrador)" multiline rows={3} value={startScenario?.description ?? ''} onChange={(v) => setScenario({ description: v })} />
            <ImageUpload url={startScenario?.image_url ?? null} large onFile={uploadScenario} />
            <div className="upload-actions"><button className="soft-button" disabled><Sparkles /> Gerar com IA <small>em breve</small></button></div>
          </div></>}

        {step === 2 && <>
          <div className="section-intro"><span className="section-number">03</span><div><h2>Defina como a IA deve narrar</h2><p>Você cria as regras. O narrador dá vida ao mundo.</p></div></div>
          <div className="form-card">
            <Field label="Instruções do mestre" placeholder="Você é o narrador da minha história..." multiline rows={6} value={master.master_prompt} onChange={(v) => setMaster({ master_prompt: v })} />
            <div className="two-col"><Field label="Estilo de narrativa" placeholder="Ex.: cinematográfico" value={master.narrative_style} onChange={(v) => setMaster({ narrative_style: v })} /><Field label="Personalidade" placeholder="Ex.: observador e sutil" value={master.narrator_personality} onChange={(v) => setMaster({ narrator_personality: v })} /></div>
            <Field label="Regras de continuidade" placeholder="O que nunca pode ser esquecido?" multiline value={master.continuity_rules} onChange={(v) => setMaster({ continuity_rules: v })} />
            <Field label="Regras adicionais" placeholder="Ritmo, romance, humor, violência, mistério… escreva como quiser." multiline value={master.additional_rules} onChange={(v) => setMaster({ additional_rules: v })} />
            <div className="rule-note"><WandSparkles /><div><strong>Um espaço para sua voz</strong><p>Estas instruções guiam o narrador, não são parte da história. Escreva livremente.</p></div></div>
          </div></>}

        {step === 3 && <>
          <div className="section-intro"><span className="section-number">04</span><div><h2>Crie o elenco da sua história</h2><p>Cada personagem possui sua própria identidade.</p></div></div>
          {editing ? (
            <div className="form-card character-editor">
              <div className="protagonist-grid">
                <div><ImageUpload url={editing.image_url} placeholder="Retrato do personagem" onFile={uploadChar} /></div>
                <div className="form-stack">
                  <Field label="Nome" placeholder="Como este personagem se chama?" value={editing.name} onChange={ch('name')} />
                  <Field label="Apelido" placeholder="Como é chamado?" value={editing.nickname} onChange={ch('nickname')} />
                  <Field label="Idade" placeholder="Ex.: 24" value={editing.age} onChange={ch('age')} />
                </div>
              </div>
              <Field label="Aparência" placeholder="Como ele/ela é fisicamente?" multiline rows={3} value={editing.appearance} onChange={ch('appearance')} />
              <Field label="Personalidade" placeholder="Como pensa e age?" multiline rows={3} value={editing.personality} onChange={ch('personality')} />
              <Field label="Jeito de falar" placeholder="Gírias, formalidade, tiques de fala…" value={editing.speech_style} onChange={ch('speech_style')} />
              <Field label="Relação com o protagonista" placeholder="Quem é para o seu protagonista?" value={editing.relationship_to_protagonist} onChange={ch('relationship_to_protagonist')} />
              <Field label="História" placeholder="Passado do personagem." multiline rows={3} value={editing.history} onChange={ch('history')} />
              <div className="two-col"><Field label="Objetivos" placeholder="O que quer?" multiline rows={3} value={editing.goals} onChange={ch('goals')} /><Field label="Medos" placeholder="Do que tem medo?" multiline rows={3} value={editing.fears} onChange={ch('fears')} /></div>
              <Field label="Segredos" placeholder="O que o narrador sabe mas não deve revelar sem motivo." multiline rows={3} value={editing.secrets} onChange={ch('secrets')} />
              <Field label="Informações extras" placeholder="Qualquer outra coisa importante." multiline rows={3} value={editing.extra_information} onChange={ch('extra_information')} />
              <div className="editor-footer char-footer"><button className="ghost-button" onClick={() => setEditing(null)}><ArrowLeft /> Cancelar</button><button className="ghost-button danger" onClick={() => removeChar(editing)}><Trash2 /> Excluir</button><button className="primary-button" disabled={savingChar} onClick={saveChar}><Save /> {savingChar ? 'Salvando…' : 'Salvar personagem'}</button></div>
            </div>
          ) : (
            <div className="form-card characters-card">
              {characters.length === 0 && <div className="empty-character"><div className="character-icon"><UsersRound /></div><h3>Seu elenco começa aqui</h3><p>Crie os personagens que vão habitar o seu mundo, um por um.</p></div>}
              {characters.length > 0 && <div className="character-list">{characters.map((c) => (
                <button key={c.id} className="character-preview" onClick={() => setEditing(c)}>
                  <div className="mini-portrait">{c.image_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={c.image_url} alt="" loading="lazy" /> : <UserRound />}</div>
                  <div><strong>{c.name || 'Personagem sem nome'}</strong><span>Clique para editar</span></div><ChevronRight />
                </button>))}</div>}
              <div className="empty-character"><button className="primary-button" onClick={newCharacter}><Plus /> Novo personagem</button></div>
            </div>
          )}</>}

        {step === 4 && <>
          <div className="section-intro"><span className="section-number">05</span><div><h2>Crie seu protagonista</h2><p>Este é o personagem que você controla.</p></div></div>
          <div className="form-card protagonist-card"><div className="control-badge"><UserRound /> VOCÊ CONTROLA ESTE PERSONAGEM</div>
            <div className="protagonist-grid"><div><ImageUpload url={player.image_url} placeholder="Seu protagonista" onFile={uploadPlayer} /></div>
              <div className="form-stack"><Field label="Nome" placeholder="Como seu protagonista se chama?" value={player.name} onChange={(v) => setPlayer({ name: v })} /><Field label="Apelido" placeholder="Como é chamado?" value={player.nickname} onChange={(v) => setPlayer({ nickname: v })} />
                <div className="two-col"><Field label="Idade" placeholder="Ex.: 24" value={player.age} onChange={(v) => setPlayer({ age: v })} /><Field label="Objetivo" placeholder="O que busca?" value={player.goals} onChange={(v) => setPlayer({ goals: v })} /></div></div></div>
            <Field label="Aparência" placeholder="Como você é fisicamente?" multiline rows={3} value={player.appearance} onChange={(v) => setPlayer({ appearance: v })} />
            <Field label="Personalidade" placeholder="Descreva quem você é neste mundo..." multiline rows={3} value={player.personality} onChange={(v) => setPlayer({ personality: v })} />
            <Field label="Passado" placeholder="De onde você veio?" multiline rows={3} value={player.history} onChange={(v) => setPlayer({ history: v })} />
          </div></>}

        {step === 5 && <>
          <div className="section-intro"><span className="section-number">06</span><div><h2>Tudo pronto?</h2><p>Revise sua criação antes de abrir o primeiro capítulo.</p></div></div>
          <div className="review-grid">
            <div className="review-card"><span>HISTÓRIA</span><h3>{storyTitle}</h3><p>{story.description || 'Adicione uma descrição para apresentar sua história.'}</p><button onClick={() => goStep(0)}>Editar <ChevronRight /></button></div>
            <div className="review-card"><span>MUNDO</span><h3>{world.world_name || 'Seu mundo'}</h3><p>{world.description || 'O cenário ainda está esperando para ser descoberto.'}</p><button onClick={() => goStep(1)}>Editar <ChevronRight /></button></div>
            <div className="review-card"><span>CENÁRIO</span><h3>{startScenario?.name || 'Cenário inicial'}</h3><p>{startScenario?.image_url ? 'Imagem carregada.' : 'Sem imagem — o palco usará um fundo neutro.'}</p><button onClick={() => goStep(1)}>Editar <ChevronRight /></button></div>
            <div className="review-card"><span>MESTRE</span><h3>{master.narrative_style || 'Narrador padrão'}</h3><p>{master.master_prompt ? master.master_prompt.slice(0, 120) : 'Sem instruções personalizadas.'}</p><button onClick={() => goStep(2)}>Editar <ChevronRight /></button></div>
            <div className="review-card"><span>ELENCO</span><h3>{characters.length ? `${characters.length} personagem${characters.length > 1 ? 's' : ''}` : 'Nenhum personagem'}</h3><p>{characters.map((c) => c.name).filter(Boolean).join(', ') || 'Você pode criar quantos quiser.'}</p><button onClick={() => goStep(3)}>Editar <ChevronRight /></button></div>
            <div className="review-card"><span>PROTAGONISTA</span><h3>{player.name || 'Seu protagonista'}</h3><p>O personagem que você controla.</p><button onClick={() => goStep(4)}>Editar <ChevronRight /></button></div>
          </div>
          {missing.length > 0 && <div className="rule-note review-missing"><Sparkles /><div><strong>Falta pouco</strong>{missing.map((m) => <p key={m}>{m}</p>)}</div></div>}
          <div className="ready-card"><Sparkles /><div><span className="eyebrow">PRÓXIMO CAPÍTULO</span><h3>Seu mundo está esperando.</h3><p>Você poderá continuar editando tudo enquanto sua história evolui.</p></div><button className="primary-button" disabled={!canStart} onClick={start}><Play /> {story.status === 'playing' ? 'Continuar história' : 'Iniciar história'}</button></div></>}

        <div className="editor-footer"><button className="ghost-button" disabled={step === 0} onClick={() => goStep(Math.max(0, step - 1))}><ArrowLeft /> Anterior</button>{step < 5 && <button className="primary-button" onClick={() => goStep(Math.min(5, step + 1))}>Próxima etapa <ArrowRight /></button>}</div>
      </div><aside className="editor-aside"><div className="aside-card"><span className="eyebrow">SUA CRIAÇÃO</span><div className="aside-title"><div className="tiny-mark">A</div><div><strong>{storyTitle}</strong><span>Rascunho</span></div></div><div className="aside-progress"><div><span>Progresso</span><strong>{progress}%</strong></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div></div><div className="aside-list">{steps.map((item, index) => <button key={item.label} onClick={() => goStep(index)} className={index === step ? 'active' : ''}><span>{index < step ? <Check /> : item.number}</span>{item.label}<ChevronRight /></button>)}</div></div><div className="aside-tip"><Sparkles /><div><strong>Construa sem limites</strong><p>Não existe uma forma certa de contar uma história. Comece onde sua imaginação levar.</p></div></div></aside></div>
    </section>
  )
}
