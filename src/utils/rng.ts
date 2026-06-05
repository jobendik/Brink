/**
 * Seedable PRNG (mulberry32) and date helpers — used for daily determinism.
 */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function (): number {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seedFromString(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function todayStr(): string {
  const d = new Date()
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate()
}

export function dateOffsetStr(off: number): string {
  const d = new Date()
  d.setDate(d.getDate() + off)
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate()
}
