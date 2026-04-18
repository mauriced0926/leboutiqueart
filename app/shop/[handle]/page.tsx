import { getProduct, getProducts, formatPrice } from '@/lib/shopify'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import AddToCartButton from '@/components/AddToCartButton'
import VariantSelector from '@/components/VariantSelector'

export const revalidate = 60

export async function generateStaticParams() {
  try {
    const products = await getProducts()
    return products.map((p) => ({ handle: p.handle }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const product = await getProduct(handle)
  if (!product) return {}
  return {
    title: `${product.title} — Le Boutique Art`,
    description: product.description,
    openGraph: {
      images: product.featuredImage ? [{ url: product.featuredImage.url }] : [],
    },
  }
}

export default async function ProductPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const product = await getProduct(handle)
  if (!product) notFound()

  const defaultVariant = product.variants[0]
  const hasMultipleVariants = product.variants.length > 1 && !(product.variants.length === 1 && product.variants[0].title === 'Default Title')

  return (
    <main className="pt-20 bg-lm-bg dark:bg-dm-bg min-h-screen">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-12">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-lm-muted dark:text-dm-muted mb-12">
          <Link href="/" className="hover:text-lm-text dark:hover:text-dm-text transition-colors">Home</Link>
          <span>/</span>
          <Link href="/shop" className="hover:text-lm-text dark:hover:text-dm-text transition-colors">Shop</Link>
          <span>/</span>
          <span className="text-lm-text dark:text-dm-text">{product.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-12 lg:gap-20">

          {/* Images */}
          <div className="flex flex-col gap-3">
            <div className="relative aspect-[4/5] overflow-hidden bg-lm-surface dark:bg-dm-surface">
              {product.featuredImage ? (
                <Image
                  src={product.featuredImage.url}
                  alt={product.featuredImage.altText ?? product.title}
                  fill
                  priority
                  className="object-cover object-center"
                  sizes="(max-width: 1024px) 100vw, 60vw"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-serif text-lm-muted dark:text-dm-muted">No image</span>
                </div>
              )}
            </div>

            {product.images.length > 1 && (
              <div className="grid grid-cols-5 gap-2">
                {product.images.slice(0, 5).map((img, i) => (
                  <div key={i} className="relative aspect-square overflow-hidden bg-lm-surface dark:bg-dm-surface">
                    <Image src={img.url} alt={img.altText ?? `${product.title} ${i + 1}`} fill className="object-cover" sizes="100px" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Product info */}
          <div className="flex flex-col lg:pt-2">
            <p className="text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted mb-3">Maicol Diaz</p>
            <h1 className="font-serif text-4xl md:text-5xl text-lm-text dark:text-dm-text leading-tight mb-5">
              {product.title}
            </h1>
            <p className="text-2xl text-lm-text dark:text-dm-text mb-8">
              {formatPrice(product.price, product.currencyCode)}
            </p>

            {/* Variants or simple Add to Cart */}
            <div className="mb-8">
              {hasMultipleVariants ? (
                <VariantSelector product={product} />
              ) : (
                <AddToCartButton
                  variantId={defaultVariant?.id ?? ''}
                  availableForSale={defaultVariant?.availableForSale ?? false}
                />
              )}
            </div>

            {/* Description */}
            {product.description && (
              <div className="border-t border-lm-border dark:border-dm-border pt-7 mb-7">
                <p className="text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted mb-4">About This Work</p>
                <p className="text-lm-muted dark:text-dm-muted text-sm leading-relaxed">{product.description}</p>
              </div>
            )}

            {/* Print details */}
            <div className="border-t border-lm-border dark:border-dm-border pt-7">
              <p className="text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted mb-5">Print Details</p>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Production', value: 'Produced by Whitewall — world\'s leading fine art lab' },
                  { label: 'Inks', value: 'Archival pigment inks, 100-year color guarantee' },
                  { label: 'Materials', value: 'Fine art paper, acrylic glass, Dibond, canvas' },
                  { label: 'Delivery', value: 'Secure packaging, worldwide shipping' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex gap-5">
                    <span className="text-lm-muted dark:text-dm-muted text-xs w-20 flex-shrink-0 pt-0.5">{label}</span>
                    <span className="text-lm-text dark:text-dm-text text-xs leading-relaxed">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
