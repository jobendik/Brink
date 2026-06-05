/**
 * Per-frame simulation: camera fx decay, particle/ring/pop/toast lifetimes,
 * player rotation, wall motion + collision, grazing, combos, surge/overdrive.
 */
import { clamp, lerp, TAU } from '../utils/math'
import {
  CORE_R,
  CX,
  CY,
  GRAZE_BAND,
  minDim,
  PLAYER_R,
  scl,
  WALL_TH,
} from '../render/canvas'
import { G } from './state'
import { Audio_ } from '../audio/engine'
import { COMBO_MILES, SHIELD_COMBO, STATE, tierFor, tierIdx } from './constants'
import { dprog, speedNow, spawnInterval, spawnWall } from './spawn'
import { addToast, trimParticles } from './fx'
import { tutorialTick } from './tutorial'
import { die } from './lifecycle'
import type { Wall } from '../types'

export function update(dt: number): void {
  G.menuT += dt
  G.beat = (G.beat + dt * (Audio_.bpm / 60)) % 1
  const tgt = G.overdrive > 0 ? 0.4 : G.timeScaleTarget
  G.timeScale += (tgt - G.timeScale) * Math.min(1, dt * 9)
  if (G.state === STATE.DEAD) G.timeScaleTarget = 0.25
  if (G.hitstop > 0) G.hitstop -= dt
  const real = dt
  const sdt = G.hitstop > 0 ? 0 : dt * G.timeScale

  // fx decay (real time)
  G.shake = Math.max(0, G.shake - real * 2.4)
  G.flash = Math.max(0, G.flash - real * 3.2)
  G.comboFlash = Math.max(0, G.comboFlash - real * 2.2)
  G.heartPulse = Math.max(0, G.heartPulse - real * 3.5)
  G.touchFlash = Math.max(0, G.touchFlash - real * 4)
  G.vignette = lerp(G.vignette, G.overdrive > 0 ? 0.0 : G.danger * 0.6, Math.min(1, real * 7))
  G.chroma = lerp(G.chroma, G.overdrive > 0 ? 7 : G.surge * 3.5 + G.danger * 3, Math.min(1, real * 5))
  G.zoom = lerp(
    G.zoom,
    (G.overdrive > 0 ? 1.06 : 1) * (G.state === STATE.DEAD ? 0.97 : 1) + G.heartPulse * 0.012,
    Math.min(1, real * 4),
  )

  for (const s of G.stars) {
    s.a += s.sp * sdt
    s.tw += real * 3
  }
  G.dispScore += (G.score - G.dispScore) * Math.min(1, real * (G.state === STATE.DEAD ? 5 : 14))

  // particles / pops / rings / toasts
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i]
    p.t += real
    p.x += p.vx * real
    p.y += p.vy * real
    const dr = Math.exp(-(p.drag || 3) * real)
    p.vx *= dr
    p.vy *= dr
    if (p.t >= p.life) G.particles.splice(i, 1)
  }
  for (let i = G.pops.length - 1; i >= 0; i--) {
    const p = G.pops[i]
    p.t += real
    p.y -= real * 26
    if (p.t >= p.life) G.pops.splice(i, 1)
  }
  for (let i = G.rings.length - 1; i >= 0; i--) {
    const r = G.rings[i]
    r.t += real
    r.r += r.v * real
    if (r.t >= r.life) G.rings.splice(i, 1)
  }
  for (let i = G.toasts.length - 1; i >= 0; i--) {
    const tt = G.toasts[i]
    tt.t += real
    if (tt.t >= tt.life) G.toasts.splice(i, 1)
  }

  if (G.state === STATE.PLAYING) updatePlay(sdt, real)
  if (G.state === STATE.DEAD) G.deadT += real
}

function updatePlay(sdt: number, real: number): void {
  G.time += sdt
  if (G.invulnT > 0) G.invulnT -= real

  // overdrive timer
  if (G.overdrive > 0) {
    G.overdrive -= real
    G.surge = Math.max(0, G.surge - real / G.odMax)
    if (G.overdrive <= 0 || G.surge <= 0) {
      G.overdrive = 0
      G.flash = Math.max(G.flash, 0.55)
      G.rings.push({ x: CX, y: CY, r: PLAYER_R(), v: -700 * scl, life: 0.5, t: 0, col: 'g', w: 5 })
      addToast('SURGE SPENT', 'g')
      Audio_.overdriveEnd()
    }
  } else {
    G.surge = Math.max(0, G.surge - real * 0.055)
  }

  // surge-ready announce (once per run)
  if (G.surge >= 1 && G.overdrive <= 0 && !G.surgeReadyToasted) {
    G.surgeReadyToasted = true
    addToast('SURGE FIELD READY', 'm')
  }
  if (G.surge < 0.6) G.surgeReadyToasted = false

  // player rotation (analog accel)
  const maxv = MAX_ROT_FACTOR()
  const accel = 26
  if (G.dir !== 0) {
    G.pv += G.dir * accel * sdt
  } else {
    G.pv *= Math.exp(-12 * sdt)
    if (Math.abs(G.pv) < 0.02) G.pv = 0
  }
  G.pv = clamp(G.pv, -maxv, maxv)
  G.pa += G.pv * sdt
  if (G.pa < 0) G.pa += TAU
  if (G.pa >= TAU) G.pa -= TAU

  // spawn
  G.currentSpeed = speedNow()
  G.spawnT -= sdt
  const interval =
    spawnInterval() *
    (G.pattern.name === 'burst'
      ? 0.55
      : G.pattern.name === 'breather'
        ? 1.7
        : G.pattern.name === 'jackpot'
          ? 0.7
          : 1)
  if (G.spawnT <= 0) {
    spawnWall()
    G.spawnT += interval
  }

  // walls: move, collide, graze, danger, near-miss, burn-through
  const Rp = PLAYER_R()
  const th = WALL_TH()
  const band = th / 2
  let inst = 0 // instantaneous danger this frame
  for (let i = G.walls.length - 1; i >= 0; i--) {
    const w = G.walls[i]
    w.radius -= G.currentSpeed * sdt
    const dr = w.radius - Rp
    const adr = Math.abs(dr)

    // in-gap test
    let inGap = false
    let edge = Infinity
    for (const g of w.gaps) {
      const ad = Math.abs(((G.pa - g.c + Math.PI) % TAU + TAU) % TAU - Math.PI)
      if (ad < g.h) {
        inGap = true
        edge = Math.min(edge, g.h - ad)
      }
    }

    // danger sampling: solid wall closing on the player's heading
    if (dr > 0 && adr < minDim * 0.16 && !inGap) {
      inst = Math.max(inst, 1 - adr / (minDim * 0.16))
    }
    // near-miss arming: very close + on a solid
    if (adr < band * 1.4 && !inGap) w.dangerSeen = true

    const within = adr <= band
    if (within && !inGap) {
      if (G.overdrive > 0) {
        burnWall(w, i)
        continue
      } // OD: burn through danger
      else if (G.invulnT > 0) {
        /* phasing after shield */
      } else if (G.shieldArmed) {
        consumeShield(w, i)
        continue
      } // combo shield saves one hit
      else {
        die()
        return
      }
    } else if (within && inGap) {
      w.minEdge = Math.min(w.minEdge, edge)
    }

    // finalize once passed inward
    if (!w.scored && w.radius + band < Rp) {
      w.scored = true
      let didGraze = false
      if (w.minEdge < GRAZE_BAND()) {
        const close = clamp(1 - w.minEdge / GRAZE_BAND(), 0, 1)
        registerGraze(close, w)
        didGraze = true
      }
      if (w.dangerSeen && G.invulnT <= 0) {
        nearMiss()
      }
      if (!didGraze && !w.dangerSeen && G.combo > 0) {
        /* clean non-graze pass keeps combo timer ticking */
      }
    }
    if (w.radius < CORE_R() * 0.35) G.walls.splice(i, 1)
  }
  // smooth danger + heartbeat
  G.danger = lerp(G.danger, inst, Math.min(1, real * (inst > G.danger ? 12 : 5)))
  G.heartT += real
  if (G.danger > 0.42) {
    const interval = lerp(0.62, 0.28, clamp(G.danger, 0, 1))
    if (G.heartT >= interval) {
      G.heartT = 0
      Audio_.heart(clamp(G.danger, 0.3, 1))
      G.heartPulse = 1
    }
  }

  // multiplier + combo decay
  G.grazeTimer += real
  if (G.grazeTimer > 2.5 && G.combo > 0) {
    G.combo = 0
    G.nextMileIdx = 0
  }
  if (G.grazeTimer > 0.25) {
    G.mult = Math.max(1, G.mult - real * 0.55)
  }

  // combo shield arm/disarm (earned, re-earned)
  if (G.combo >= SHIELD_COMBO && !G.shieldClimb) {
    G.shieldClimb = true
    G.shieldArmed = true
    addToast('COMBO SHIELD', 'c')
  }
  if (G.combo === 0) {
    G.shieldClimb = false
  }

  // survival trickle (grazing is the real engine; OD vacuums faster)
  G.score += sdt * (8 + dprog() * 22) * G.mult * (G.overdrive > 0 ? 2.0 : 1)
  if (G.overdrive > 0) {
    G.mult = Math.min(16, G.mult + real * 0.6)
  } // OD combo acceleration

  // tutorial coaching
  if (G.tut) tutorialTick(real)

  Audio_.bpm = 132 + Math.round(dprog() * 14) + (G.overdrive > 0 ? 8 : 0)
}

/** Max angular velocity for this frame (slower during overdrive). */
function MAX_ROT_FACTOR(): number {
  return 5.0 * (G.overdrive > 0 ? 0.85 : 1)
}

function registerGraze(close: number, _w: Wall): void {
  const T = tierFor(close)
  const idx = tierIdx(close)
  const odMul = G.overdrive > 0 ? 2 : 1
  G.combo++
  if (G.combo > G.bestCombo) G.bestCombo = G.combo
  G.grazeTimer = 0
  G.grazeCount++
  if (idx >= 3) G.perfectCount++
  if (idx >= 4) G.insaneCount++
  if (idx > G.topTierIdx) G.topTierIdx = idx
  G.mult = Math.min(16, G.mult + T.mult)
  if (G.overdrive <= 0) G.surge = Math.min(1, G.surge + T.surge)
  const pts = Math.round(T.pts * G.mult * odMul)
  G.score += pts

  // fx
  const Rp = PLAYER_R()
  const gx = CX + Math.cos(G.pa) * Rp
  const gy = CY + Math.sin(G.pa) * Rp
  const n = T.parts
  for (let i = 0; i < n; i++) {
    const a = G.pa + (Math.PI / 2) * (Math.random() < 0.5 ? 1 : -1) + (Math.random() - 0.5) * 1.2
    const sp = (Math.random() * 6 + 3) * scl * 60 * (0.6 + close)
    G.particles.push({
      x: gx,
      y: gy,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.4 + Math.random() * 0.45,
      t: 0,
      r: Math.random() * 2.6 + 1.2,
      col: T.col,
      drag: 3.5,
    })
  }
  if (T.ring)
    G.rings.push({ x: gx, y: gy, r: 6, v: (140 + close * 240) * scl, life: 0.45, t: 0, col: T.col, w: 2 + close * 3.5 })
  G.pops.push({
    x: gx,
    y: gy,
    t: 0,
    life: 0.75,
    txt: (T.big ? T.name + '  ' : '') + '+' + pts,
    big: T.big,
    col: T.col,
  })
  G.shake = Math.min(2.2, G.shake + T.shake)
  if (T.flash > 0) G.flash = Math.max(G.flash, T.flash)
  if (T.micro > 0) {
    G.hitstop = Math.max(G.hitstop, T.micro)
    G.comboFlash = 1
  }
  Audio_.graze(G.combo, T.pitch)

  checkMilestones()
}

function checkMilestones(): void {
  while (G.nextMileIdx < COMBO_MILES.length && G.combo >= COMBO_MILES[G.nextMileIdx]) {
    const m = COMBO_MILES[G.nextMileIdx]
    G.nextMileIdx++
    G.pops.push({ x: CX, y: CY - PLAYER_R() * 0.5, t: 0, life: 1.0, txt: m + ' CHAIN!', big: true, col: 'g' })
    G.rings.push({ x: CX, y: CY, r: CORE_R() * 1.4, v: 520 * scl, life: 0.6, t: 0, col: 'g', w: 4 })
    G.flash = Math.max(G.flash, 0.22)
    G.comboFlash = 1
    G.shake = Math.min(2.2, G.shake + 0.5)
    Audio_.flourish(Math.min(3, G.nextMileIdx))
  }
}

function nearMiss(): void {
  G.nearMiss++
  const Rp = PLAYER_R()
  const gx = CX + Math.cos(G.pa) * Rp
  const gy = CY + Math.sin(G.pa) * Rp
  const bonus = Math.round(60 * G.mult * (G.overdrive > 0 ? 2 : 1))
  G.score += bonus
  G.pops.push({ x: gx, y: gy - minDim * 0.04, t: 0, life: 0.85, txt: 'NEAR MISS +' + bonus, big: true, col: 'm' })
  G.rings.push({ x: gx, y: gy, r: 8, v: 300 * scl, life: 0.5, t: 0, col: 'm', w: 3 })
  G.hitstop = Math.max(G.hitstop, 0.05)
  G.flash = Math.max(G.flash, 0.2)
  addToast('EDGE BREACH', 'm')
  Audio_.nearmiss()
}

function consumeShield(_w: Wall, i: number): void {
  G.shieldArmed = false
  G.invulnT = 0.7
  G.combo = 0
  G.nextMileIdx = 0
  G.flash = 1
  G.shake = Math.min(2.2, G.shake + 1.0)
  G.hitstop = 0.06
  const Rp = PLAYER_R()
  const px = CX + Math.cos(G.pa) * Rp
  const py = CY + Math.sin(G.pa) * Rp
  for (let k = 0; k < 30; k++) {
    const a = Math.random() * TAU
    const sp = (Math.random() * 8 + 3) * scl * 60
    G.particles.push({
      x: px,
      y: py,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.5 + Math.random() * 0.4,
      t: 0,
      r: Math.random() * 2.6 + 1.4,
      col: 'c',
      drag: 3,
    })
  }
  G.rings.push({ x: px, y: py, r: 10, v: 420 * scl, life: 0.55, t: 0, col: 'c', w: 4 })
  G.pops.push({ x: px, y: py, t: 0, life: 0.9, txt: 'SHIELD!', big: true, col: 'c' })
  Audio_.shield()
  G.walls.splice(i, 1)
  trimParticles()
}

function burnWall(_w: Wall, i: number): void {
  const Rp = PLAYER_R()
  const px = CX + Math.cos(G.pa) * Rp
  const py = CY + Math.sin(G.pa) * Rp
  const pts = Math.round(50 * G.mult * 2)
  G.score += pts
  for (let k = 0; k < 16; k++) {
    const a = Math.random() * TAU
    const sp = (Math.random() * 7 + 3) * scl * 60
    G.particles.push({
      x: px,
      y: py,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.35 + Math.random() * 0.4,
      t: 0,
      r: Math.random() * 2.4 + 1.2,
      col: Math.random() < 0.5 ? 'g' : 'm',
      drag: 3.2,
    })
  }
  G.rings.push({ x: CX, y: CY, r: _w.radius, v: 240 * scl, life: 0.4, t: 0, col: 'g', w: 3 })
  G.shake = Math.min(2.2, G.shake + 0.25)
  if (Math.random() < 0.4)
    G.pops.push({ x: px, y: py, t: 0, life: 0.6, txt: 'BURN +' + pts, big: false, col: 'g' })
  G.walls.splice(i, 1)
  trimParticles()
}

export function triggerOverdrive(): void {
  if (G.state !== STATE.PLAYING || G.surge < 1 || G.overdrive > 0) return
  G.overdrive = G.odMax
  G.odUsed++
  G.shake = Math.min(2.4, G.shake + 1.3)
  G.flash = 1
  G.hitstop = 0.07
  G.zoom = 1.09
  for (let i = 0; i < 72; i++) {
    const a = Math.random() * TAU
    const sp = (Math.random() * 10 + 4) * scl * 60
    G.particles.push({
      x: CX,
      y: CY,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.6 + Math.random() * 0.7,
      t: 0,
      r: Math.random() * 3 + 1.5,
      col: Math.random() < 0.5 ? 'g' : 'm',
      drag: 2.2,
    })
  }
  G.rings.push({ x: CX, y: CY, r: CORE_R(), v: 920 * scl, life: 0.7, t: 0, col: 'm', w: 6 })
  G.rings.push({ x: CX, y: CY, r: CORE_R(), v: 620 * scl, life: 0.8, t: 0, col: 'g', w: 4 })
  G.pops.push({ x: CX, y: CY - PLAYER_R() * 0.4, t: 0, life: 1.0, txt: 'OVERDRIVE', big: true, od: true, col: 'g' })
  trimParticles()
  Audio_.overdriveStart()
}
