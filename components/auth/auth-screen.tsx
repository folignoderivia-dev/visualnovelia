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

  const title = recovery ? 'Crie uma nova senha' : mode === 'login' ? 'Bem-vindo de volta' : mode === 'signup' ? 'Comece sua história' : 'Recuperar senha'

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="brand auth-brand"><div className="brand-mark">A</div><div><strong>AI NOVEL</strong><span>STORY STUDIO</span></div></div>
        <h1>{title}</h1>
        <p className="auth-sub">Crie mundos. Dê vida aos personagens. Viva a história.</p>
        <form onSubmit={submit} className="auth-form">
          {mode === 'signup' && !recovery && <label className="field"><span>Como devemos te chamar?</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" autoComplete="nickname" /></label>}
          {!recovery && <label className="field"><span>E-mail</span><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" autoComplete="email" /></label>}
          {mode !== 'forgot' && <label className="field"><span>{recovery ? 'Nova senha' : 'Senha'}</span><input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo de 6 caracteres" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>}
          {error && <div className="auth-msg auth-error" role="alert">{error}</div>}
          {info && <div className="auth-msg auth-info" role="status">{info}</div>}
          <button className="primary-button auth-submit" disabled={busy}>
            {busy ? 'Aguarde…' : recovery ? 'Salvar nova senha' : mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Enviar link'} <ArrowRight />
          </button>
        </form>
        {!recovery && mode !== 'forgot' && (
          <>
            <div className="auth-or"><span /> ou <span /></div>
            <button className="outline-button auth-google" onClick={google} disabled={busy}>Continuar com Google</button>
          </>
        )}
        {!recovery && (
          <div className="auth-links">
            {mode === 'login' && <><button onClick={() => setMode('signup')}>Criar uma conta</button><button onClick={() => setMode('forgot')}>Esqueci a senha</button></>}
            {mode !== 'login' && <button onClick={() => { setMode('login'); setError(''); setInfo('') }}>Já tenho conta</button>}
          </div>
        )}
      </div>
    </main>
  )
}
