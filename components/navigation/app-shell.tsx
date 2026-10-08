'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, CircleHelp, LogOut, Library as LibraryIcon, Menu, Plus, Settings } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-gate'
import { Library, type LibraryStory } from '@/components/story/library'
import { Editor, type SaveState } from '@/components/editor/editor'
import { VisualNovel } from '@/components/visual-novel/visual-novel'
import { useToast } from '@/components/ui/toast'
import * as svc from '@/lib/story/service'
import { friendlyError } from '@/lib/errors'

type Mode = { name: 'library' } | { name: 'editor'; storyId: string } | { name: 'play'; storyId: string; from: 'editor' | 'library' }

const SAVE_LABEL: Record<SaveState, string> = {
  idle: 'Tudo salvo', pending: 'Alterações pendentes…', saving: 'Salvando…', saved: 'Salvo na nuvem', error: 'Erro ao salvar',
}

export function AppShell() {
  const { user, signOut } = useAuth()
  const { notify } = useToast()
  const [mode, setMode] = useState<Mode>({ name: 'library' })
  const [menuOpen, setMenuOpen] = useState(false)
  const [stories, setStories] = useState<LibraryStory[]>([])
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const refresh = useCallback(async () => {
    setLoading(true)
    try { setStories(await svc.listStories()) } catch (e) { notify(friendlyError(e, 'Não foi possível carregar suas histórias.'), 'error') } finally { setLoading(false) }
  }, [notify])

  useEffect(() => { if (mode.name === 'library') refresh() }, [mode.name, refresh])

  async function create() {
    try { const s = await svc.createStory(); setMode({ name: 'editor', storyId: s.id }); setMenuOpen(false) }
    catch (e) { notify(friendlyError(e, 'Não foi possível criar a história.'), 'error') }
  }
  const open = (s: LibraryStory) => setMode(s.status === 'playing' || s.status === 'completed' ? { name: 'play', storyId: s.id, from: 'library' } : { name: 'editor', storyId: s.id })
  async function remove(s: LibraryStory) {
    try { await svc.deleteStory(s.id); setStories((x) => x.filter((y) => y.id !== s.id)); notify('História excluída.') }
    catch (e) { notify(friendlyError(e, 'Não foi possível excluir.'), 'error') }
  }

  if (mode.name === 'play') {
    return <VisualNovel storyId={mode.storyId} onBack={() => setMode(mode.from === 'editor' ? { name: 'editor', storyId: mode.storyId } : { name: 'library' })} />
  }

  const name = (user?.user_metadata?.display_name as string | undefined) || user?.email?.split('@')[0] || 'Usuário'

  return (
    <main className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand"><div className="brand-mark">A</div><div><strong>AI NOVEL</strong><span>STORY STUDIO</span></div></div>
        <nav className="side-nav" aria-label="Navegação principal">
          <button className={mode.name === 'library' ? 'active' : ''} onClick={() => { setMode({ name: 'library' }); setMenuOpen(false) }}><LibraryIcon /> Minhas histórias</button>
          <button onClick={create}><Plus /> Nova história</button>
        </nav>
        <div className="sidebar-bottom">
          <button onClick={() => notify('Precisa de ajuda? Veja o arquivo README.md do projeto.')}><CircleHelp /> Ajuda</button>
          <button onClick={() => notify('Configurações chegarão em breve.')}><Settings /> Configurações</button>
          <button onClick={signOut}><LogOut /> Sair da conta</button>
          <div className="profile"><div className="profile-avatar">{name[0]?.toUpperCase()}</div><div><strong>{name}</strong><span>{user?.email}</span></div></div>
        </div>
      </aside>
      {menuOpen && <div className="sidebar-scrim" onClick={() => setMenuOpen(false)} />}
      <div className="page-content">
        <header className="topbar"><button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Abrir menu"><Menu /></button><div className="breadcrumb"><span>AI NOVEL</span><ChevronRight /><strong>{mode.name === 'library' ? 'Minhas histórias' : 'Criando sua história'}</strong></div>
          <div className="topbar-actions"><span className="save-status"><span className={`status-dot dot-${mode.name === 'editor' ? saveState : 'saved'}`} /> {mode.name === 'editor' ? SAVE_LABEL[saveState] : 'Conectado'}</span></div></header>
        {mode.name === 'library'
          ? <Library stories={stories} loading={loading} onCreate={create} onOpen={open} onDelete={remove} />
          : <Editor key={mode.storyId} storyId={mode.storyId} onExit={() => setMode({ name: 'library' })} onSaveState={setSaveState} onPlay={(id) => setMode({ name: 'play', storyId: id, from: 'editor' })} />}
      </div>
    </main>
  )
}
