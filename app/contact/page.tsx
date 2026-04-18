'use client'

import { useState } from 'react'
import type { Metadata } from 'next'

// Note: metadata can't be exported from a 'use client' component.
// For SEO, move to a server wrapper if needed.

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'contact', ...form }),
      })
      if (!res.ok) throw new Error('Failed')
      setStatus('sent')
      setForm({ name: '', email: '', subject: '', message: '' })
    } catch {
      setStatus('error')
    }
  }

  const inputClass =
    'w-full bg-transparent border border-lm-border dark:border-dm-border px-4 py-3 text-sm text-lm-text dark:text-dm-text placeholder:text-lm-muted dark:placeholder:text-dm-muted focus:outline-none focus:border-gold transition-colors duration-200'

  return (
    <main className="pt-32 pb-24 bg-lm-bg dark:bg-dm-bg">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">

        {/* Header */}
        <div className="mb-20 border-b border-lm-border dark:border-dm-border pb-12">
          <p className="text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted mb-4">Get in Touch</p>
          <h1 className="font-serif text-5xl md:text-7xl text-lm-text dark:text-dm-text">Contact</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-24">

          {/* Left — info */}
          <div>
            <p className="text-sm text-lm-muted dark:text-dm-muted leading-relaxed mb-10">
              Whether you&apos;re interested in purchasing a fine art print, commissioning a shoot, or simply want to
              learn more about the work — we&apos;d love to hear from you.
            </p>

            <div className="flex flex-col gap-6">
              <div>
                <p className="text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted mb-1">Email</p>
                <a
                  href="mailto:leboutiqueart@gmail.com"
                  className="text-sm text-lm-text dark:text-dm-text hover:text-gold dark:hover:text-gold transition-colors"
                >
                  leboutiqueart@gmail.com
                </a>
              </div>
              <div>
                <p className="text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted mb-1">Based In</p>
                <p className="text-sm text-lm-text dark:text-dm-text">Miami · New York City · Los Angeles</p>
              </div>
              <div>
                <p className="text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted mb-1">AI Guide</p>
                <p className="text-sm text-lm-muted dark:text-dm-muted leading-relaxed">
                  Need a quick answer? Click the <span className="text-gold font-medium">MUSE</span> button in the
                  bottom-right corner of the page.
                </p>
              </div>
            </div>
          </div>

          {/* Right — form */}
          <div>
            {status === 'sent' ? (
              <div className="border border-lm-border dark:border-dm-border p-10 text-center">
                <p className="font-serif text-2xl text-lm-text dark:text-dm-text mb-3">Message Sent</p>
                <p className="text-sm text-lm-muted dark:text-dm-muted">
                  Thank you for reaching out. We&apos;ll be in touch shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <input
                    required
                    type="text"
                    placeholder="Your Name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={inputClass}
                  />
                  <input
                    required
                    type="email"
                    placeholder="Email Address"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <input
                  type="text"
                  placeholder="Subject (optional)"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className={inputClass}
                />
                <textarea
                  required
                  rows={6}
                  placeholder="Your message..."
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className={`${inputClass} resize-none`}
                />

                {status === 'error' && (
                  <p className="text-sm text-red-500">Something went wrong. Please try again or email us directly.</p>
                )}

                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="self-start bg-lm-text dark:bg-gold text-lm-bg dark:text-dm-bg text-[11px] tracking-ultra uppercase px-10 py-3.5 hover:bg-gold hover:text-white dark:hover:bg-gold-light transition-colors duration-300 disabled:opacity-50"
                >
                  {status === 'sending' ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
