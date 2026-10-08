'use client'

import { AuthGate } from '@/components/auth/auth-gate'
import { ToastProvider } from '@/components/ui/toast'
import { AppShell } from '@/components/navigation/app-shell'

export default function Page() {
  return (
    <ToastProvider>
      <AuthGate>
        <AppShell />
      </AuthGate>
    </ToastProvider>
  )
}
