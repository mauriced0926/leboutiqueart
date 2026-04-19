'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

export default function CollapsibleDescription({ description }: { description: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-t border-lm-border dark:border-dm-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-7 text-left group"
      >
        <p className="text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted">Description</p>
        {open
          ? <ChevronUp size={14} className="text-lm-muted dark:text-dm-muted group-hover:text-lm-text dark:group-hover:text-dm-text transition-colors flex-shrink-0" />
          : <ChevronDown size={14} className="text-lm-muted dark:text-dm-muted group-hover:text-lm-text dark:group-hover:text-dm-text transition-colors flex-shrink-0" />
        }
      </button>
      {open && (
        <p className="text-lm-muted dark:text-dm-muted text-sm leading-relaxed pb-7">
          {description}
        </p>
      )}
    </div>
  )
}
