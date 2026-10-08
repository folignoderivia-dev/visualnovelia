import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import './extra.css'
import { RegisterSW } from '@/components/navigation/register-sw'

export const metadata: Metadata = {
  title: 'AI Novel Creator',
  description: 'Crie mundos. Dê vida aos personagens. Viva a história.',
  applicationName: 'AI Novel Creator',
  appleWebApp: { capable: true, title: 'AI Novel', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#202020',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        {children}
        <RegisterSW />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
