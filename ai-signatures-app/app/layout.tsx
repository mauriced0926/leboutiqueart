import type { Metadata } from 'next'
import { Space_Grotesk, Public_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' })
const publicSans = Public_Sans({ subsets: ['latin'], variable: '--font-body' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'AI Signatures — which model wrote this?',
  description: 'Paste or upload text and get a best-effort, multi-model estimate of which AI generated it.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${publicSans.variable} ${jetbrainsMono.variable} min-h-screen bg-bg font-sans text-text antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
