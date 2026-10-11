import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Cinzel, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import './extra.css'
import { RegisterSW } from '@/components/navigation/register-sw'

const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
  display: 'swap',
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

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
    <html lang="pt-BR" className={`${cinzel.variable} ${jakarta.variable}`}>
      <body className="antialiased">
        {children}
        <RegisterSW />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
