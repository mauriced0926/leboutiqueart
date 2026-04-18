import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About — Le Boutique Art',
  description: 'Maicol Diaz is a Colombian-born visual artist and commercial photographer based in Miami, New York City, and Los Angeles.',
}

const clients = [
  'Mastercard', 'Booking.com', 'Hendrick\'s Gin', 'Budweiser',
  'Fendi Casa', 'DoorDash', 'Stoli', 'Villa One Tequila',
  'Vice', 'Hypebeast',
]

const subjects = [
  'Dwyane Wade', 'Rick Ross', 'Ty Dolla $ign', 'Trina',
  'August Alsina', 'Austin Mahone', 'Elle Varner',
  'Jake Miller', 'Scott Storch', 'Vinnie Jones', 'Christian Audigier',
]

export default function AboutPage() {
  return (
    <main className="pt-32 pb-24 bg-lm-bg dark:bg-dm-bg">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">

        {/* Header */}
        <div className="mb-20 border-b border-lm-border dark:border-dm-border pb-12">
          <p className="text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted mb-4">The Artist</p>
          <h1 className="font-serif text-5xl md:text-7xl text-lm-text dark:text-dm-text">Maicol Diaz</h1>
          <p className="text-lm-muted dark:text-dm-muted text-sm mt-4">Miami · New York City · Los Angeles</p>
        </div>

        {/* Main bio grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-24 mb-24">

          {/* Quote */}
          <div>
            <blockquote className="font-serif text-2xl md:text-3xl text-lm-text dark:text-dm-text leading-relaxed italic border-l-2 border-gold pl-8 mb-10">
              &ldquo;His edgy, artistic lighting techniques sculpt dimension, mood, and presence — bringing subjects to life in a way that feels both cinematic and intentional.&rdquo;
            </blockquote>
            <Link
              href="/shop"
              className="inline-block border border-lm-text dark:border-dm-text text-lm-text dark:text-dm-text text-[11px] tracking-ultra uppercase px-8 py-3.5 hover:bg-lm-text hover:text-lm-bg dark:hover:bg-dm-text dark:hover:text-dm-bg transition-all duration-300"
            >
              View the Collection
            </Link>
          </div>

          {/* Bio text */}
          <div className="flex flex-col gap-5 text-sm text-lm-muted dark:text-dm-muted leading-relaxed">
            <p>
              Maicol Diaz is a Colombian-born visual artist and commercial photographer whose work is defined by bold lighting, cultural influence, and striking visual storytelling.
            </p>
            <p>
              He spent his early childhood in New York and was raised in Miami, developing a deep appreciation for diverse cultures, perspectives, and creative expression that shapes every frame he creates.
            </p>
            <p>
              Earning a full scholarship to a Visual Arts Honors Conservatory program, Diaz built a strong multidisciplinary foundation in fine arts, graphic design, photography, and film — a breadth of training that gives his work its distinctive layered quality.
            </p>
            <p>
              His approach blends conceptual depth with clean, high-impact commercial appeal. Known for his mastery of lighting techniques that sculpt dimension, mood, and presence, his work balances technical precision with creative edge — imagery that is both cinematic and intentional.
            </p>
          </div>
        </div>

        {/* Divider */}
        <hr className="border-lm-border dark:border-dm-border mb-24" />

        {/* Clients + Subjects grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-24">

          {/* Notable Clients */}
          <div>
            <p className="text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted mb-8">Notable Clients</p>
            <div className="flex flex-wrap gap-3">
              {clients.map((client) => (
                <span
                  key={client}
                  className="text-sm text-lm-text dark:text-dm-text border border-lm-border dark:border-dm-border px-4 py-2"
                >
                  {client}
                </span>
              ))}
            </div>
          </div>

          {/* Notable Subjects */}
          <div>
            <p className="text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted mb-8">Photographed</p>
            <div className="flex flex-wrap gap-3">
              {subjects.map((name) => (
                <span
                  key={name}
                  className="text-sm text-lm-text dark:text-dm-text border border-lm-border dark:border-dm-border px-4 py-2"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Divider */}
        <hr className="border-lm-border dark:border-dm-border mb-24" />

        {/* Disciplines */}
        <div className="mb-24">
          <p className="text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted mb-10">Disciplines</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {['Conceptual', 'Celebrity', 'Portraits', 'Music', 'Models', 'Still Life', 'Fine Art', 'Commercial'].map((d, i) => (
              <div key={d} className={`bg-lm-surface dark:bg-dm-surface border border-lm-border dark:border-dm-border px-6 py-5 ${i % 2 === 1 ? 'mt-4' : ''}`}>
                <span className="font-serif text-lm-text dark:text-dm-text text-base">{d}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="border border-lm-border dark:border-dm-border p-12 md:p-16 text-center">
          <p className="text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted mb-5">Own the Work</p>
          <h2 className="font-serif text-4xl md:text-5xl text-lm-text dark:text-dm-text mb-8">
            Bring a piece of Maicol&apos;s vision into your space.
          </h2>
          <p className="text-lm-muted dark:text-dm-muted text-sm mb-10 max-w-md mx-auto leading-relaxed">
            Museum-grade fine art prints produced by Whitewall. Archival quality. Delivered worldwide.
          </p>
          <Link
            href="/shop"
            className="inline-block bg-lm-text dark:bg-gold text-lm-bg dark:text-dm-bg text-[11px] tracking-ultra uppercase px-12 py-4 hover:bg-gold hover:text-white dark:hover:bg-gold-light transition-colors duration-300"
          >
            Shop the Collection
          </Link>
        </div>

      </div>
    </main>
  )
}
