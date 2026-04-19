import ShopSearch from '@/components/ShopSearch'
import { getProducts } from '@/lib/shopify'

export const revalidate = 60

export const metadata = {
  title: 'Shop — Le Boutique Art',
  description: 'Browse original fine art photography by Maicol Diaz. Museum-grade prints produced by Whitewall.',
}

export default async function ShopPage() {
  let products: Awaited<ReturnType<typeof getProducts>> = []
  try {
    products = await getProducts()
  } catch {
    // Empty state shown below
  }

  return (
    <main className="pt-32 pb-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">

        {/* Header */}
        <div className="mb-16 border-b border-lm-border dark:border-dm-border pb-8">
          <p className="text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted mb-4">Maicol Diaz</p>
          <div className="flex items-end justify-between">
            <h1 className="font-serif text-5xl md:text-6xl text-lm-text dark:text-dm-text">All Works</h1>
            {products.length > 0 && (
              <p className="text-lm-muted dark:text-dm-muted text-sm pb-2">
                {products.length} {products.length === 1 ? 'piece' : 'pieces'}
              </p>
            )}
          </div>
        </div>

        {/* Search + Grid */}
        {products.length > 0 ? (
          <ShopSearch products={products} />
        ) : (
          <div className="flex flex-col items-center justify-center py-40 text-center">
            <p className="font-serif text-4xl text-lm-text dark:text-dm-text mb-4">Coming Soon</p>
            <p className="text-lm-muted dark:text-dm-muted text-sm max-w-sm">
              The collection is being prepared. Check back soon.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
