'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'

type Toast = { id: number; text: string; kind: 'ok' | 'error' }
const ToastCtx = createContext<{ notify: (text: string, kind?: 'ok' | 'error') => void }>({ notify: () => {} })
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const notify = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.slice(-2), { id, text, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000)
  }, [])

  // Aviso discreto de conexão perdida
  const [offline, setOffline] = useState(false)
  useEffect(() => {
    const on = () => setOffline(false), off = () => setOffline(true)
    setOffline(!navigator.onLine)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  return (
    <ToastCtx.Provider value={{ notify }}>
      {children}
      {offline && <div className="offline-banner" role="status">Sem conexão — suas alterações serão salvas quando a internet voltar a funcionar.</div>}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`} role="status">
            {t.kind === 'ok' ? <Check /> : <X />}<span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
