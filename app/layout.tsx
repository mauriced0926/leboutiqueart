import type { Metadata } from 'next'
import { Cormorant_Garamond, Inter } from 'next/font/google'
import './globals.css'
import { CartProvider } from '@/components/CartProvider'
import { ThemeProvider } from '@/components/ThemeProvider'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import CartDrawer from '@/components/CartDrawer'
import ChatWidget from '@/components/ChatWidget'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-cormorant',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Le Boutique Art — Fine Art Photography by Maicol Diaz',
  description: 'Original fine art photography by Maicol Diaz. Bold lighting, cultural influence, and striking visual storytelling. Museum-grade prints produced by Whitewall.',
  metadataBase: new URL('https://leboutiqueart.com'),
  openGraph: {
    type: 'website',
    siteName: 'Le Boutique Art',
    locale: 'en_US',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${inter.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <CartProvider>
            <Navbar />
            {children}
            <Footer />
            <CartDrawer />
            <ChatWidget />
          </CartProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
