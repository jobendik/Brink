/**
 * Small shared effect helpers used by both the update loop and run lifecycle.
 * Kept separate to avoid a cycle between update.ts and lifecycle.ts.
 */
import { hsl } from '../utils/math'
import { G } from './state'
import type { Col } from '../types'

export function trimParticles(): void {
  const m = 300
  if (G.particles.length > m) G.particles.splice(0, G.particles.length - m)
}

export function addToast(txt: string, col: Col = 'c'): void {
  G.toasts.push({ txt, col, t: 0, life: 2.0 })
}

export function toastColor(c: Col): string {
  return c === 'm'
    ? hsl(320, 90, 72, 1)
    : c === 'g'
      ? hsl(45, 95, 70, 1)
      : c === 'r'
        ? hsl(355, 90, 66, 1)
        : hsl(190, 90, 72, 1)
}
