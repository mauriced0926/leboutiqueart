import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Signatures — which model wrote this?',
  description: 'Paste or upload text and get a best-effort, multi-model estimate of which AI generated it.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-text antialiased">{children}</body>
    </html>
  )
}
