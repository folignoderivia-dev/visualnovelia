'use client'

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { friendlyError } from '@/lib/errors'

type Mode = 'login' | 'signup' | 'forgot'

export function ConfigMissingScreen() {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="brand-mark auth-mark">A</div>
        <h1>Falta conectar o Supabase</h1>
        <p className="auth-sub">Crie o arquivo <code>.env.local</code> (copie de <code>.env.example</code>) e preencha <code>NEXT_PUBLIC_SUPABASE_URL</code> e <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>. Depois reinicie o servidor. O passo a passo está em <code>SUPABASE_SETUP.md</code>.</p>
      </div>
    </main>
  )
}

export function AuthScreen({ recovery, onRecovered }: { recovery: boolean; onRecovered: () => void }) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(''); setInfo('')
    try { await fn() } catch (e) { setError(friendlyError(e)) } finally { setBusy(false) }
  }

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault()
    run(async () => {
      if (recovery) {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        onRecovered()
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name || undefined }, emailRedirectTo: window.location.origin } })
        if (error) throw error
        if (!data.session) setInfo('Conta criada! Enviamos um link de confirmação para o seu e-mail.')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
        if (error) throw error
        setInfo('Se este e-mail existir, você receberá um link para criar uma nova senha.')
      }
    })
  }

  const google = () => run(async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    if (error) throw error
  })

  const title = recovery ? 'Redefinir Senha' : mode === 'login' ? 'Continuar Aventura' : mode === 'signup' ? 'Criar Novo Personagem' : 'Recuperar Acesso'

  return (
    <main className="auth-page vn-auth-experience">
      <div className="vn-auth-bg-fx" />
      <div className="auth-card vn-crystal-card">
        <div className="vn-card-ornament top-ornament" />
        <div className="brand auth-brand">
          <div className="brand-mark vn-glow-mark">⚔️</div>
          <div>
            <strong>AI VISUAL NOVEL</strong>
            <span>ROLEPLAY & STORY ENGINE</span>
          </div>
        </div>
        <div className="auth-badge-vn">
          {mode === 'login' ? '✦ CARREGAR SAVE ✦' : mode === 'signup' ? '✦ NOVO JOGO ✦' : '✦ RECUPERAÇÃO ✦'}
        </div>
        <h1>{title}</h1>
        <p className="auth-sub">Entre no universo interativo. Tome decisões, molde relacionamentos e decida seu destino.</p>
        <form onSubmit={submit} className="auth-form">
          {mode === 'signup' && !recovery && (
            <label className="field vn-field">
              <span>NOME DO PROTAGONISTA</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Como seu herói será chamado..." autoComplete="nickname" />
            </label>
          )}
          {!recovery && (
            <label className="field vn-field">
              <span>E-MAIL DO JOGADOR</span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="aventureiro@reino.com" autoComplete="email" />
            </label>
          )}
          {mode !== 'forgot' && (
            <label className="field vn-field">
              <span>{recovery ? 'NOVA SENHA' : 'SENHA SECRETA'}</span>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            </label>
          )}
          {error && <div className="auth-msg auth-error" role="alert">{error}</div>}
          {info && <div className="auth-msg auth-info" role="status">{info}</div>}
          <button className="primary-button auth-submit vn-gold-button" disabled={busy}>
            {busy ? 'Carregando…' : recovery ? 'Salvar Nova Senha' : mode === 'login' ? 'Iniciar Campanha' : mode === 'signup' ? 'Começar Aventura' : 'Enviar Link'} <ArrowRight size={16} />
          </button>
        </form>
        {!recovery && mode !== 'forgot' && (
          <>
            <div className="auth-or"><span /> ✧ OU ENTRAR COM ✧ <span /></div>
            <button className="outline-button auth-google vn-outline-button" onClick={google} disabled={busy}>Entrar com Google</button>
          </>
        )}
        {!recovery && (
          <div className="auth-links vn-links">
            {mode === 'login' && (
              <>
                <button onClick={() => setMode('signup')}>Novo Jogo (Criar Conta)</button>
                <button onClick={() => setMode('forgot')}>Esqueci a Senha</button>
              </>
            )}
            {mode !== 'login' && <button onClick={() => { setMode('login'); setError(''); setInfo('') }}>Já Possuo um Save (Entrar)</button>}
          </div>
        )}
        <div className="vn-card-ornament bottom-ornament" />
      </div>
    </main>
  )
}
