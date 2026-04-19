'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Product } from '@/lib/types'

interface HeroProps {
  products: Product[]
}

// ── Editorial slide configs ────────────────────────────────────────────────

const SLIDE_CONFIGS = [
  {
    id: 'featured',
    category: 'Featured',
    subtitle: 'Selected work',
    shopHref: '/shop',
    keywords: ['featured'],
    soloOnly: true,
  },
  {
    id: 'nature',
    category: 'Nature',
    subtitle: 'The world, beautifully lit',
    shopHref: '/shop',
    keywords: ['nature', 'landscape', 'outdoor', 'botanical'],
  },
  {
    id: 'fashion',
    category: 'Fashion',
    subtitle: 'Style through the lens',
    shopHref: '/shop',
    keywords: ['fashion', 'model', 'editorial', 'style'],
  },
  {
    id: 'abstract',
    category: 'Abstract',
    subtitle: 'Form, light & imagination',
    shopHref: '/shop',
    keywords: ['abstract', 'conceptual', 'fine art'],
  },
  {
    id: 'still-life',
    category: 'Still Life',
    subtitle: 'Objects in perfect light',
    shopHref: '/shop',
    keywords: ['still life', 'product', 'lifestyle', 'object'],
  },
  {
    id: 'architecture',
    category: 'Architecture',
    subtitle: 'Structure & space',
    shopHref: '/shop',
    keywords: ['architecture', 'building', 'structure', 'urban'],
  },
  {
    id: 'cars',
    category: 'Cars',
    subtitle: 'Power & precision',
    shopHref: '/shop',
    keywords: ['cars', 'automotive', 'vehicle', 'motorsport'],
  },
  {
    id: 'other',
    category: 'Other',
    subtitle: 'Beyond the frame',
    shopHref: '/shop',
    keywords: ['other'],
    landscape: true,
  },
]

interface Slide {
  id: string
  category: string
  subtitle: string
  shopHref: string
  products: Product[]
  landscape?: boolean
  soloOnly?: boolean
}

function buildSlides(products: Product[]): Slide[] {
  const slides: Slide[] = []

  for (const config of SLIDE_CONFIGS) {
    const matched = products.filter((p) => {
      const tags = (p.tags || []).map((t) => t.toLowerCase())
      return config.keywords.some((kw) => tags.some((t) => t.includes(kw)))
    })
    if (matched.length > 0) {
      // Single product — use the product title as the slide name
      const category = matched.length === 1 ? matched[0].title : config.category
      slides.push({ ...config, category, products: matched.slice(0, 4), landscape: (config as any).landscape, soloOnly: (config as any).soloOnly })
    }
  }

  // No tagged products yet — show a single placeholder slide
  if (slides.length === 0) {
    slides.push({
      id: 'collection',
      category: 'The Collection',
      subtitle: 'Fine art prints by Maicol Diaz',
      shopHref: '/shop',
      products: [],
    })
  }

  return slides
}

// ── Shared frame style ─────────────────────────────────────────────────────
// Thin white outline + shadow — visible in dark mode, subtle in light mode
const FRAME = 'border border-white/50 shadow-[0_4px_24px_rgba(0,0,0,0.18)]'

// ── Image layouts ──────────────────────────────────────────────────────────

function ImageLayout({ products, landscape, soloOnly }: { products: Product[]; landscape?: boolean; soloOnly?: boolean }) {
  const all = products.filter((p) => p.featuredImage)
  const imgs = soloOnly ? all.slice(0, 1) : all.slice(0, 4)

  // No products — ghost placeholder frames
  if (imgs.length === 0) {
    return (
      <div className="absolute inset-0 bottom-24 flex items-center justify-center gap-4 px-14">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex-1 border border-white/20 opacity-40" style={{ height: '62%' }} />
        ))}
      </div>
    )
  }

  const Img = ({ p, className }: { p: Product; className: string }) => (
    <div className={`relative overflow-hidden flex-shrink-0 ${FRAME} ${className}`}>
      <Image
        src={p.featuredImage!.url}
        alt={p.featuredImage!.altText ?? p.title}
        fill className="object-cover object-top"
        sizes="(max-width: 768px) 80vw, 30vw"
        quality={90} draggable={false} priority
      />
    </div>
  )

  // 4 images — framed row: 2 on mobile/tablet, 4 on desktop
  if (imgs.length === 4) {
    return (
      <div className="absolute inset-0 bottom-24 flex items-center justify-center gap-2 lg:gap-3 px-6 lg:px-16">
        <div className="flex gap-2 lg:gap-3 w-full" style={{ height: '68%' }}>
          {imgs.map((p, i) => (
            <div
              key={p.id}
              className={`relative flex-1 overflow-hidden ${FRAME} ${i >= 2 ? 'hidden lg:block' : ''}`}
            >
              <Image
                src={p.featuredImage!.url}
                alt={p.featuredImage!.altText ?? p.title}
                fill className="object-cover object-top"
                sizes="(max-width: 1024px) 50vw, 25vw" quality={90} draggable={false} priority
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // 3 images — show 1 on mobile, all 3 on desktop
  if (imgs.length === 3) {
    return (
      <div className="absolute inset-0 bottom-24 flex items-center justify-center gap-3 px-6 lg:px-14">
        <Img p={imgs[0]} className="h-[60%] lg:h-[64%] aspect-[2/3]" />
        <div className="hidden lg:flex flex-col gap-3 h-[64%]">
          <Img p={imgs[1]} className="flex-1 aspect-[2/3]" />
          <Img p={imgs[2]} className="flex-1 aspect-[2/3]" />
        </div>
      </div>
    )
  }

  // 2 images — show 1 on mobile, staggered duo on desktop
  if (imgs.length === 2) {
    return (
      <div className="absolute inset-0 bottom-24 flex items-center justify-center gap-4 px-6 lg:px-20">
        <Img p={imgs[0]} className="h-[60%] lg:h-[62%] aspect-[2/3] lg:self-start lg:mt-[6%]" />
        <Img p={imgs[1]} className="hidden lg:block h-[52%] aspect-[2/3] self-end mb-[6%]" />
      </div>
    )
  }

  // soloOnly — fills the entire right half, edge to edge
  if (soloOnly) {
    return (
      <div className="absolute right-0 top-0 bottom-24 w-1/2">
        <div className="relative w-full h-full overflow-hidden">
          <Image
            src={imgs[0].featuredImage!.url}
            alt={imgs[0].featuredImage!.altText ?? imgs[0].title}
            fill className="object-cover object-top"
            sizes="50vw" quality={90} draggable={false} priority
          />
        </div>
      </div>
    )
  }

  // 1 image — landscape or portrait frame depending on slide config
  return (
    <div className="absolute inset-0 bottom-24 flex items-center justify-center px-8 lg:px-16">
      <Img
        p={imgs[0]}
        className={landscape
          ? 'w-[80%] lg:w-[65%] aspect-[3/2]'
          : 'h-[60%] md:h-[68%] aspect-[2/3]'}
      />
    </div>
  )
}

// ── Hero ───────────────────────────────────────────────────────────────────

export default function Hero({ products }: HeroProps) {
  const slides = buildSlides(products)
  const [current, setCurrent] = useState(0)
  const [fading, setFading] = useState(false)
  const fadingRef = useRef(false)
  const isDragging = useRef(false)
  const dragStart = useRef<{ x: number; time: number } | null>(null)
  const contentKey = useRef(0)

  const go = useCallback((idx: number) => {
    if (fadingRef.current) return
    fadingRef.current = true
    setFading(true)
    setTimeout(() => {
      contentKey.current += 1
      setCurrent(idx)
      setFading(false)
      fadingRef.current = false
    }, 240)
  }, [])

  const prev = useCallback(
    () => go((current - 1 + slides.length) % slides.length),
    [go, current, slides.length]
  )
  const next = useCallback(
    () => go((current + 1) % slides.length),
    [go, current, slides.length]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next])

  function onPointerDown(e: React.PointerEvent<HTMLElement>) {
    dragStart.current = { x: e.clientX, time: Date.now() }
    isDragging.current = false
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragStart.current) return
    if (Math.abs(e.clientX - dragStart.current.x) > 8) isDragging.current = true
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!dragStart.current) return
    const dx = e.clientX - dragStart.current.x
    const dt = Date.now() - dragStart.current.time
    if (isDragging.current && (Math.abs(dx) > 60 || (Math.abs(dx) > 25 && dt < 400))) {
      if (dx > 0) prev()
      else next()
    }
    dragStart.current = null
    setTimeout(() => { isDragging.current = false }, 50)
  }

  const slide = slides[current]

  return (
    <section
      className={`relative h-screen min-h-[600px] overflow-hidden select-none cursor-grab active:cursor-grabbing transition-colors duration-300
        ${slide.soloOnly ? 'bg-white dark:bg-white' : 'bg-lm-surface dark:bg-dm-bg'}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Images — fade on transition */}
      <div
        key={contentKey.current}
        className={`absolute inset-0 transition-opacity duration-[240ms] hero-slide-in ${fading ? 'opacity-0' : 'opacity-100'}`}
      >
        <ImageLayout products={slide.products} landscape={slide.landscape} soloOnly={slide.soloOnly} />
      </div>

      {/* Text bar — always on clean background, always readable */}
      <div
        className={`absolute bottom-0 inset-x-0 h-24 bg-lm-surface dark:bg-dm-bg z-10
          flex items-center justify-between px-6 lg:px-12
          transition-opacity duration-[240ms] ${fading ? 'opacity-0' : 'opacity-100'}`}
      >
        {/* Left: label + category + CTA */}
        <div className="flex items-center gap-8">
          <div>
            <p className="text-[9px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted mb-0.5">
              {slide.subtitle}
            </p>
            <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-lm-text dark:text-dm-text leading-none">
              {slide.category}
            </h2>
          </div>
          <Link
            href={slide.shopHref}
            onClick={(e) => { if (isDragging.current) e.preventDefault() }}
            className="hidden md:inline-block border border-lm-text dark:border-dm-text text-lm-text dark:text-dm-text text-[10px] tracking-ultra uppercase px-6 py-2.5 hover:bg-lm-text hover:text-lm-bg dark:hover:bg-dm-text dark:hover:text-dm-bg transition-all duration-300 pointer-events-auto flex-shrink-0"
          >
            Shop Now
          </Link>
        </div>

        {/* Right: slide dots + arrows */}
        <div className="flex items-center gap-4 pointer-events-auto">
          {slides.length > 1 && (
            <>
              <div className="flex items-center gap-2">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); go(i) }}
                    className={`transition-all duration-300 ${
                      i === current
                        ? 'w-6 h-[2px] bg-lm-text dark:bg-gold'
                        : 'w-[5px] h-[5px] rounded-full bg-lm-border dark:bg-dm-border hover:bg-lm-muted dark:hover:bg-dm-muted'
                    }`}
                    aria-label={`Slide ${i + 1}`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); prev() }}
                  className="w-8 h-8 flex items-center justify-center text-lm-muted dark:text-dm-muted hover:text-lm-text dark:hover:text-dm-text transition-colors"
                  aria-label="Previous"
                >
                  <ChevronLeft size={20} strokeWidth={1.5} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); next() }}
                  className="w-8 h-8 flex items-center justify-center text-lm-muted dark:text-dm-muted hover:text-lm-text dark:hover:text-dm-text transition-colors"
                  aria-label="Next"
                >
                  <ChevronRight size={20} strokeWidth={1.5} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile Shop Now (appears below category name on small screens) */}
      <div className={`absolute bottom-2 left-6 z-20 md:hidden transition-opacity duration-[240ms] ${fading ? 'opacity-0' : 'opacity-100'}`}>
        <Link
          href={slide.shopHref}
          onClick={(e) => { if (isDragging.current) e.preventDefault() }}
          className="text-[9px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted hover:text-lm-text dark:hover:text-dm-text transition-colors pointer-events-auto underline underline-offset-2"
        >
          Shop Now →
        </Link>
      </div>
    </section>
  )
}
