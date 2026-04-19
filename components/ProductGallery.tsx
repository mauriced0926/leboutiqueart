'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { Product } from '@/lib/types'

export default function ProductGallery({ product }: { product: Product }) {
  const images = product.images.length > 0 ? product.images : (product.featuredImage ? [product.featuredImage] : [])
  const [active, setActive] = useState(0)

  if (images.length === 0) {
    return (
      <div className="aspect-[4/5] bg-lm-surface dark:bg-dm-surface flex items-center justify-center">
        <span className="font-serif text-lm-muted dark:text-dm-muted">No image</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Main image */}
      <div className="relative aspect-[4/5] overflow-hidden bg-lm-surface dark:bg-dm-surface">
        <Image
          src={images[active].url}
          alt={images[active].altText ?? product.title}
          fill
          priority
          className="object-cover object-center transition-opacity duration-300"
          sizes="(max-width: 1024px) 100vw, 55vw"
        />
      </div>

      {/* Thumbnails — bottom row, only shown when multiple images */}
      {images.length > 1 && (
        <div className="flex gap-2">
          {images.slice(0, 8).map((img, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`relative aspect-square overflow-hidden bg-lm-surface dark:bg-dm-surface flex-shrink-0 w-16 transition-all duration-200 ${
                i === active
                  ? 'ring-1 ring-lm-text dark:ring-dm-text opacity-100'
                  : 'opacity-50 hover:opacity-80'
              }`}
            >
              <Image
                src={img.url}
                alt={img.altText ?? `${product.title} ${i + 1}`}
                fill
                className="object-cover object-center"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
