'use client'

import Link from 'next/link'
import { useCart } from './CartProvider'
import { ShoppingBag, Menu, X, Search } from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import SearchOverlay from './SearchOverlay'
import { useState, useEffect } from 'react'

export default function Navbar() {
  const { cart, openCart } = useCart()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const qty = cart?.totalQuantity ?? 0

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-lm-bg/60 dark:bg-dm-bg/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">

          {/* Left nav — desktop links + mobile theme toggle + mobile search */}
          <div className="flex items-center gap-5 md:gap-8">
            <div className="md:hidden flex items-center gap-4">
              <ThemeToggle />
              <button
                onClick={() => setSearchOpen(true)}
                className="text-lm-text dark:text-dm-text hover:text-gold transition-colors duration-300"
                aria-label="Search"
              >
                <Search size={16} strokeWidth={1.5} />
              </button>
            </div>
            <Link href="/shop" className="hidden md:block text-[11px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted hover:text-lm-text dark:hover:text-dm-text transition-colors duration-300">
              Shop
            </Link>
            <Link href="/collections/the-shape-of-becoming" className="hidden md:block text-[11px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted hover:text-lm-text dark:hover:text-dm-text transition-colors duration-300">
              Collections
            </Link>
            <Link href="/about" className="hidden md:block text-[11px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted hover:text-lm-text dark:hover:text-dm-text transition-colors duration-300">
              About
            </Link>
          </div>

          {/* Logo — centered */}
          <Link href="/" className="absolute left-1/2 -translate-x-1/2 font-serif text-lg md:text-xl tracking-widest text-lm-text dark:text-dm-text hover:text-gold transition-colors duration-400 whitespace-nowrap">
            LE BOUTIQUE ART
          </Link>

          {/* Right actions */}
          <div className="flex items-center gap-5 ml-auto">
            {/* Desktop: Search → ThemeToggle → Cart */}
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden md:flex text-lm-text dark:text-dm-text hover:text-gold transition-colors duration-300"
              aria-label="Search"
            >
              <Search size={16} strokeWidth={1.5} />
            </button>
            <div className="hidden md:block">
              <ThemeToggle />
            </div>
            <button
              onClick={openCart}
              className="relative text-lm-text dark:text-dm-text hover:text-gold transition-colors duration-300"
              aria-label="Open cart"
            >
              <ShoppingBag size={18} strokeWidth={1.5} />
              {qty > 0 && (
                <span className="absolute -top-2 -right-2 bg-lm-text dark:bg-gold text-lm-bg dark:text-dm-bg text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                  {qty > 9 ? '9+' : qty}
                </span>
              )}
            </button>
            <button
              className="md:hidden text-lm-text dark:text-dm-text"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
            </button>
          </div>

        </div>
      </nav>

      {/* Search overlay */}
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}

      {/* Mobile menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-lm-bg dark:bg-dm-bg flex flex-col items-center justify-center gap-10">
          <Link href="/shop" onClick={() => setMenuOpen(false)} className="font-serif text-4xl text-lm-text dark:text-dm-text hover:text-gold transition-colors">Shop</Link>
          <Link href="/collections/the-shape-of-becoming" onClick={() => setMenuOpen(false)} className="font-serif text-4xl text-lm-text dark:text-dm-text hover:text-gold transition-colors">Collections</Link>
          <Link href="/about" onClick={() => setMenuOpen(false)} className="font-serif text-4xl text-lm-text dark:text-dm-text hover:text-gold transition-colors">About</Link>
          <Link href="/contact" onClick={() => setMenuOpen(false)} className="font-serif text-4xl text-lm-text dark:text-dm-text hover:text-gold transition-colors">Contact</Link>
        </div>
      )}
    </>
  )
}
