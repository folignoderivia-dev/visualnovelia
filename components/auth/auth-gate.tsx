'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { AuthScreen, ConfigMissingScreen } from '@/components/auth/auth-screen'

interface AuthState {
  user: User | null
  signOut: () => Promise<void>
}
const AuthCtx = createContext<AuthState>({ user: null, signOut: async () => {} })
export const useAuth = () => useContext(AuthCtx)

/** Protege tudo que está dentro: sem sessão → tela de login. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) { setReady(true); return }
    supabase.auth.getSession()
      .then(({ data }) => setSession(data.session))
      .catch((e) => console.error('[auth] getSession falhou', e))
      .finally(() => setReady(true))
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!isSupabaseConfigured) return <ConfigMissingScreen />
  if (!ready) return <div className="boot-screen"><div className="brand-mark">A</div></div>
  if (!session || recovery) return <AuthScreen recovery={recovery} onRecovered={() => setRecovery(false)} />

  return (
    <AuthCtx.Provider value={{ user: session.user, signOut: async () => { await supabase.auth.signOut() } }}>
      {children}
    </AuthCtx.Provider>
  )
}
