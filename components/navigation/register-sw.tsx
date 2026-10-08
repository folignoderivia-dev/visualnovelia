'use client'

import { useEffect } from 'react'

/**
 * Registra o service worker (só em produção) e garante atualização:
 * quando sai uma versão nova, o SW antigo é substituído (skipWaiting + claim) e a página recarrega UMA vez.
 */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    let reloaded = false
    const onChange = () => { if (reloaded || !sessionStorage.getItem('sw-had-controller')) return; reloaded = true; location.reload() }
    if (navigator.serviceWorker.controller) sessionStorage.setItem('sw-had-controller', '1')
    navigator.serviceWorker.addEventListener('controllerchange', onChange)
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => { reg.update().catch(() => {}) })
      .catch((e) => console.warn('[pwa] service worker falhou', e))
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onChange)
  }, [])
  return null
}
