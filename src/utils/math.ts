/**
 * Tiny math / colour helpers shared across the game.
 */

export const TAU = Math.PI * 2

export const clamp = (v: number, a: number, b: number): number =>
  v < a ? a : v > b ? b : v

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/** Smoothstep mapped onto the [a, b] interval. */
export const smooth = (a: number, b: number, x: number): number => {
  x = clamp((x - a) / (b - a), 0, 1)
  return x * x * (3 - 2 * x)
}

/** Shortest absolute distance between two angles. */
export function angDist(a: number, b: number): number {
  let d = Math.abs(a - b) % TAU
  if (d > Math.PI) d = TAU - d
  return d
}

/** Signed shortest delta to rotate `from` towards `target`. */
export function angDelta(target: number, from: number): number {
  return ((target - from + Math.PI) % TAU + TAU) % TAU - Math.PI
}

export function rgba(r: number, g: number, b: number, a: number): string {
  return `rgba(${r | 0},${g | 0},${b | 0},${a})`
}

export function hsl(h: number, s: number, l: number, a = 1): string {
  return `hsla(${h},${s}%,${l}%,${a})`
}
