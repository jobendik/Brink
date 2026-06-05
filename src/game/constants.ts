/**
 * Static configuration tables and lookups: game states, rank thresholds,
 * graze-quality tiers, combo milestones and the daily anomaly signatures.
 */
import type { Rank, Sig, Tier } from '../types'

export const STATE = { MENU: 0, PLAYING: 1, DEAD: 2, PAUSE: 3 } as const

/** Ranks unlock a subtle visual theme (accent hue + trail colour). */
export const RANKS: Rank[] = [
  { min: 0, name: 'DRIFTER', hue: 190, trail: 'c' },
  { min: 1500, name: 'RUNNER', hue: 165, trail: 'c' },
  { min: 5000, name: 'EDGE RIDER', hue: 300, trail: 'm' },
  { min: 12000, name: 'SURGE PILOT', hue: 330, trail: 'm' },
  { min: 24000, name: 'OVERDRIVER', hue: 45, trail: 'g' },
  { min: 45000, name: 'NEON GHOST', hue: 140, trail: 'c' },
  { min: 80000, name: 'SINGULARITY', hue: 275, trail: 'm' },
  { min: 140000, name: 'EVENT HORIZON', hue: 20, trail: 'g' },
]

export function rankFor(s: number): Rank {
  let r = RANKS[0]
  for (const k of RANKS) if (s >= k.min) r = k
  return r
}

export function nextRank(s: number): Rank | null {
  for (const k of RANKS) if (k.min > s) return k
  return null
}

/** Graze quality tiers — closeness 0..1 across the graze band. */
export const GRAZE_TIERS: Tier[] = [
  { name: 'SAFE', min: 0.0, pts: 18, surge: 0.03, mult: 0.05, parts: 4, shake: 0.12, flash: 0.0, col: 'c', pitch: 0, micro: 0, ring: false, big: false },
  { name: 'CLOSE', min: 0.3, pts: 42, surge: 0.06, mult: 0.1, parts: 7, shake: 0.22, flash: 0.06, col: 'c', pitch: 3, micro: 0, ring: false, big: false },
  { name: 'GREAT', min: 0.55, pts: 80, surge: 0.085, mult: 0.16, parts: 11, shake: 0.34, flash: 0.12, col: 'm', pitch: 5, micro: 0, ring: true, big: false },
  { name: 'PERFECT', min: 0.78, pts: 140, surge: 0.125, mult: 0.24, parts: 16, shake: 0.5, flash: 0.22, col: 'm', pitch: 8, micro: 0.045, ring: true, big: true },
  { name: 'INSANE', min: 0.93, pts: 230, surge: 0.165, mult: 0.34, parts: 24, shake: 0.7, flash: 0.34, col: 'g', pitch: 12, micro: 0.075, ring: true, big: true },
]

export function tierFor(close: number): Tier {
  let t = GRAZE_TIERS[0]
  for (const k of GRAZE_TIERS) if (close >= k.min) t = k
  return t
}

export function tierIdx(close: number): number {
  let i = 0
  for (let k = 0; k < GRAZE_TIERS.length; k++) if (close >= GRAZE_TIERS[k].min) i = k
  return i
}

export const COMBO_MILES = [5, 10, 25, 50, 100, 200]
export const SHIELD_COMBO = 12

/** Daily anomaly signatures (deterministic per day). */
export const SIGS: Sig[] = [
  { name: 'SPIRAL STORM', bias: 'spiral' },
  { name: 'NEEDLE GATES', bias: 'narrow' },
  { name: 'DOUBLE GAP DAY', bias: 'double' },
  { name: 'ZIGZAG RUSH', bias: 'zigzag' },
  { name: 'TUNNEL DIVE', bias: 'tunnel' },
  { name: 'JACKPOT FIELDS', bias: 'jackpot' },
  { name: 'PULSE CHAMBER', bias: 'pulse' },
  { name: 'FALSE WALLS', bias: 'fakeout' },
]
