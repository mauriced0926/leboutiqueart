import Hero from '@/components/Hero'
import ProductCard from '@/components/ProductCard'
import { getProducts } from '@/lib/shopify'
import Link from 'next/link'

export const revalidate = 60

export default async function HomePage() {
  let products: Awaited<ReturnType<typeof getProducts>> = []
  try {
    products = await getProducts()
  } catch {
    // Shows placeholder until API is connected
  }

  const featured = products.slice(0, 4)

  return (
    <main>
      {/* Hero */}
      <Hero products={products} />

      {/* Featured Works */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 pt-24 pb-8">
        <div className="flex items-end justify-between mb-12">
          <div>
            <p className="text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted mb-3">Selected Works</p>
            <h2 className="font-serif text-4xl md:text-5xl text-lm-text dark:text-dm-text">New Arrivals</h2>
          </div>
          <Link href="/shop" className="hidden md:inline-block text-[11px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted hover:text-lm-text dark:hover:text-dm-text transition-colors border-b border-current pb-0.5">
            View All
          </Link>
        </div>

        {featured.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          /* Placeholder grid shown before products are added */
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {[1,2,3,4].map((i) => (
              <div key={i} className="block">
                <div className="aspect-square bg-lm-surface dark:bg-dm-surface" />
                <div className="pt-3">
                  <div className="h-2 w-16 bg-lm-border dark:bg-dm-border rounded mb-2" />
                  <div className="h-3 w-32 bg-lm-border dark:bg-dm-border rounded mb-1" />
                  <div className="h-2 w-20 bg-lm-border dark:bg-dm-border rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-10 flex justify-center md:hidden">
          <Link href="/shop" className="border border-lm-text dark:border-dm-text text-lm-text dark:text-dm-text text-[11px] tracking-ultra uppercase px-10 py-3.5 hover:bg-lm-text hover:text-lm-bg dark:hover:bg-dm-text dark:hover:text-dm-bg transition-all duration-300">
            View All Works
          </Link>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16">
        <hr className="border-lm-border dark:border-dm-border" />
      </div>

      {/* Artist bio section */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 pb-24 grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-24 items-center">
        <div>
          <p className="text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted mb-5">The Artist</p>
          <h2 className="font-serif text-4xl md:text-5xl text-lm-text dark:text-dm-text leading-tight mb-8">
            Maicol Diaz
          </h2>
          <blockquote className="font-serif text-xl md:text-2xl text-lm-text dark:text-dm-text leading-relaxed italic mb-8 border-l-2 border-gold pl-6">
            &ldquo;His edgy, artistic lighting techniques sculpt dimension, mood, and presence, bringing subjects to life in a way that feels both cinematic and intentional.&rdquo;
          </blockquote>
          <p className="text-lm-muted dark:text-dm-muted text-sm leading-relaxed mb-5">
            Colombian-born visual artist and commercial photographer based in Miami, New York City, and Los Angeles. Diaz&apos;s work emphasizes bold lighting, cultural influence, and striking visual storytelling.
          </p>
          <p className="text-lm-muted dark:text-dm-muted text-sm leading-relaxed mb-10">
            With a foundation in fine arts, graphic design, photography, and film, his work has attracted major brands including Mastercard, Fendi Casa, Hendrick&apos;s Gin, and Budweiser — alongside portraits of Dwyane Wade, Rick Ross, and Vinnie Jones.
          </p>
          <Link href="/about" className="inline-block border border-lm-text dark:border-dm-text text-lm-text dark:text-dm-text text-[11px] tracking-ultra uppercase px-8 py-3.5 hover:bg-lm-text hover:text-lm-bg dark:hover:bg-dm-text dark:hover:text-dm-bg transition-all duration-300">
            Full Biography
          </Link>
        </div>

        {/* Print quality cards */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { n: '01', title: 'Archival Quality', desc: '100-year color permanence with fade-resistant pigment inks.' },
            { n: '02', title: 'Premium Materials', desc: 'Fine art paper, acrylic glass, Dibond, and canvas substrates.' },
            { n: '03', title: 'Expert Finishing', desc: 'Hand-inspected, gallery-wrapped, and shipped with care.' },
            { n: '04', title: 'Global Delivery', desc: 'Secure packaging. Delivered worldwide to your door.' },
          ].map(({ n, title, desc }, i) => (
            <div key={n} className={`bg-lm-surface dark:bg-dm-surface border border-lm-border dark:border-dm-border p-6 flex flex-col gap-3 ${i % 2 === 1 ? 'mt-6' : ''}`}>
              <span className="font-serif text-2xl text-gold">{n}</span>
              <p className="text-lm-text dark:text-dm-text text-sm font-medium">{title}</p>
              <p className="text-lm-muted dark:text-dm-muted text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Full collection CTA banner */}
      {products.length > 1 && (
        <section className="border-y border-lm-border dark:border-dm-border py-20">
          <div className="max-w-7xl mx-auto px-6 lg:px-12 text-center">
            <p className="text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted mb-4">The Collection</p>
            <h2 className="font-serif text-4xl md:text-6xl text-lm-text dark:text-dm-text mb-10">
              Explore All Works
            </h2>
            <Link href="/shop" className="inline-block bg-lm-text dark:bg-gold text-lm-bg dark:text-dm-bg text-[11px] tracking-ultra uppercase px-12 py-4 hover:bg-gold hover:text-white dark:hover:bg-gold-light transition-colors duration-300">
              Shop All
            </Link>
          </div>
        </section>
      )}
    </main>
  )
}
