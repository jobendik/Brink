/**
 * Wall spawning + pattern scheduler (fairness-guaranteed). Difficulty ramps
 * with elapsed time; the daily anomaly biases pattern selection.
 */
import { angDelta, angDist, clamp, lerp, TAU } from '../utils/math'
import { MAX_ROT, minDim, SPAWN_R } from '../render/canvas'
import { G } from './state'
import type { Gap, Pattern, Wall } from '../types'

export function dprog(): number {
  return clamp(G.time / 115, 0, 1)
}
function tutSpeedFactor(): number {
  if (G.mode !== 'tutorial') return 1
  return clamp(G.time / 11, 0.42, 1)
}
function tutGapBonus(): number {
  if (G.mode !== 'tutorial') return 0
  return G.wallCount < 3 ? 0.42 : G.wallCount < 6 ? 0.22 : 0
}
function gapHalfBase(): number {
  return lerp(0.62, 0.34, dprog()) + tutGapBonus()
}
export function spawnInterval(): number {
  return lerp(1.22, 0.5, dprog())
}
export function speedNow(): number {
  const base =
    lerp(0.155, 0.46, dprog()) * minDim + Math.max(0, G.time - 115) * 0.001 * minDim
  const ease = clamp(G.time / 4, 0.62, 1) // gentle first seconds for everyone
  return base * ease * tutSpeedFactor()
}

const lastFlags = { pulse: false, fake: false, jack: false }

function choosePattern(): Pattern {
  const p = dprog()
  const r = G.rng()
  const mk = (name: string, left: number): Pattern => ({
    name,
    left,
    step: 0,
    dir: G.rng() < 0.5 ? -1 : 1,
    base: G.prevCenter,
  })
  // rhythmic breather after sustained intensity
  if (p > 0.28 && G.sinceBreather >= 5 && r < 0.55) {
    G.sinceBreather = 0
    return mk('breather', 2)
  }
  // daily anomaly bias
  if (G.mode === 'daily' && G.sig && G.rng() < 0.45) {
    G.sinceBreather++
    return mk(G.sig.bias, lenFor(G.sig.bias))
  }
  let name: string
  if (p < 0.12) {
    name = r < 0.82 ? 'single' : 'spiral'
  } else if (p < 0.28) {
    name = r < 0.45 ? 'single' : r < 0.72 ? 'spiral' : 'tunnel'
  } else if (p < 0.52) {
    const t = G.rng()
    name = t < 0.24 ? 'spiral' : t < 0.44 ? 'zigzag' : t < 0.62 ? 'double' : t < 0.8 ? 'tunnel' : 'single'
  } else if (p < 0.78) {
    const t = G.rng()
    name =
      t < 0.2 ? 'zigzag' : t < 0.4 ? 'double' : t < 0.58 ? 'narrow' : t < 0.74 ? 'spiral' : t < 0.88 ? 'pulse' : 'jackpot'
  } else {
    const t = G.rng()
    name =
      t < 0.18 ? 'narrow' : t < 0.36 ? 'burst' : t < 0.54 ? 'zigzag' : t < 0.7 ? 'pulse' : t < 0.85 ? 'fakeout' : 'jackpot'
  }
  G.sinceBreather++
  return mk(name, lenFor(name))
}

function lenFor(name: string): number {
  switch (name) {
    case 'tunnel':
      return 6
    case 'jackpot':
      return 5
    case 'spiral':
      return 6
    case 'zigzag':
      return 6
    case 'pulse':
      return 4
    case 'double':
      return 5
    case 'fakeout':
      return 3
    case 'narrow':
      return 4
    case 'breather':
      return 2
    default:
      return 4
  }
}

function makeGaps(): Gap[] {
  const pat = G.pattern
  const reach = MAX_ROT() * spawnInterval() * 0.82
  const wrapClamp = (target: number, prev: number, m: number): number => {
    let d = angDelta(target, prev)
    d = clamp(d, -m, m)
    return prev + d
  }
  let gaps: Gap[] = []
  let hh = gapHalfBase()
  switch (pat.name) {
    case 'breather': {
      hh = Math.max(hh, 0.62)
      const c = wrapClamp(pat.base, G.prevCenter, reach)
      gaps = [{ c, h: hh }]
      G.prevCenter = c
      break
    }
    case 'single': {
      const tgt = G.prevCenter + (G.rng() * 2 - 1) * Math.PI
      const c = wrapClamp(tgt, G.prevCenter, reach)
      gaps = [{ c, h: hh }]
      G.prevCenter = c
      break
    }
    case 'narrow': {
      hh *= 0.72
      const tgt = G.prevCenter + (G.rng() * 2 - 1) * reach
      const c = wrapClamp(tgt, G.prevCenter, reach * 0.9)
      gaps = [{ c, h: hh }]
      G.prevCenter = c
      break
    }
    case 'spiral': {
      const c = G.prevCenter + pat.dir * Math.min(reach * 0.8, hh * 1.5 + 0.25)
      gaps = [{ c, h: hh }]
      G.prevCenter = c
      if (G.rng() < 0.12) pat.dir *= -1
      break
    }
    case 'zigzag': {
      const off = Math.min(reach * 0.85, 0.9)
      const c = pat.step % 2 === 0 ? pat.base + off : pat.base - off
      const cc = wrapClamp(c, G.prevCenter, reach)
      gaps = [{ c: cc, h: hh }]
      G.prevCenter = cc
      break
    }
    case 'double': {
      hh *= 0.82
      const c1 = wrapClamp(G.prevCenter + (G.rng() * 2 - 1) * reach, G.prevCenter, reach)
      const c2 = c1 + Math.PI * (0.6 + G.rng() * 0.6)
      gaps = [
        { c: c1, h: hh },
        { c: ((c2 % TAU) + TAU) % TAU, h: hh },
      ]
      G.prevCenter = c1
      break
    }
    case 'burst': {
      hh *= 0.85
      const tgt = G.prevCenter + (G.rng() * 2 - 1) * reach
      const c = wrapClamp(tgt, G.prevCenter, reach)
      gaps = [{ c, h: hh }]
      G.prevCenter = c
      break
    }
    case 'tunnel': {
      const step = Math.min(reach * 0.6, 0.45)
      const c = G.prevCenter + pat.dir * step
      gaps = [{ c, h: Math.max(hh, 0.44) }]
      G.prevCenter = c
      if (G.rng() < 0.18) pat.dir *= -1
      break
    }
    case 'jackpot': {
      hh *= 0.82
      const jitter = (G.rng() * 2 - 1) * 0.05
      const c = wrapClamp(pat.base + jitter, G.prevCenter, reach)
      gaps = [{ c, h: hh }]
      G.prevCenter = c
      lastFlags.jack = true
      break
    }
    case 'pulse': {
      const tgt = G.prevCenter + (G.rng() * 2 - 1) * reach * 0.8
      const c = wrapClamp(tgt, G.prevCenter, reach)
      gaps = [{ c, h: hh }]
      G.prevCenter = c
      lastFlags.pulse = true
      break
    }
    case 'fakeout': {
      hh = Math.max(hh, 0.5)
      const tgt = G.prevCenter + (G.rng() * 2 - 1) * reach * 0.7
      const c = wrapClamp(tgt, G.prevCenter, reach)
      gaps = [{ c, h: hh }]
      G.prevCenter = c
      lastFlags.fake = true
      break
    }
  }
  pat.step++
  pat.left--
  return gaps
}

export function solidSegs(gaps: Gap[]): Array<[number, number]> {
  const N = 180
  const solid: Array<[number, number]> = []
  let runStart: number | null = null
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * TAU
    let inGap = false
    for (const g of gaps) {
      if (angDist(a, g.c) < g.h) {
        inGap = true
        break
      }
    }
    if (!inGap) {
      if (runStart === null) runStart = a
    } else {
      if (runStart !== null) {
        solid.push([runStart, a])
        runStart = null
      }
    }
  }
  if (runStart !== null) solid.push([runStart, TAU])
  return solid
}

export function spawnWall(): void {
  if (G.pattern.left <= 0) G.pattern = choosePattern()
  lastFlags.pulse = false
  lastFlags.fake = false
  lastFlags.jack = false
  const gaps = makeGaps()
  const p = dprog()
  const hue = lerp(205, 312, p) + (G.rng() * 24 - 12) + G.surge * 30
  const w: Wall = {
    radius: SPAWN_R(),
    gaps,
    hue,
    minEdge: Infinity,
    scored: false,
    dangerSeen: false,
    pulse: lastFlags.pulse,
    fake: lastFlags.fake,
    jack: lastFlags.jack,
    born: G.time,
    phase: G.rng() * TAU,
    segs: [],
  }
  w.segs = solidSegs(gaps)
  G.walls.push(w)
  G.wallCount++
}
