const EXAMPLES = [
  {
    label: 'Essay-style prose',
    text: `The intersection of technology and creativity has always fascinated me. When we delve into the tapestry of modern innovation, it becomes clear that these tools aren't just utilities — they're extensions of human imagination. Moreover, the seamless integration of AI into creative workflows underscores a paradigm shift in how we approach problem-solving.

It's important to note that this isn't about replacing human creativity, but rather fostering a more holistic approach to ideation. The robust capabilities of these systems allow artists and technologists alike to navigate an increasingly complex landscape with greater ease.`,
  },
  {
    label: 'Casual note',
    text: `hey! just wanted to follow up on the thing from yesterday. i think we're overthinking the layout tbh, the version we had on friday was actually fine, we just need to fix the spacing on mobile. lmk if you want to hop on a call later this week, i'm free after 3 most days.`,
  },
  {
    label: 'Technical explainer',
    text: `A hash table achieves average O(1) lookup by mapping keys to array indices via a hash function. Collisions are handled through chaining (each bucket holds a linked list) or open addressing (probing for the next free slot). Load factor — the ratio of entries to buckets — governs when the table resizes; most implementations rehash once it exceeds roughly 0.7 to keep collision chains short.`,
  },
]

export default function ExampleChips({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="mr-1 font-mono text-[11px] uppercase tracking-widest text-dim">Try:</span>
      {EXAMPLES.map((e) => (
        <button
          key={e.label}
          onClick={() => onPick(e.text)}
          className="rounded-full border border-border px-3 py-1 text-xs text-muted transition-colors hover:border-accent-dim hover:text-accent"
        >
          {e.label}
        </button>
      ))}
    </div>
  )
}
