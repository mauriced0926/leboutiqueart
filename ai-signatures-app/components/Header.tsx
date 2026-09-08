export default function Header() {
  return (
    <header className="mb-10 flex items-center justify-between border-b border-border pb-5">
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-good animate-pulse-dot" />
        engine online
      </div>
      <div className="font-mono text-[11px] uppercase tracking-widest text-dim">
        claude + gemini ensemble
      </div>
    </header>
  )
}
