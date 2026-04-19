import { getProduct, getProducts, formatPrice } from '@/lib/shopify'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import AddToCartButton from '@/components/AddToCartButton'
import VariantSelector from '@/components/VariantSelector'
import ShareButtons from '@/components/ShareButtons'
import CollapsibleSection from '@/components/CollapsibleSection'
import ProductGallery from '@/components/ProductGallery'

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
          <ProductGallery product={product} />

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
              <CollapsibleSection label="Description">
                <p className="text-lm-muted dark:text-dm-muted text-sm leading-relaxed">{product.description}</p>
              </CollapsibleSection>
            )}

            {/* Certificate of Authenticity */}
            <CollapsibleSection label="Certificate of Authenticity">
              <div className="flex flex-col gap-3 mb-6">
                {[
                  { label: 'Production', value: 'Designed by Maicol Diaz' },
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
              <p className="text-lm-muted dark:text-dm-muted text-sm leading-relaxed">
                Le Boutique Art stands by the authenticity, security, and genuineness of its prints. All limited edition prints by Maicol Diaz are numbered and signed by the artist. A Certificate of Authenticity for limited edition prints by Maicol Diaz is available upon request.
              </p>
            </CollapsibleSection>

            {/* Shipping Information */}
            <CollapsibleSection label="Shipping Information">
              <div className="flex flex-col gap-4 text-lm-muted dark:text-dm-muted text-sm leading-relaxed">
                <p>
                  Photographs purchased on Le Boutique Art will arrive carefully packed in either reinforced tubes (prints) or flat boxes (prints finished in a frame or acrylic mounting). Larger pieces (30x45 and larger) may arrive in a crate to protect against damage during transit.
                </p>
                <p>
                  Le Boutique Art seeks to ship just the print orders within 7 business days and framed or acrylic mounted orders within 14 business days. Please allow an additional 2–5 days for shipping. If you have any questions on the status of your order, please contact{' '}
                  <a href="mailto:leboutiqueart@gmail.com" className="text-lm-text dark:text-dm-text hover:text-gold transition-colors">
                    leboutiqueart@gmail.com
                  </a>
                </p>
              </div>
            </CollapsibleSection>

            {/* Share */}
            <ShareButtons
              url={`https://leboutiqueart.com/shop/${handle}`}
              title={product.title}
              imageUrl={product.featuredImage?.url}
            />
          </div>
        </div>
      </div>
    </main>
  )
}
