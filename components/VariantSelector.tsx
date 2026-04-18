'use client'

import { useState } from 'react'
import type { Product } from '@/lib/types'
import AddToCartButton from './AddToCartButton'

interface VariantSelectorProps {
  product: Product
}

export default function VariantSelector({ product }: VariantSelectorProps) {
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {}
    product.options.forEach((opt) => { defaults[opt.name] = opt.values[0] })
    return defaults
  })

  const selectedVariant = product.variants.find((v) =>
    v.selectedOptions.every((o) => selectedOptions[o.name] === o.value)
  ) ?? product.variants[0]

  return (
    <div className="flex flex-col gap-6">
      {product.options.map((option) => (
        <div key={option.name}>
          <p className="text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted mb-3">{option.name}</p>
          <div className="flex flex-wrap gap-2">
            {option.values.map((value) => {
              const isSelected = selectedOptions[option.name] === value
              return (
                <button
                  key={value}
                  onClick={() => setSelectedOptions((prev) => ({ ...prev, [option.name]: value }))}
                  className={`text-xs px-4 py-2.5 border transition-all duration-300 ${
                    isSelected
                      ? 'border-lm-text dark:border-gold bg-lm-text dark:bg-gold text-lm-bg dark:text-dm-bg'
                      : 'border-lm-border dark:border-dm-border text-lm-muted dark:text-dm-muted hover:border-lm-text dark:hover:border-dm-text hover:text-lm-text dark:hover:text-dm-text'
                  }`}
                >
                  {value}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <AddToCartButton
        variantId={selectedVariant?.id ?? ''}
        availableForSale={selectedVariant?.availableForSale ?? false}
      />
    </div>
  )
}
