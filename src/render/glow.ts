/**
 * Pre-rendered radial-gradient glow sprites, drawn additively for cheap bloom.
 * Rebuilt on resize so their resolution tracks the viewport.
 */
import type { Col } from '../types'

export function makeGlow(size: number, inner: string): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const x = c.getContext('2d')!
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, inner)
  g.addColorStop(0.35, inner.replace(/[\d.]+\)$/, '0.5)'))
  g.addColorStop(1, 'rgba(0,0,0,0)')
  x.fillStyle = g
  x.fillRect(0, 0, size, size)
  return c
}

// Assigned by rebuildGlows() before the first frame renders.
export let GLOW_W!: HTMLCanvasElement
export let GLOW_C!: HTMLCanvasElement
export let GLOW_M!: HTMLCanvasElement
export let GLOW_G!: HTMLCanvasElement

export function rebuildGlows(size: number): void {
  GLOW_W = makeGlow(size, 'rgba(255,255,255,0.9)')
  GLOW_C = makeGlow(size, 'rgba(56,232,255,0.9)')
  GLOW_M = makeGlow(size, 'rgba(255,60,172,0.9)')
  GLOW_G = makeGlow(size, 'rgba(255,210,60,0.95)')
}

export function glowFor(col: Col): HTMLCanvasElement {
  return col === 'm' ? GLOW_M : col === 'g' ? GLOW_G : col === 'w' ? GLOW_W : GLOW_C
}

export function hueFor(col: Col): number {
  return col === 'm' ? 320 : col === 'g' ? 45 : col === 'w' ? 190 : 190
}
