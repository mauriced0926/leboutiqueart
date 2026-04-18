'use client'

import Link from 'next/link'
import Image from 'next/image'
import { formatPrice } from '@/lib/shopify'
import type { Product } from '@/lib/types'

interface ProductCardProps {
  product: Product
}

export default function ProductCard({ product }: ProductCardProps) {
  const image = product.featuredImage
  const secondImage = product.images[1] ?? null

  return (
    <Link href={`/shop/${product.handle}`} className="group block">
      {/* Square image container */}
      <div className="relative aspect-square overflow-hidden bg-lm-surface dark:bg-dm-surface">
        {image ? (
          <>
            <Image
              src={image.url}
              alt={image.altText ?? product.title}
              fill
              className="object-cover object-center transition-transform duration-600 group-hover:scale-[1.04]"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
            {secondImage && (
              <Image
                src={secondImage.url}
                alt={secondImage.altText ?? product.title}
                fill
                className="object-cover object-center absolute inset-0 opacity-0 transition-opacity duration-600 group-hover:opacity-100"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-serif text-lm-muted dark:text-dm-muted text-sm">No image</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="pt-3">
        <p className="text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted mb-1">
          Maicol Diaz
        </p>
        <h3 className="font-serif text-base text-lm-text dark:text-dm-text group-hover:text-gold transition-colors duration-300 leading-snug">
          {product.title}
        </h3>
        <p className="text-lm-muted dark:text-dm-muted text-sm mt-1">
          {formatPrice(product.price, product.currencyCode)}
        </p>
      </div>
    </Link>
  )
}
