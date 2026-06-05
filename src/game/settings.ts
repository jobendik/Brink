/**
 * Player settings: accessibility (reduced motion) and haptics. Persisted via
 * the same Store shim as scores. Reduced motion defaults on when the OS-level
 * `prefers-reduced-motion` is set.
 */
import { Store } from '../utils/store'

export const Settings = {
  reducedMotion: false,
  haptics: true,
}

/** Multipliers applied to flashy camera fx when reduced motion is on. */
export const fxScale = {
  get shake(): number {
    return Settings.reducedMotion ? 0.18 : 1
  },
  get flash(): number {
    return Settings.reducedMotion ? 0.16 : 1
  },
  get chroma(): number {
    return Settings.reducedMotion ? 0.22 : 1
  },
  /** Scales how far zoom is allowed to deviate from 1. */
  get zoom(): number {
    return Settings.reducedMotion ? 0.25 : 1
  },
  get vignette(): number {
    return Settings.reducedMotion ? 0.5 : 1
  },
}

export async function hydrateSettings(): Promise<void> {
  // OS-level preference is the default; an explicit stored choice overrides it.
  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      Settings.reducedMotion = true
  } catch (e) {
    /* ignore */
  }
  const rm = await Store.get('brink_reduced')
  if (rm != null) Settings.reducedMotion = rm === '1'
  const hp = await Store.get('brink_haptics')
  if (hp != null) Settings.haptics = hp === '1'
}

export function setReducedMotion(v: boolean): void {
  Settings.reducedMotion = v
  Store.set('brink_reduced', v ? '1' : '0')
}

export function setHaptics(v: boolean): void {
  Settings.haptics = v
  Store.set('brink_haptics', v ? '1' : '0')
}
