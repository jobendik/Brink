/**
 * Canvas context, viewport metrics, safe-area insets and the resize handler.
 * Exported metrics are live bindings — importing modules always see the
 * current value. Also hosts the geometry helpers and low-level draw primitives
 * that depend on those metrics.
 */
import { TAU } from '../utils/math'
import { G } from '../game/state'
import { rebuildGlows } from './glow'

export const cv = document.getElementById('game') as HTMLCanvasElement
export const ctx = cv.getContext('2d')!

export let W = 0
export let H = 0
export let CX = 0
export let CY = 0
export let DPR = 1
export let minDim = 0
export let maxDim = 0
export let scl = 1
export let SAT = 0
export let SAB = 0
export let SAL = 0
export let SAR = 0

export function resize(): void {
  DPR = Math.min(2, window.devicePixelRatio || 1)
  W = window.innerWidth
  H = window.innerHeight
  cv.width = W * DPR
  cv.height = H * DPR
  cv.style.width = W + 'px'
  cv.style.height = H + 'px'
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
  CX = W / 2
  CY = H / 2
  minDim = Math.min(W, H)
  maxDim = Math.max(W, H)
  scl = minDim / 720
  // safe-area insets
  const sa = document.getElementById('sa')!
  const cs = getComputedStyle(sa)
  SAT = parseFloat(cs.paddingTop) || 0
  SAB = parseFloat(cs.paddingBottom) || 0
  SAL = parseFloat(cs.paddingLeft) || 0
  SAR = parseFloat(cs.paddingRight) || 0
  const gs = Math.max(48, Math.round(minDim * 0.18))
  rebuildGlows(gs)
  buildStars()
}

export function buildStars(): void {
  G.stars = []
  const n = Math.round((W * H) / 26000)
  for (let i = 0; i < n; i++)
    G.stars.push({
      a: Math.random() * TAU,
      r: Math.random() * maxDim * 0.7 + 40,
      s: Math.random() * 1.6 + 0.4,
      sp: (Math.random() * 0.06 + 0.01) * (Math.random() < 0.5 ? -1 : 1),
      tw: Math.random() * TAU,
    })
}

window.addEventListener('resize', resize)

/* ---------- geometry (scaled at use) ---------- */
export const PLAYER_R = (): number => minDim * 0.215
export const CORE_R = (): number => minDim * 0.072
export const WALL_TH = (): number => minDim * 0.038
export const SPAWN_R = (): number => maxDim * 0.92 + 60
export const GRAZE_BAND = (): number => 0.17
export const MAX_ROT = (): number => 5.0

/* ---------- draw primitives ---------- */
export function drawSprite(
  img: HTMLCanvasElement | null,
  x: number,
  y: number,
  size: number,
  alpha: number,
): void {
  if (!img) return
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha))
  ctx.drawImage(img, x - size / 2, y - size / 2, size, size)
  ctx.globalAlpha = 1
}

export function roundRect(x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
