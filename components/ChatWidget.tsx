'use client'

import { useState, useRef, useEffect } from 'react'
import { X, MessageSquare, Send, Mail } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const WELCOME: Message = {
  role: 'assistant',
  content:
    "Welcome to Le Boutique Art. I'm MUSE — your guide to Maicol Diaz's work and fine art prints. How can I help you today?",
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [transcriptSent, setTranscriptSent] = useState(false)
  const [showEmailPrompt, setShowEmailPrompt] = useState(false)
  const [visitorEmail, setVisitorEmail] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function sendMessage(e?: React.FormEvent) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    const updated: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(updated)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated.filter((m) => m.role !== 'assistant' || m !== WELCOME) }),
      })
      const data = await res.json()
      setMessages([...updated, { role: 'assistant', content: data.reply || 'Sorry, something went wrong.' }])
    } catch {
      setMessages([...updated, { role: 'assistant', content: 'Connection error. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  async function sendTranscript(email?: string) {
    await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'transcript', messages, visitorEmail: email || undefined }),
    })
    setTranscriptSent(true)
    setShowEmailPrompt(false)
  }

  function handleEscalate() {
    if (messages.length <= 1) return
    setShowEmailPrompt(true)
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Open MUSE chat"
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 flex items-center justify-center shadow-lg transition-all duration-300
          ${open
            ? 'bg-lm-text dark:bg-dm-surface border border-lm-border dark:border-dm-border text-lm-bg dark:text-dm-text'
            : 'bg-gold hover:bg-gold-light text-white'
          }`}
      >
        {open ? <X size={20} /> : <MessageSquare size={20} />}
      </button>

      {/* Chat panel */}
      <div
        className={`fixed bottom-24 right-6 z-50 w-[360px] max-w-[calc(100vw-24px)] flex flex-col
          bg-lm-bg dark:bg-dm-bg border border-lm-border dark:border-dm-border shadow-2xl
          transition-all duration-300 origin-bottom-right
          ${open ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}
        style={{ height: '520px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-lm-border dark:border-dm-border">
          <div>
            <p className="text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted">Le Boutique Art</p>
            <p className="font-serif text-base text-lm-text dark:text-dm-text">MUSE</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gold" />
            <span className="text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted">Online</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] px-4 py-3 text-sm leading-relaxed
                  ${m.role === 'user'
                    ? 'bg-lm-text dark:bg-gold text-lm-bg dark:text-dm-bg'
                    : 'bg-lm-surface dark:bg-dm-surface text-lm-text dark:text-dm-text border border-lm-border dark:border-dm-border'
                  }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-lm-surface dark:bg-dm-surface border border-lm-border dark:border-dm-border px-4 py-3">
                <span className="flex gap-1">
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="w-1.5 h-1.5 rounded-full bg-lm-muted dark:bg-dm-muted animate-bounce"
                      style={{ animationDelay: `${d * 0.15}s` }}
                    />
                  ))}
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Email prompt overlay */}
        {showEmailPrompt && (
          <div className="absolute inset-0 bg-lm-bg dark:bg-dm-bg flex flex-col items-center justify-center p-8 gap-5">
            <Mail size={32} className="text-gold" />
            <p className="font-serif text-lg text-lm-text dark:text-dm-text text-center">
              Send this conversation to our team
            </p>
            <p className="text-xs text-lm-muted dark:text-dm-muted text-center">
              A human will follow up at leboutiqueart@gmail.com. Enter your email to receive a copy.
            </p>
            <input
              type="email"
              placeholder="Your email (optional)"
              value={visitorEmail}
              onChange={(e) => setVisitorEmail(e.target.value)}
              className="w-full border border-lm-border dark:border-dm-border bg-transparent px-4 py-2.5 text-sm text-lm-text dark:text-dm-text placeholder:text-lm-muted dark:placeholder:text-dm-muted focus:outline-none focus:border-gold"
            />
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setShowEmailPrompt(false)}
                className="flex-1 border border-lm-border dark:border-dm-border text-lm-muted dark:text-dm-muted text-[10px] tracking-ultra uppercase py-2.5 hover:border-lm-text dark:hover:border-dm-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => sendTranscript(visitorEmail)}
                className="flex-1 bg-gold text-white text-[10px] tracking-ultra uppercase py-2.5 hover:bg-gold-light transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        )}

        {/* Transcript sent banner */}
        {transcriptSent && !showEmailPrompt && (
          <div className="px-4 py-2 bg-lm-surface dark:bg-dm-surface border-t border-lm-border dark:border-dm-border text-center">
            <p className="text-[11px] text-lm-muted dark:text-dm-muted">
              ✓ Transcript sent — our team will be in touch.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-lm-border dark:border-dm-border px-4 py-3">
          {!transcriptSent && (
            <button
              onClick={handleEscalate}
              disabled={messages.length <= 1}
              className="w-full mb-3 text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted hover:text-lm-text dark:hover:text-dm-text transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <Mail size={12} />
              Talk to a human
            </button>
          )}
          <form onSubmit={sendMessage} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about prints, the artist..."
              className="flex-1 bg-lm-surface dark:bg-dm-surface border border-lm-border dark:border-dm-border px-3 py-2.5 text-sm text-lm-text dark:text-dm-text placeholder:text-lm-muted dark:placeholder:text-dm-muted focus:outline-none focus:border-gold transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="bg-gold hover:bg-gold-light text-white px-3.5 py-2.5 transition-colors disabled:opacity-40"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
