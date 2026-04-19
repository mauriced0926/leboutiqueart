'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import ProductCard from './ProductCard'
import type { Product } from '@/lib/types'

export default function ShopSearch({ products }: { products: Product[] }) {
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')

  useEffect(() => {
    setQuery(searchParams.get('q') ?? '')
  }, [searchParams])

  const filtered = query.trim()
    ? products.filter((p) =>
        p.title.toLowerCase().includes(query.toLowerCase()) ||
        (p.tags || []).some((t) => t.toLowerCase().includes(query.toLowerCase()))
      )
    : products

  return (
    <>
      {/* Search bar */}
      <div className="relative mb-12 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-lm-muted dark:text-dm-muted pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search works..."
          className="w-full bg-transparent border border-lm-border dark:border-dm-border text-lm-text dark:text-dm-text text-sm pl-9 pr-8 py-2.5 outline-none focus:border-lm-text dark:focus:border-dm-text transition-colors placeholder:text-lm-muted dark:placeholder:text-dm-muted"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-lm-muted dark:text-dm-muted hover:text-lm-text dark:hover:text-dm-text transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Results */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-12">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="py-32 text-center">
          <p className="font-serif text-2xl text-lm-muted dark:text-dm-muted italic mb-2">No results for &ldquo;{query}&rdquo;</p>
          <button onClick={() => setQuery('')} className="text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted hover:text-lm-text dark:hover:text-dm-text transition-colors underline underline-offset-2 mt-2">
            Clear search
          </button>
        </div>
      )}
    </>
  )
}
