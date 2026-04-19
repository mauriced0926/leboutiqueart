import type { Metadata } from 'next'
import { getProducts } from '@/lib/shopify'
import ProductCard from '@/components/ProductCard'
import Link from 'next/link'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'The Shape of Becoming — Le Boutique Art',
  description: 'A visual progression through identity, tension, and transformation. A collection by Maicol Diaz.',
}

const CHAPTERS = [
  {
    id: 'origin',
    number: '01',
    name: 'Origin',
    subtitle: 'Identity & Obscurity',
    tag: 'origin',
  },
  {
    id: 'fracture',
    number: '02',
    name: 'Fracture',
    subtitle: 'Emotion & Tension',
    tag: 'fracture',
  },
  {
    id: 'release',
    number: '03',
    name: 'Release',
    subtitle: 'Expression & Action',
    tag: 'release',
  },
  {
    id: 'perception',
    number: '04',
    name: 'Perception',
    subtitle: 'Pattern & Flow',
    tag: 'perception',
  },
  {
    id: 'pursuit',
    number: '05',
    name: 'Pursuit',
    subtitle: 'Motion & Identity in Action',
    tag: 'pursuit',
  },
  {
    id: 'arrival',
    number: '06',
    name: 'Arrival',
    subtitle: 'Status & External Form',
    tag: 'arrival',
  },
  {
    id: 'resolution',
    number: '07',
    name: 'Resolution',
    subtitle: 'Balance & Stillness',
    tag: 'resolution',
  },
]

export default async function CollectionPage() {
  let products: Awaited<ReturnType<typeof getProducts>> = []
  try {
    products = await getProducts()
  } catch {
    // show empty state
  }

  return (
    <main className="bg-lm-bg dark:bg-dm-bg">

      {/* ── Hero header ──────────────────────────────────────────────── */}
      <div className="border-b border-lm-border dark:border-dm-border pt-36 pb-20 px-6 lg:px-12 max-w-7xl mx-auto">
        <p className="text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted mb-5">
          A Collection by Maicol Diaz
        </p>
        <h1 className="font-serif text-6xl md:text-8xl lg:text-[9rem] text-lm-text dark:text-dm-text leading-[0.88] mb-16">
          The Shape<br />of Becoming
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-24">
          <p className="text-lm-muted dark:text-dm-muted text-sm leading-relaxed">
            A visual progression through identity, tension, and transformation. Beginning in obscurity, the work moves through emotional fracture and release, into structured perception and driven pursuit — before arriving at states of refinement, legacy, and stillness.
          </p>
          <p className="text-lm-muted dark:text-dm-muted text-sm leading-relaxed">
            Each piece exists as a moment within a larger psychological arc, reflecting the evolving relationship between control, expression, and self-definition. The collection invites the viewer to locate themselves within the journey — somewhere between what is hidden, what is felt, and what ultimately remains.
          </p>
        </div>
      </div>

      {/* ── Chapters ─────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 lg:px-12 pb-32">
        {CHAPTERS.map((chapter, i) => {
          const chapterProducts = products.filter((p) =>
            (p.tags || []).map((t) => t.toLowerCase()).includes(chapter.tag)
          )

          return (
            <div key={chapter.id} className={`py-20 ${i < CHAPTERS.length - 1 ? 'border-b border-lm-border dark:border-dm-border' : ''}`}>

              {/* Chapter header */}
              <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12 gap-4">
                <div>
                  <p className="font-serif text-gold text-xl mb-1">{chapter.number}</p>
                  <h2 className="font-serif text-4xl md:text-5xl text-lm-text dark:text-dm-text uppercase tracking-wide">
                    {chapter.name}
                  </h2>
                  <p className="text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted mt-2">
                    {chapter.subtitle}
                  </p>
                </div>
                {chapterProducts.length > 0 && (
                  <p className="text-lm-muted dark:text-dm-muted text-xs pb-1">
                    {chapterProducts.length} {chapterProducts.length === 1 ? 'piece' : 'pieces'}
                  </p>
                )}
              </div>

              {/* Products or empty state */}
              {chapterProducts.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-12">
                  {chapterProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              ) : (
                <div className="border border-dashed border-lm-border dark:border-dm-border py-16 text-center">
                  <p className="font-serif text-lm-muted dark:text-dm-muted text-lg italic">Coming soon</p>
                  <p className="text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted mt-2 opacity-60">
                    Works being prepared
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Footer CTA ───────────────────────────────────────────────── */}
      <div className="border-t border-lm-border dark:border-dm-border py-20 text-center px-6">
        <p className="text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted mb-4">All Works</p>
        <h3 className="font-serif text-3xl md:text-4xl text-lm-text dark:text-dm-text mb-8">
          Browse the full collection
        </h3>
        <Link
          href="/shop"
          className="inline-block border border-lm-text dark:border-dm-text text-lm-text dark:text-dm-text text-[11px] tracking-ultra uppercase px-10 py-3.5 hover:bg-lm-text hover:text-lm-bg dark:hover:bg-dm-text dark:hover:text-dm-bg transition-all duration-300"
        >
          View All
        </Link>
      </div>

    </main>
  )
}
