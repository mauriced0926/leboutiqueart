'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createCart, addToCart, updateCartItem, removeFromCart, getCart } from '@/lib/shopify'
import type { Cart } from '@/lib/types'

interface CartContextValue {
  cart: Cart | null
  isOpen: boolean
  isLoading: boolean
  openCart: () => void
  closeCart: () => void
  addItem: (merchandiseId: string, quantity?: number) => Promise<void>
  updateItem: (lineId: string, quantity: number) => Promise<void>
  removeItem: (lineId: string) => Promise<void>
}

const CartContext = createContext<CartContextValue | null>(null)

const CART_ID_KEY = 'lba_cart_id'

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Load or create cart on mount
  useEffect(() => {
    const initCart = async () => {
      const stored = localStorage.getItem(CART_ID_KEY)
      if (stored) {
        try {
          const existing = await getCart(stored)
          if (existing) {
            setCart(existing)
            return
          }
        } catch {
          // Cart expired or invalid — create a new one
        }
      }
      const fresh = await createCart()
      localStorage.setItem(CART_ID_KEY, fresh.id)
      setCart(fresh)
    }
    initCart()
  }, [])

  const openCart = useCallback(() => setIsOpen(true), [])
  const closeCart = useCallback(() => setIsOpen(false), [])

  const addItem = useCallback(async (merchandiseId: string, quantity = 1) => {
    setIsLoading(true)
    try {
      let cartId = cart?.id
      if (!cartId) {
        const fresh = await createCart()
        localStorage.setItem(CART_ID_KEY, fresh.id)
        cartId = fresh.id
        setCart(fresh)
      }
      const updated = await addToCart(cartId, merchandiseId, quantity)
      setCart(updated)
      setIsOpen(true)
    } finally {
      setIsLoading(false)
    }
  }, [cart])

  const updateItem = useCallback(async (lineId: string, quantity: number) => {
    if (!cart) return
    setIsLoading(true)
    try {
      const updated = await updateCartItem(cart.id, lineId, quantity)
      setCart(updated)
    } finally {
      setIsLoading(false)
    }
  }, [cart])

  const removeItem = useCallback(async (lineId: string) => {
    if (!cart) return
    setIsLoading(true)
    try {
      const updated = await removeFromCart(cart.id, [lineId])
      setCart(updated)
    } finally {
      setIsLoading(false)
    }
  }, [cart])

  return (
    <CartContext.Provider value={{ cart, isOpen, isLoading, openCart, closeCart, addItem, updateItem, removeItem }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
