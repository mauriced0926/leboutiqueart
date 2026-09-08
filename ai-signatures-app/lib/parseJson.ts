export function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    // Model sometimes wraps JSON in prose or markdown fences — pull out the
    // first balanced {...} block instead.
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) {
      throw new Error(`No JSON object found in response: ${trimmed.slice(0, 200)}`)
    }
    return JSON.parse(trimmed.slice(start, end + 1))
  }
}
