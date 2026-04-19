'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'

export default function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    router.push(`/shop?q=${encodeURIComponent(query.trim())}`)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] bg-lm-bg/95 dark:bg-dm-bg/95 backdrop-blur-sm flex flex-col items-center justify-center px-6">
      <button
        onClick={onClose}
        className="absolute top-5 right-6 lg:right-12 text-lm-muted dark:text-dm-muted hover:text-lm-text dark:hover:text-dm-text transition-colors"
        aria-label="Close search"
      >
        <X size={20} strokeWidth={1.5} />
      </button>

      <p className="text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted mb-6">Search</p>

      <form onSubmit={handleSubmit} className="w-full max-w-xl">
        <div className="relative">
          <Search size={16} className="absolute left-0 top-1/2 -translate-y-1/2 text-lm-muted dark:text-dm-muted pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search works, titles, tags…"
            className="w-full bg-transparent border-b border-lm-border dark:border-dm-border text-lm-text dark:text-dm-text font-serif text-3xl md:text-4xl pl-8 pb-3 outline-none focus:border-lm-text dark:focus:border-dm-text transition-colors placeholder:text-lm-muted dark:placeholder:text-dm-muted"
          />
        </div>
        <button type="submit" className="mt-8 text-[11px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted hover:text-lm-text dark:hover:text-dm-text transition-colors">
          Press Enter to Search →
        </button>
      </form>
    </div>
  )
}
