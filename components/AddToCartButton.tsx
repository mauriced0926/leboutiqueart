'use client'

import { useState } from 'react'
import { useCart } from './CartProvider'

interface AddToCartButtonProps {
  variantId: string
  availableForSale: boolean
}

export default function AddToCartButton({ variantId, availableForSale }: AddToCartButtonProps) {
  const { addItem, isLoading } = useCart()
  const [added, setAdded] = useState(false)

  const handleAdd = async () => {
    if (!availableForSale || isLoading) return
    await addItem(variantId, 1)
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  if (!availableForSale) {
    return (
      <button disabled className="w-full border border-lm-border dark:border-dm-border text-lm-muted dark:text-dm-muted text-[11px] tracking-ultra uppercase py-4 cursor-not-allowed">
        Sold Out
      </button>
    )
  }

  return (
    <button
      onClick={handleAdd}
      disabled={isLoading}
      className="w-full bg-lm-text dark:bg-gold text-lm-bg dark:text-dm-bg text-[11px] tracking-ultra uppercase py-4 hover:bg-gold hover:text-white dark:hover:bg-gold-light transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? 'Adding...' : added ? 'Added ✓' : 'Add to Cart'}
    </button>
  )
}
