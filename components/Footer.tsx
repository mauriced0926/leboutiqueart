import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-lm-surface dark:bg-dm-surface border-t border-lm-border dark:border-dm-border mt-32">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16 grid grid-cols-1 md:grid-cols-3 gap-12">

        {/* Brand + bio */}
        <div className="md:col-span-1">
          <p className="font-serif text-xl tracking-widest text-lm-text dark:text-dm-text mb-4">LE BOUTIQUE ART</p>
          <p className="text-lm-muted dark:text-dm-muted text-sm leading-relaxed max-w-xs">
            Original fine art photography by Maicol Diaz — Colombian-born visual artist based in Miami, New York City, and Los Angeles.
          </p>
        </div>

        {/* Navigation */}
        <div>
          <p className="text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted mb-5">Explore</p>
          <div className="flex flex-col gap-3">
            <Link href="/shop" className="text-sm text-lm-text dark:text-dm-text hover:text-gold transition-colors">Shop All Works</Link>
            <Link href="/about" className="text-sm text-lm-text dark:text-dm-text hover:text-gold transition-colors">About the Artist</Link>
            <Link href="/contact" className="text-sm text-lm-text dark:text-dm-text hover:text-gold transition-colors">Contact</Link>
          </div>
        </div>

        {/* Print quality */}
        <div>
          <p className="text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted mb-5">Print Production</p>
          <p className="text-sm text-lm-muted dark:text-dm-muted leading-relaxed">
            All prints are designed by{' '}
            <span className="text-lm-text dark:text-dm-text">Maicol Diaz</span>
            {' '}— archival inks, museum-grade materials, delivered worldwide.
          </p>
        </div>
      </div>

      <div className="border-t border-lm-border dark:border-dm-border">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-lm-muted dark:text-dm-muted text-xs">© {new Date().getFullYear()} Le Boutique Art. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="text-lm-muted dark:text-dm-muted text-xs hover:text-lm-text dark:hover:text-dm-text transition-colors">Privacy</Link>
            <Link href="/terms" className="text-lm-muted dark:text-dm-muted text-xs hover:text-lm-text dark:hover:text-dm-text transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
