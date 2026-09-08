export default function Header() {
  return (
    <header className="mb-12 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-accent" strokeWidth="1.8">
          <circle cx="12" cy="12" r="8.5" stroke="currentColor" />
          <path d="M12 7.5 V12 L15 14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="font-display text-[15px] font-semibold tracking-tight text-text">
          AI Signatures
        </span>
      </div>
      <div className="font-mono text-[11.5px] tracking-wide text-dim">CLAUDE + GEMINI ENSEMBLE</div>
    </header>
  )
}
