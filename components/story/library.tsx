'use client'

import { ArrowRight, Clapperboard, MoreHorizontal, Play, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { Story } from '@/lib/types'

export type LibraryStory = Story & { cover: string | null }

const STATUS_LABEL: Record<string, string> = {
  draft: 'RASCUNHO', ready: 'PRONTA', playing: 'EM ANDAMENTO', completed: 'CONCLUÍDA', archived: 'ARQUIVADA',
}

function relativeDate(iso: string | null) {
  if (!iso) return 'Ainda não jogada'
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (days <= 0) return 'Jogada hoje'
  if (days === 1) return 'Jogada ontem'
  if (days < 30) return `Jogada há ${days} dias`
  return `Jogada em ${d.toLocaleDateString('pt-BR')}`
}

export function Library({ stories, loading, onCreate, onOpen, onDelete }: {
  stories: LibraryStory[]; loading: boolean; onCreate: () => void; onOpen: (s: LibraryStory) => void; onDelete: (s: LibraryStory) => void
}) {
  const [menu, setMenu] = useState<string | null>(null)
  return (
    <section className="library-page">
      <div className="page-intro"><div><span className="eyebrow">SEU ESTÚDIO CRIATIVO</span><h1>Minhas histórias</h1><p>Crie mundos, dê vida aos personagens e viva a história.</p></div><button className="primary-button" onClick={onCreate}><Plus /> Nova história</button></div>
      <div className="library-divider"><span>COLEÇÃO</span><span className="line" /></div>

      {loading ? (
        <div className="story-grid">{[0, 1, 2].map((i) => <div key={i} className="story-card skeleton" />)}</div>
      ) : stories.length === 0 ? (
        <div className="empty-state"><div className="empty-orbit"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="empty-glyph"><Clapperboard /></div></div><h2>Seu primeiro mundo ainda não foi criado.</h2><p>Comece com uma ideia. O resto da história é seu.</p><button className="outline-button" onClick={onCreate}>Criar minha primeira história <ArrowRight /></button></div>
      ) : (
        <div className="story-grid">
          {stories.map((s) => (
            <article key={s.id} className="story-card">
              <button className="story-cover" onClick={() => onOpen(s)} aria-label={`Abrir ${s.title || 'história sem título'}`}>
                {s.cover ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={s.cover} alt="" loading="lazy" /> : <div className="story-cover-empty"><Clapperboard /></div>}
                <span className={`story-status status-${s.status}`}>{STATUS_LABEL[s.status]}</span>
              </button>
              <div className="story-info">
                <div className="story-info-top">
                  <h3>{s.title || 'História sem título'}</h3>
                  <div className="story-menu">
                    <button className="icon-button" onClick={() => setMenu(menu === s.id ? null : s.id)} aria-label="Mais opções"><MoreHorizontal /></button>
                    {menu === s.id && <div className="story-menu-pop"><button onClick={() => { setMenu(null); if (confirm('Excluir esta história para sempre? Isso apaga personagens, mensagens e memórias.')) onDelete(s) }}><Trash2 /> Excluir</button></div>}
                  </div>
                </div>
                <span className="story-genre">{s.genre || 'Sem gênero definido'}</span>
                <span className="story-date">{relativeDate(s.last_played_at)}</span>
                <button className="outline-button story-continue" onClick={() => onOpen(s)}>
                  {s.status === 'playing' || s.status === 'completed' ? <><Play /> Continuar</> : <>Continuar edição <ArrowRight /></>}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
