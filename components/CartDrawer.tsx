'use client'

import Image from 'next/image'
import Link from 'next/link'
import { X, Minus, Plus, ShoppingBag } from 'lucide-react'
import { useCart } from './CartProvider'
import { formatPrice } from '@/lib/shopify'

export default function CartDrawer() {
  const { cart, isOpen, isLoading, closeCart, updateItem, removeItem } = useCart()

  if (!isOpen) return null

  const isEmpty = !cart || cart.items.length === 0

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={closeCart} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-lm-bg dark:bg-dm-bg border-l border-lm-border dark:border-dm-border z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-lm-border dark:border-dm-border">
          <div className="flex items-center gap-3">
            <ShoppingBag size={17} strokeWidth={1.5} className="text-lm-muted dark:text-dm-muted" />
            <span className="font-serif text-lg text-lm-text dark:text-dm-text">Your Cart</span>
            {cart && cart.totalQuantity > 0 && (
              <span className="text-lm-muted dark:text-dm-muted text-sm">({cart.totalQuantity})</span>
            )}
          </div>
          <button onClick={closeCart} className="text-lm-muted dark:text-dm-muted hover:text-lm-text dark:hover:text-dm-text transition-colors">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
              <ShoppingBag size={36} strokeWidth={1} className="text-lm-border dark:text-dm-border" />
              <div>
                <p className="font-serif text-xl text-lm-text dark:text-dm-text mb-2">Your cart is empty</p>
                <p className="text-lm-muted dark:text-dm-muted text-sm">Discover original fine art photography</p>
              </div>
              <button
                onClick={closeCart}
                className="border border-lm-text dark:border-dm-text text-lm-text dark:text-dm-text text-[11px] tracking-ultra uppercase px-8 py-3 hover:bg-lm-text hover:text-lm-bg dark:hover:bg-dm-text dark:hover:text-dm-bg transition-all duration-300"
              >
                Browse Collection
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {cart.items.map((item) => (
                <div key={item.lineId} className="flex gap-4">
                  <Link href={`/shop/${item.handle}`} onClick={closeCart} className="flex-shrink-0">
                    <div className="relative w-20 h-20 bg-lm-surface dark:bg-dm-surface overflow-hidden">
                      {item.image ? (
                        <Image src={item.image.url} alt={item.image.altText ?? item.title} fill className="object-cover" sizes="80px" />
                      ) : (
                        <div className="w-full h-full bg-lm-border dark:bg-dm-border" />
                      )}
                    </div>
                  </Link>

                  <div className="flex-1 min-w-0">
                    <Link href={`/shop/${item.handle}`} onClick={closeCart}>
                      <h4 className="font-serif text-sm text-lm-text dark:text-dm-text hover:text-gold transition-colors leading-snug line-clamp-2">
                        {item.title}
                      </h4>
                    </Link>
                    {item.variantTitle !== 'Default Title' && (
                      <p className="text-lm-muted dark:text-dm-muted text-xs mt-1">{item.variantTitle}</p>
                    )}
                    <p className="text-lm-text dark:text-dm-text text-sm mt-2">
                      {formatPrice(item.price, item.currencyCode)}
                    </p>
                    <div className="flex items-center gap-3 mt-3">
                      <button onClick={() => item.quantity > 1 ? updateItem(item.lineId, item.quantity - 1) : removeItem(item.lineId)} disabled={isLoading} className="text-lm-muted dark:text-dm-muted hover:text-lm-text dark:hover:text-dm-text transition-colors disabled:opacity-40">
                        <Minus size={13} strokeWidth={1.5} />
                      </button>
                      <span className="text-lm-text dark:text-dm-text text-sm w-4 text-center">{item.quantity}</span>
                      <button onClick={() => updateItem(item.lineId, item.quantity + 1)} disabled={isLoading} className="text-lm-muted dark:text-dm-muted hover:text-lm-text dark:hover:text-dm-text transition-colors disabled:opacity-40">
                        <Plus size={13} strokeWidth={1.5} />
                      </button>
                      <button onClick={() => removeItem(item.lineId)} disabled={isLoading} className="ml-auto text-lm-muted dark:text-dm-muted hover:text-lm-text dark:hover:text-dm-text transition-colors disabled:opacity-40">
                        <X size={13} strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!isEmpty && cart && (
          <div className="border-t border-lm-border dark:border-dm-border px-6 py-6">
            <div className="flex justify-between items-center mb-1">
              <span className="text-lm-muted dark:text-dm-muted text-sm">Subtotal</span>
              <span className="text-lm-text dark:text-dm-text text-sm font-medium">{formatPrice(cart.subtotal, cart.currencyCode)}</span>
            </div>
            <p className="text-lm-muted dark:text-dm-muted text-xs mb-5">Shipping calculated at checkout</p>
            <a
              href={cart.checkoutUrl}
              className="block w-full bg-lm-text dark:bg-gold text-lm-bg dark:text-dm-bg text-[11px] tracking-ultra uppercase text-center py-4 hover:bg-gold hover:text-white dark:hover:bg-gold-light transition-colors duration-300 font-medium"
            >
              Checkout
            </a>
          </div>
        )}
      </div>
    </>
  )
}
