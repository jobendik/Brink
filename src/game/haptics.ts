/**
 * Thin wrapper over the Vibration API. Gated by the haptics setting and device
 * capability, so callers can fire patterns freely without guarding.
 */
import { Settings } from './settings'

export const canVibrate =
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

export function vibrate(pattern: number | number[]): void {
  if (!Settings.haptics || !canVibrate) return
  try {
    navigator.vibrate(pattern)
  } catch (e) {
    /* ignore */
  }
}

/** Named patterns for the game's notable moments. */
export const HAPTIC: Record<string, number | number[]> = {
  grazeBig: 8,
  grazeInsane: 14,
  nearMiss: 10,
  milestone: [12, 30, 12],
  shield: [20, 40, 30],
  overdrive: [30, 25, 30, 25, 45],
  overdriveEnd: 16,
  death: [40, 30, 70],
  toggle: 12,
}
