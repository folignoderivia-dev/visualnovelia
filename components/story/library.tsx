'use client'

import { ArrowRight, Clapperboard, Compass, Flame, MoreHorizontal, Play, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { Story } from '@/lib/types'

export type LibraryStory = Story & { cover: string | null }

const STATUS_LABEL: Record<string, string> = {
  draft: 'RASCUNHO', ready: 'PRONTA', playing: 'EM PROGRESSO', completed: 'FINALIZADA', archived: 'ARQUIVADA',
}

function relativeDate(iso: string | null) {
  if (!iso) return 'Ainda não iniciada'
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
    <section className="library-page vn-library-realm">
      <div className="vn-hero-banner">
        <div className="vn-hero-content">
          <span className="eyebrow vn-gold-eyebrow">✦ SALÃO DAS HISTÓRIAS & CAMPANHAS ✦</span>
          <h1>BIBLIOTECA DE AVENTURAS</h1>
          <p>Selecione um mundo existente para continuar sua saga interativa ou crie uma nova campanha com personagens, regras e cenários únicos.</p>
          <div className="vn-hero-actions">
            <button className="primary-button vn-gold-button" onClick={onCreate}>
              <Plus size={17} /> Criar Nova Aventura
            </button>
          </div>
        </div>
        <div className="vn-hero-crest">
          <Compass size={96} className="vn-floating-crest" />
        </div>
      </div>

      <div className="library-divider vn-rpg-divider">
        <span>SUAS CAMPANHAS SALVAS</span>
        <span className="line" />
      </div>

      {loading ? (
        <div className="story-grid">{[0, 1, 2].map((i) => <div key={i} className="story-card skeleton vn-card-frame" />)}</div>
      ) : stories.length === 0 ? (
        <div className="empty-state vn-empty-state">
          <div className="empty-orbit">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="empty-glyph"><Sparkles size={28} /></div>
          </div>
          <h2>Nenhum mundo registrado no seu pergaminho.</h2>
          <p>O universo espera pela sua imaginação. Crie sua primeira Visual Novel agora mesmo.</p>
          <button className="primary-button vn-gold-button" onClick={onCreate}>
            <Plus size={16} /> Forjar Minha Primeira Campanha
          </button>
        </div>
      ) : (
        <div className="story-grid vn-story-grid">
          {stories.map((s) => (
            <article key={s.id} className="story-card vn-story-card">
              <div className="vn-card-border-glow" />
              <button className="story-cover vn-story-cover" onClick={() => onOpen(s)} aria-label={`Abrir ${s.title || 'história sem título'}`}>
                {s.cover ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={s.cover} alt={s.title || 'Capa'} loading="lazy" />
                ) : (
                  <div className="story-cover-empty vn-cover-empty">
                    <Clapperboard size={36} />
                    <span>Sem Capa</span>
                  </div>
                )}
                <div className="vn-cover-overlay" />
                <span className={`story-status status-${s.status} vn-status-pill`}>{STATUS_LABEL[s.status] || 'AVENTURA'}</span>
              </button>
              <div className="story-info vn-story-info">
                <div className="story-info-top">
                  <h3>{s.title || 'Campanha sem Título'}</h3>
                  <div className="story-menu">
                    <button className="icon-button light vn-icon-btn" onClick={() => setMenu(menu === s.id ? null : s.id)} aria-label="Mais opções">
                      <MoreHorizontal size={16} />
                    </button>
                    {menu === s.id && (
                      <div className="story-menu-pop vn-menu-pop">
                        <button onClick={() => { setMenu(null); if (confirm('Excluir esta história para sempre? Isso apaga personagens, mensagens e memórias.')) onDelete(s) }}>
                          <Trash2 size={14} /> Excluir Save
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="vn-tags-row">
                  <span className="story-genre vn-genre-tag">{s.genre || 'Fantasia / RPG'}</span>
                  {s.tone && <span className="vn-tone-tag">{s.tone}</span>}
                </div>
                <span className="story-date vn-date-tag">⏳ {relativeDate(s.last_played_at)}</span>
                <button className="primary-button story-continue vn-play-btn" onClick={() => onOpen(s)}>
                  {s.status === 'playing' || s.status === 'completed' ? (
                    <><Play size={16} fill="currentColor" /> Jogar Aventura</>
                  ) : (
                    <>Editar Mundo <ArrowRight size={15} /></>
                  )}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
