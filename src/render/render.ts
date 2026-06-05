/**
 * All drawing. A single render() composites the scene each frame: background,
 * walls, core, player, particles, fx overlays, HUD and the menu/dead/pause
 * screens. Button hit-rects are exported for the input layer.
 */
import { angDelta, clamp, hsl, lerp, rgba, TAU } from '../utils/math'
import { seedFromString, todayStr } from '../utils/rng'
import {
  CORE_R,
  CX,
  CY,
  ctx,
  DPR,
  drawSprite,
  H,
  maxDim,
  minDim,
  PLAYER_R,
  roundRect,
  SAB,
  SAL,
  SAR,
  SAT,
  scl,
  W,
  WALL_TH,
} from './canvas'
import { GLOW_C, GLOW_G, GLOW_M, GLOW_W, glowFor, hueFor } from './glow'
import { G } from '../game/state'
import { Audio_ } from '../audio/engine'
import { GRAZE_TIERS, nextRank, rankFor, SIGS, STATE } from '../game/constants'
import { dprog } from '../game/spawn'
import { toastColor } from '../game/fx'
import { fxScale, Settings } from '../game/settings'
import { canVibrate } from '../game/haptics'
import { isTouch } from '../platform'
import type { ButtonRect, CircleRect, Wall } from '../types'

export function render(): void {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
  // palette-shifted base
  const baseHue = lerp(212, 316, dprog())
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = hsl(baseHue, 60, 4, 1)
  ctx.fillRect(0, 0, W, H)

  const sh = G.shake * fxScale.shake
  const ox = (Math.random() - 0.5) * sh * minDim * 0.012
  const oy = (Math.random() - 0.5) * sh * minDim * 0.012
  ctx.save()
  ctx.translate(CX, CY)
  ctx.scale(G.zoom, G.zoom)
  ctx.translate(-CX + ox, -CY + oy)

  drawBackground(baseHue)
  drawWalls()
  drawCore()
  drawPlayer()
  drawParticles()
  drawRings()

  ctx.restore()

  if (G.state === STATE.PLAYING) drawTouchHint()
  drawVignette()
  if (G.flash > 0) {
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = rgba(255, 255, 255, G.flash * 0.5 * fxScale.flash)
    ctx.fillRect(0, 0, W, H)
    ctx.globalCompositeOperation = 'source-over'
  }

  if (G.state === STATE.PLAYING || G.state === STATE.DEAD) drawHUD()
  drawPops()
  drawToasts()
  if (G.state === STATE.PLAYING && G.tut && G.tut.prompt) drawTutorialPrompt()
  if (G.state === STATE.MENU) drawMenu()
  if (G.state === STATE.DEAD) drawDead()
  if (G.state === STATE.PAUSE) drawPause()
  if (G.settingsOpen) {
    drawSettings()
  } else {
    drawMuteIcon()
    drawSecondaryIcon()
  }
}

function pulse(amp: number, freq = 1): number {
  return 1 + Math.sin(G.menuT * TAU * freq) * amp
}
function beatPulse(): number {
  return Math.pow(1 - G.beat, 2.2)
}

function drawBackground(baseHue: number): void {
  ctx.globalCompositeOperation = 'lighter'
  const bp = beatPulse()
  for (let k = 1; k <= 6; k++) {
    const r = minDim * 0.09 * k * (1 + bp * 0.012)
    ctx.beginPath()
    ctx.arc(CX, CY, r, 0, TAU)
    ctx.strokeStyle = hsl(baseHue + G.surge * 40, 80, 55, 0.05 + (k === 2 ? bp * 0.06 : 0))
    ctx.lineWidth = 1 * scl
    ctx.stroke()
  }
  for (const s of G.stars) {
    const x = CX + Math.cos(s.a) * s.r
    const y = CY + Math.sin(s.a) * s.r
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(s.tw))
    ctx.fillStyle = hsl(baseHue - 20 + G.surge * 70, 70, 80, 0.5 * tw)
    ctx.fillRect(x, y, s.s * scl, s.s * scl)
  }
  ctx.globalCompositeOperation = 'source-over'
}

function drawWalls(): void {
  const th = WALL_TH()
  const Rp = PLAYER_R()
  ctx.globalCompositeOperation = 'lighter'
  // find nearest incoming wall (for directional cue)
  let near: Wall | null = null
  let nd = 1e9
  for (const w of G.walls) {
    const d = w.radius - Rp
    if (d > th * 0.5 && d < nd) {
      nd = d
      near = w
    }
  }
  for (const w of G.walls) {
    if (w.radius <= 2) continue
    const prox = clamp(1 - Math.abs(w.radius - Rp) / (minDim * 0.3), 0, 1)
    const dangerHot = prox * 0.7
    let hue = lerp(w.hue, 6, dangerHot) // solids redden as they reach you
    const lum = clamp(55 - (w.radius / maxDim) * 18 + G.surge * 15 + prox * 14, 40, 86)
    const sat = 85
    let drawTh = th
    if (w.pulse) drawTh = th * (1 + 0.22 * Math.sin((G.time - w.born) * 4 + w.phase))
    if (G.overdrive > 0) hue = lerp(hue, 45, 0.5) // everything warms in OD
    ctx.lineCap = 'butt'
    for (const [a0, a1] of w.segs) {
      ctx.beginPath()
      ctx.arc(CX, CY, w.radius, a0, a1)
      ctx.strokeStyle = hsl(hue, sat, lum, 0.22 + dangerHot * 0.25)
      ctx.lineWidth = drawTh * 2.0
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(CX, CY, w.radius, a0, a1)
      ctx.strokeStyle = hsl(hue, sat, Math.min(94, lum + 22), 0.95)
      ctx.lineWidth = drawTh
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(CX, CY, w.radius - drawTh * 0.34, a0, a1)
      ctx.strokeStyle = hsl(hue, 60, 96, 0.5)
      ctx.lineWidth = drawTh * 0.18
      ctx.stroke()
    }
    // gap edge glow — marks where grazing happens
    if (prox > 0.04) {
      for (const g of w.gaps) {
        const eIntensity = 0.4 + prox * 0.6
        for (const sgn of [-1, 1]) {
          const ea = g.c + sgn * g.h
          const ex = CX + Math.cos(ea) * w.radius
          const ey = CY + Math.sin(ea) * w.radius
          drawSprite(prox > 0.55 ? GLOW_M : GLOW_C, ex, ey, th * (0.9 + prox * 1.1), eIntensity * 0.8)
        }
        // jackpot lane rail
        if (w.jack) {
          const lx = CX + Math.cos(g.c) * w.radius
          const ly = CY + Math.sin(g.c) * w.radius
          drawSprite(GLOW_G, lx, ly, th * 1.4 * prox, 0.5 * prox)
        }
        // fakeout: encroaching "energy" inside the (safe) gap
        if (w.fake) {
          const enc = (Math.sin((G.time - w.born) * 3) * 0.5 + 0.5) * g.h * 0.55
          for (const sgn of [-1, 1]) {
            ctx.beginPath()
            ctx.arc(CX, CY, w.radius, g.c + sgn * (g.h - enc), g.c + sgn * g.h)
            ctx.strokeStyle = hsl(15, 90, 60, 0.5 * prox)
            ctx.lineWidth = drawTh * 0.8
            ctx.stroke()
          }
        }
      }
    }
  }
  // directional cue toward nearest gap when the wall is still far
  if (near && nd > Rp * 0.55) {
    let best = 1e9
    let bc = 0
    for (const g of near.gaps) {
      const d = Math.abs(angDelta(g.c, G.pa))
      if (d < best) {
        best = d
        bc = g.c
      }
    }
    if (best > 0.12) {
      const dir = Math.sign(angDelta(bc, G.pa)) || 1
      const a = G.pa + dir * 0.34
      const x = CX + Math.cos(a) * Rp
      const y = CY + Math.sin(a) * Rp
      const al = clamp((nd - Rp * 0.55) / (minDim * 0.3), 0, 0.5) * (0.6 + 0.4 * Math.sin(G.menuT * 8))
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(a + Math.PI / 2 + (dir > 0 ? 0 : Math.PI))
      ctx.strokeStyle = hsl(190, 90, 75, al)
      ctx.lineWidth = 3 * scl
      ctx.lineCap = 'round'
      const s = minDim * 0.02
      ctx.beginPath()
      ctx.moveTo(-s, s * 0.6)
      ctx.lineTo(0, -s * 0.6)
      ctx.lineTo(s, s * 0.6)
      ctx.stroke()
      ctx.restore()
    }
  }
  ctx.globalCompositeOperation = 'source-over'
}

function drawCore(): void {
  const r = CORE_R()
  const od = G.overdrive > 0
  const bp = beatPulse()
  const baseHue = od ? 42 : lerp(190, 300, G.surge)
  ctx.globalCompositeOperation = 'lighter'
  // surge ring (charge) — pulses hard when ready
  const ringR = r * 1.9
  ctx.lineWidth = r * 0.34
  ctx.beginPath()
  ctx.arc(CX, CY, ringR, 0, TAU)
  ctx.strokeStyle = hsl(baseHue, 60, 40, 0.25)
  ctx.stroke()
  const fill = G.surge
  if (fill > 0.001) {
    const a0 = -Math.PI / 2
    const a1 = a0 + TAU * fill
    const ready = G.surge >= 1 && !od
    ctx.beginPath()
    ctx.arc(CX, CY, ringR, a0, a1)
    ctx.strokeStyle = hsl(ready ? 320 : baseHue, 90, ready ? 72 : 60, ready ? 0.7 + 0.3 * Math.sin(G.menuT * 16) : 0.9)
    ctx.lineWidth = r * 0.34 * (ready ? 1.3 : 1)
    ctx.lineCap = 'round'
    ctx.stroke()
    ctx.lineCap = 'butt'
  }
  // OD countdown ring (depletes)
  if (od) {
    const a0 = -Math.PI / 2
    const a1 = a0 + TAU * (G.overdrive / G.odMax)
    ctx.beginPath()
    ctx.arc(CX, CY, ringR * 1.18, a0, a1)
    ctx.strokeStyle = hsl(45, 95, 68, 0.85)
    ctx.lineWidth = r * 0.16
    ctx.lineCap = 'round'
    ctx.stroke()
    ctx.lineCap = 'butt'
  }
  const gscale = (od ? 2.4 : 1.4 + G.surge * 0.8) * (1 + bp * 0.05)
  drawSprite(od ? GLOW_G : GLOW_C, CX, CY, r * 4 * gscale, od ? 0.95 : 0.7)
  drawSprite(GLOW_W, CX, CY, r * 2.2 * gscale * (1 + bp * 0.06), 0.9)
  const corePulse =
    1 + bp * 0.04 + (G.surge >= 1 && !od ? 0.06 * Math.sin(G.menuT * 16) : 0) + G.heartPulse * 0.05
  ctx.beginPath()
  ctx.arc(CX, CY, r * corePulse, 0, TAU)
  ctx.fillStyle = hsl(baseHue, 80, od ? 76 : 65, 1)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(CX, CY, r * 0.6, 0, TAU)
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.fill()
  const rays = od ? 16 : 8
  const rl = r * (od ? 3.3 : 1.4 + G.surge * 1.7) * (1 + bp * 0.15)
  ctx.strokeStyle = hsl(baseHue, 90, 72, od ? 0.6 : 0.3 + G.surge * 0.45)
  ctx.lineWidth = 2 * scl
  for (let i = 0; i < rays; i++) {
    const a = G.menuT * (od ? 1.2 : 0.4) + (i / rays) * TAU
    ctx.beginPath()
    ctx.moveTo(CX + Math.cos(a) * r * 1.1, CY + Math.sin(a) * r * 1.1)
    ctx.lineTo(CX + Math.cos(a) * rl, CY + Math.sin(a) * rl)
    ctx.stroke()
  }
  ctx.globalCompositeOperation = 'source-over'
}

function drawPlayer(): void {
  if (G.state === STATE.DEAD) return
  const r = PLAYER_R()
  const a = G.pa
  const x = CX + Math.cos(a) * r
  const y = CY + Math.sin(a) * r
  const od = G.overdrive > 0
  const ch = G.chroma
  const theme = rankFor(G.best)
  const tcol = od ? 'g' : theme.trail
  ctx.globalCompositeOperation = 'lighter'
  // motion trail (rank-themed)
  const trailN = 10
  for (let i = 1; i <= trailN; i++) {
    const ta = a - G.pv * 0.018 * i
    const tx = CX + Math.cos(ta) * r
    const ty = CY + Math.sin(ta) * r
    const al = (1 - i / trailN) * 0.22
    drawSprite(glowFor(tcol), tx, ty, r * 0.18, al)
  }
  drawSprite(od ? GLOW_G : GLOW_W, x, y, r * 0.34 * (od ? 1.5 : 1), 0.9)
  // combo shield ring
  if (G.shieldArmed && !od) {
    ctx.strokeStyle = hsl(190, 90, 75, 0.5 + 0.3 * Math.sin(G.menuT * 8))
    ctx.lineWidth = 2.5 * scl
    ctx.beginPath()
    ctx.arc(x, y, minDim * 0.045, 0, TAU)
    ctx.stroke()
  }
  // post-shield phasing flicker
  if (G.invulnT > 0 && !od) {
    ctx.strokeStyle = hsl(190, 90, 80, 0.4 * Math.abs(Math.sin(G.menuT * 30)))
    ctx.lineWidth = 2 * scl
    ctx.beginPath()
    ctx.arc(x, y, minDim * 0.05, 0, TAU)
    ctx.stroke()
  }
  // OD countdown ring around player
  if (od) {
    const a0 = -Math.PI / 2
    const a1 = a0 + TAU * (G.overdrive / G.odMax)
    ctx.strokeStyle = hsl(45, 95, 72, 0.8)
    ctx.lineWidth = 3 * scl
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(x, y, minDim * 0.05, a0, a1)
    ctx.stroke()
    ctx.lineCap = 'butt'
  }
  if (ch > 0.4) {
    drawCraft(x + ch, y, a, 'rgba(255,40,80,0.55)')
    drawCraft(x - ch, y, a, 'rgba(40,160,255,0.55)')
  }
  ctx.globalCompositeOperation = 'source-over'
  drawCraft(x, y, a, od ? '#ffe9a8' : '#eafcff')
}

function drawCraft(x: number, y: number, a: number, col: string): void {
  const s = minDim * 0.02
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(a + Math.PI / 2)
  ctx.beginPath()
  ctx.moveTo(0, -s * 1.3)
  ctx.lineTo(s, s)
  ctx.lineTo(0, s * 0.4)
  ctx.lineTo(-s, s)
  ctx.closePath()
  ctx.fillStyle = col
  ctx.shadowColor = col
  ctx.shadowBlur = 10 * scl
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.restore()
}

function drawParticles(): void {
  ctx.globalCompositeOperation = 'lighter'
  for (const p of G.particles) {
    const k = 1 - p.t / p.life
    drawSprite(glowFor(p.col), p.x, p.y, p.r * 6 * scl * (0.6 + k * 0.6), k * 0.9)
  }
  ctx.globalCompositeOperation = 'source-over'
}

function drawRings(): void {
  ctx.globalCompositeOperation = 'lighter'
  for (const r of G.rings) {
    const k = 1 - r.t / r.life
    ctx.beginPath()
    ctx.arc(r.x, r.y, Math.max(0, r.r), 0, TAU)
    ctx.strokeStyle = hsl(hueFor(r.col), 90, 68, k * 0.75)
    ctx.lineWidth = (r.w || 3) * scl * Math.max(0.2, k)
    ctx.stroke()
  }
  ctx.globalCompositeOperation = 'source-over'
}

function drawTouchHint(): void {
  if (!isTouch || G.touchFlash <= 0.02 || G.touchSide === 0) return
  const a = G.touchFlash * 0.16
  const g = ctx.createLinearGradient(G.touchSide < 0 ? 0 : W, 0, G.touchSide < 0 ? W * 0.4 : W * 0.6, 0)
  g.addColorStop(0, hsl(190, 90, 60, a))
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

function drawVignette(): void {
  const g = ctx.createRadialGradient(CX, CY, minDim * 0.25, CX, CY, maxDim * 0.75)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  if (G.vignette > 0.01) {
    const r = ctx.createRadialGradient(CX, CY, minDim * 0.2, CX, CY, maxDim * 0.7)
    r.addColorStop(0, 'rgba(0,0,0,0)')
    r.addColorStop(1, rgba(255, 30, 60, G.vignette * 0.55))
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = r
    ctx.fillRect(0, 0, W, H)
    ctx.globalCompositeOperation = 'source-over'
  }
}

/* ---------- HUD ---------- */
function fmt(n: number): string {
  return Math.floor(n).toLocaleString('en-US')
}
const FMONO = '"DM Mono","SF Mono",ui-monospace,Consolas,monospace'

function drawHUD(): void {
  const cx = CX
  const topY = SAT
  const punch = 1 + clamp(G.shake, 0, 1) * 0.04
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `700 ${Math.round(minDim * 0.085 * punch)}px ${FMONO}`
  ctx.fillStyle = '#eafcff'
  ctx.shadowColor = 'rgba(56,232,255,.7)'
  ctx.shadowBlur = 18 * scl
  ctx.fillText(fmt(G.dispScore), cx, topY + minDim * 0.1)
  ctx.shadowBlur = 0
  if (G.mult > 1.05) {
    const mh = lerp(190, 330, clamp((G.mult - 1) / 15, 0, 1))
    ctx.font = `700 ${Math.round(minDim * 0.05)}px ${FMONO}`
    ctx.fillStyle = hsl(mh, 90, 70, 0.95)
    ctx.fillText('×' + G.mult.toFixed(1), cx, topY + minDim * 0.17)
  }
  if (G.combo >= 2) {
    const k = clamp(G.combo / 40, 0, 1)
    const cf = 1 + G.comboFlash * 0.4
    ctx.font = `700 ${Math.round(minDim * (0.04 + 0.035 * k) * cf)}px ${FMONO}`
    ctx.fillStyle = hsl(lerp(190, 320, k), 90, 70, 0.92)
    ctx.fillText(G.combo + ' CHAIN', cx, CY + PLAYER_R() + minDim * 0.07)
  }
  // overdrive ready prompt
  if (G.surge >= 1 && G.overdrive <= 0) {
    const a = 0.6 + 0.4 * Math.sin(G.menuT * 12)
    ctx.font = `700 ${Math.round(minDim * 0.042)}px "Bahnschrift",sans-serif`
    ctx.fillStyle = hsl(320, 95, 72, a)
    ctx.fillText(
      isTouch ? 'TAP ⚡ — OVERDRIVE READY' : 'SPACE — OVERDRIVE READY',
      cx,
      H - SAB - minDim * (isTouch ? 0.3 : 0.06),
    )
  }
  // OD timer bar (bottom)
  if (G.overdrive > 0) {
    const w = minDim * 0.5
    const h = 8 * scl
    const x = cx - w / 2
    const y = H - SAB - minDim * 0.05
    ctx.fillStyle = 'rgba(255,210,60,0.2)'
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = hsl(45, 95, 65, 0.95)
    ctx.fillRect(x, y, w * (G.overdrive / G.odMax), h)
  }
  // touch OD button
  if (isTouch && G.surge >= 1 && G.overdrive <= 0) {
    const b = odBtnRect()
    const pl = 0.7 + 0.3 * Math.sin(G.menuT * 10)
    drawSprite(GLOW_M, b.x, b.y, b.r * 3.4, 0.4 * pl)
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.r, 0, TAU)
    ctx.fillStyle = hsl(320, 90, 55, 0.32)
    ctx.fill()
    ctx.strokeStyle = hsl(320, 95, 74, pl)
    ctx.lineWidth = 3.5 * scl
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.font = `700 ${Math.round(b.r * 0.95)}px sans-serif`
    ctx.textBaseline = 'middle'
    ctx.fillText('⚡', b.x, b.y + b.r * 0.04)
    ctx.textBaseline = 'alphabetic'
  }
  // mode tag (respect notch)
  ctx.textAlign = 'left'
  ctx.font = `700 ${Math.round(minDim * 0.026)}px "Bahnschrift",sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.42)'
  const tag =
    G.mode === 'daily'
      ? 'DAILY · ' + (G.sig ? G.sig.name : '')
      : G.mode === 'tutorial'
        ? 'TRAINING'
        : 'ENDLESS'
  ctx.fillText(tag, SAL + minDim * 0.04, SAT + minDim * 0.045)
  ctx.textAlign = 'center'
}

export function odBtnRect(): CircleRect {
  const r = minDim * 0.092
  return { x: CX, y: H - SAB - minDim * 0.15, r }
}

/* ---------- floating score pops ---------- */
function drawPops(): void {
  ctx.textAlign = 'center'
  for (const p of G.pops) {
    const k = 1 - p.t / p.life
    const sc = p.big ? (p.od ? 1.6 : 1.25) : 0.92
    const grow = p.t < 0.12 ? lerp(0.4, 1, p.t / 0.12) : 1
    ctx.globalAlpha = clamp(k * 1.4, 0, 1)
    ctx.font = `700 ${Math.round(minDim * 0.04 * sc * grow)}px ${FMONO}`
    const col = p.od
      ? hsl(45, 95, 70, 1)
      : p.col === 'm'
        ? hsl(320, 90, 74, 1)
        : p.col === 'g'
          ? hsl(45, 95, 70, 1)
          : p.col === 'c'
            ? hsl(190, 90, 76, 1)
            : '#eafcff'
    ctx.fillStyle = col
    ctx.shadowColor =
      p.col === 'g' ? 'rgba(255,210,60,.8)' : p.col === 'm' ? 'rgba(255,60,172,.7)' : 'rgba(56,232,255,.6)'
    ctx.shadowBlur = 12 * scl
    ctx.fillText(p.txt, p.x, p.y)
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
  }
}

/* ---------- atmospheric toasts ---------- */
function drawToasts(): void {
  if (G.toasts.length === 0) return
  ctx.textAlign = 'center'
  let i = 0
  for (const tt of G.toasts) {
    const k = tt.t < 0.25 ? tt.t / 0.25 : tt.t > tt.life - 0.5 ? (tt.life - tt.t) / 0.5 : 1
    ctx.globalAlpha = clamp(k, 0, 1) * 0.95
    ctx.font = `700 ${Math.round(minDim * 0.032)}px "Bahnschrift",sans-serif`
    ctx.fillStyle = toastColor(tt.col)
    ctx.fillText(tt.txt, CX, SAT + minDim * 0.235 + i * minDim * 0.05)
    ctx.globalAlpha = 1
    i++
  }
}

function drawTutorialPrompt(): void {
  const tut = G.tut!
  ctx.textAlign = 'center'
  const a = 0.7 + 0.3 * Math.sin(G.menuT * 5)
  ctx.font = `700 ${Math.round(minDim * 0.036)}px "Bahnschrift",sans-serif`
  ctx.fillStyle = hsl(190, 80, 82, a)
  ctx.fillText(tut.prompt ?? '', CX, H - SAB - minDim * (isTouch ? 0.34 : 0.12))
}

/* ---------- MENU ---------- */
export let menuBtns: Record<string, ButtonRect> = {}

function drawMenu(): void {
  const cx = CX
  const cy = CY
  ctx.textAlign = 'center'
  const tp = pulse(0.02, 0.6)
  ctx.font = `700 ${Math.round(minDim * 0.17 * tp)}px "Bahnschrift",sans-serif`
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = 'rgba(255,40,90,0.85)'
  ctx.fillText('BRINK', cx - 4 * scl, cy - minDim * 0.22)
  ctx.fillStyle = 'rgba(40,180,255,0.85)'
  ctx.fillText('BRINK', cx + 4 * scl, cy - minDim * 0.22)
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = '#f4ffff'
  ctx.fillText('BRINK', cx, cy - minDim * 0.22)
  ctx.font = `700 ${Math.round(minDim * 0.03)}px "Bahnschrift",sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.fillText('E D G E   R U S H', cx, cy - minDim * 0.155)

  // rank badge + progress to next
  const rk = rankFor(G.best)
  const nx = nextRank(G.best)
  ctx.font = `700 ${Math.round(minDim * 0.034)}px "Bahnschrift",sans-serif`
  ctx.fillStyle = hsl(rk.hue, 90, 70, 1)
  ctx.fillText('▸ ' + rk.name + ' ◂', cx, cy - minDim * 0.1)
  if (nx) {
    const span = nx.min - rk.min
    const prog = clamp((G.best - rk.min) / span, 0, 1)
    const bw = minDim * 0.42
    const bh = 6 * scl
    const x = cx - bw / 2
    const y = cy - minDim * 0.075
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    roundRect(x, y, bw, bh, bh / 2)
    ctx.fill()
    ctx.fillStyle = hsl(rk.hue, 90, 62, 1)
    roundRect(x, y, bw * prog, bh, bh / 2)
    ctx.fill()
    ctx.font = `600 ${Math.round(minDim * 0.022)}px ${FMONO}`
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.fillText(fmt(nx.min - G.best) + ' TO ' + nx.name, cx, y + minDim * 0.04)
  }

  // buttons — first ever launch shows a single PLAY (-> tutorial)
  const bw = minDim * 0.6
  const bh = minDim * 0.105
  const gap = minDim * 0.03
  const y1 = cy + minDim * 0.02
  menuBtns = {}
  if (!G.tutDone) {
    menuBtns.play = button(cx, y1, bw, bh, 'PLAY', '#38e8ff', true)
    ctx.font = `600 ${Math.round(minDim * 0.026)}px "Bahnschrift",sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.fillText('QUICK TRAINING FIRST', cx, y1 + bh * 0.5 + minDim * 0.05)
  } else {
    menuBtns.daily = button(cx, y1, bw, bh, 'PLAY  ·  DAILY', '#38e8ff', true)
    const y2 = y1 + bh + gap
    menuBtns.endless = button(cx, y2, bw * 0.78, bh * 0.8, 'ENDLESS', 'rgba(255,255,255,0.7)', false)
    // stats
    ctx.font = `600 ${Math.round(minDim * 0.027)}px ${FMONO}`
    const y3 = y2 + bh * 0.8 + gap * 1.3
    ctx.fillStyle = 'rgba(255,255,255,0.78)'
    ctx.fillText('BEST  ' + fmt(G.best), cx, y3)
    let yy = y3
    if (G.todayBest > 0) {
      yy += minDim * 0.044
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.fillText('TODAY  ' + fmt(G.todayBest), cx, yy)
    }
    if (G.yest && G.yest > 0) {
      yy += minDim * 0.044
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.fillText('YESTERDAY  ' + fmt(G.yest), cx, yy)
    }
    if (G.streak > 0) {
      yy += minDim * 0.044
      ctx.fillStyle = hsl(35, 95, 65, 1)
      ctx.fillText('🔥 ' + G.streak + ' DAY STREAK', cx, yy)
    }
    // today's anomaly
    const sig = SIGS[seedFromString('brink-' + todayStr()) % SIGS.length]
    ctx.font = `700 ${Math.round(minDim * 0.024)}px "Bahnschrift",sans-serif`
    ctx.fillStyle = hsl(45, 90, 68, 0.85)
    ctx.fillText("TODAY'S ANOMALY · " + sig.name, cx, yy + minDim * 0.05)
  }

  ctx.font = `600 ${Math.round(minDim * 0.026)}px "Bahnschrift",sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.fillText(
    isTouch ? 'HOLD LEFT / RIGHT · GRAZE THE EDGES' : '← →  STEER  ·  GRAZE THE EDGES TO CHARGE',
    cx,
    H - SAB - minDim * 0.05,
  )
}

function button(
  cx: number,
  cy: number,
  w: number,
  h: number,
  label: string,
  col: string,
  filled: boolean,
): ButtonRect {
  const x = cx - w / 2
  const y = cy - h / 2
  const r = h * 0.28
  const pl = filled ? 0.5 + 0.5 * Math.abs(Math.sin(G.menuT * 3)) : 1
  roundRect(x, y, w, h, r)
  if (filled) {
    ctx.fillStyle = hsl(190, 90, 55, 0.18)
    ctx.fill()
    ctx.strokeStyle = col
    ctx.lineWidth = 2.5 * scl
    ctx.globalAlpha = pl
    ctx.stroke()
    ctx.globalAlpha = 1
  } else {
    ctx.strokeStyle = col
    ctx.lineWidth = 1.8 * scl
    ctx.stroke()
  }
  ctx.fillStyle = filled ? '#eafcff' : col
  ctx.font = `700 ${Math.round(h * 0.42)}px "Bahnschrift",sans-serif`
  ctx.textBaseline = 'middle'
  ctx.fillText(label, cx, cy + h * 0.02)
  ctx.textBaseline = 'alphabetic'
  return { x, y, w, h }
}

/* ---------- DEAD recap (awards + positive title + fast replay) ---------- */
export let deadBtns: Record<string, ButtonRect> = {}

function runTitle(): string {
  const r = G
  if (r.mode === 'tutorial') return 'TRAINING COMPLETE'
  if (r.odUsed >= 3) return 'OVERDRIVE MASTER'
  if (r.insaneCount >= 3) return 'PERFECT PILOT'
  if (r.nearMiss >= 5) return 'FEARLESS'
  if (r.newBest) return 'NEW LEGEND'
  if (r.best > 0) {
    const gap = r.best - Math.floor(r.score)
    if (gap > 0 && gap < r.best * 0.08) return 'ALMOST LEGENDARY'
  }
  if (r.bestCombo >= 25) return 'EDGE ADDICT'
  return rankFor(Math.floor(r.score)).name
}

function drawDead(): void {
  const cx = CX
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(5,3,15,0.58)'
  ctx.fillRect(0, 0, W, H)
  const t = G.deadT
  let y = SAT + minDim * 0.16
  // positive title
  ctx.font = `700 ${Math.round(minDim * 0.058)}px "Bahnschrift",sans-serif`
  ctx.fillStyle = G.newBest ? hsl(45, 95, 68, 0.7 + 0.3 * Math.sin(t * 10)) : hsl(190, 70, 82, 0.95)
  ctx.fillText(runTitle(), cx, y)
  // big score (count-up)
  y += minDim * 0.12
  ctx.font = `700 ${Math.round(minDim * 0.14)}px ${FMONO}`
  ctx.fillStyle = '#eafcff'
  ctx.shadowColor = 'rgba(56,232,255,.6)'
  ctx.shadowBlur = 20 * scl
  ctx.fillText(fmt(G.dispScore), cx, y)
  ctx.shadowBlur = 0
  // best comparison
  y += minDim * 0.05
  ctx.font = `600 ${Math.round(minDim * 0.028)}px ${FMONO}`
  if (G.mode !== 'tutorial') {
    if (G.newBest) {
      ctx.fillStyle = hsl(45, 90, 66, 1)
      ctx.fillText('NEW PERSONAL BEST', cx, y)
    } else if (G.best > 0) {
      const gap = G.best - Math.floor(G.score)
      ctx.fillStyle = gap < G.best * 0.08 ? hsl(45, 90, 66, 1) : 'rgba(255,255,255,0.55)'
      ctx.fillText(
        gap > 0 && gap < G.best * 0.08 ? 'ONLY ' + fmt(gap) + ' FROM YOUR BEST' : 'BEST  ' + fmt(G.best),
        cx,
        y,
      )
    }
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.fillText('NICE — YOU KNOW THE MOVES', cx, y)
  }

  // award chips
  y += minDim * 0.05
  const awards: string[] = []
  if (G.topTierIdx >= 0) awards.push('BEST GRAZE · ' + GRAZE_TIERS[G.topTierIdx].name)
  awards.push('LONGEST CHAIN · ' + G.bestCombo)
  if (G.odUsed > 0) awards.push('OVERDRIVE ×' + G.odUsed)
  if (G.nearMiss > 0) awards.push('NEAR MISS ×' + G.nearMiss)
  awards.push('TIME · ' + G.time.toFixed(1) + 's')
  ctx.font = `600 ${Math.round(minDim * 0.024)}px ${FMONO}`
  ctx.fillStyle = 'rgba(255,255,255,0.62)'
  const rows = awards.slice(0, 5)
  for (let i = 0; i < rows.length; i += 2) {
    const line = rows[i] + (rows[i + 1] ? '      ·      ' + rows[i + 1] : '')
    ctx.fillText(line, cx, y)
    y += minDim * 0.038
  }
  if (G.mode === 'daily') {
    y += minDim * 0.004
    ctx.fillStyle = hsl(45, 90, 66, 0.85)
    ctx.fillText('COME BACK TOMORROW · NEW ANOMALY', cx, y)
    y += minDim * 0.04
  }

  // buttons: fast replay big, then Daily | Endless, then Menu
  const bw = minDim * 0.56
  const bh = minDim * 0.1
  const g2 = minDim * 0.026
  let by = Math.max(y + minDim * 0.02, CY + minDim * 0.16)
  deadBtns = {}
  deadBtns.again = button(cx, by, bw, bh, isTouch ? 'TAP TO PLAY AGAIN' : 'AGAIN  ▸  SPACE', '#38e8ff', true)
  by += bh + g2
  const half = bw * 0.5 - g2 * 0.5
  deadBtns.daily = button(cx - half / 2 - g2 * 0.5, by, half, bh * 0.78, 'DAILY', 'rgba(255,255,255,0.72)', false)
  deadBtns.endless = button(cx + half / 2 + g2 * 0.5, by, half, bh * 0.78, 'ENDLESS', 'rgba(255,255,255,0.72)', false)
  by += bh * 0.78 + g2
  deadBtns.menu = button(cx, by, bw * 0.5, bh * 0.7, 'MENU', 'rgba(255,255,255,0.55)', false)
}

function drawPause(): void {
  ctx.fillStyle = 'rgba(5,3,15,0.6)'
  ctx.fillRect(0, 0, W, H)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#eafcff'
  ctx.font = `700 ${Math.round(minDim * 0.06)}px "Bahnschrift",sans-serif`
  ctx.fillText('PAUSED', CX, CY - minDim * 0.02)
  ctx.font = `600 ${Math.round(minDim * 0.03)}px "Bahnschrift",sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.fillText(isTouch ? 'TAP TO RESUME' : 'PRESS ANY KEY TO RESUME', CX, CY + minDim * 0.04)
}

/* ---------- mute icon ---------- */
export function muteRect(): CircleRect {
  const r = minDim * 0.03
  return { x: W - SAR - minDim * 0.06, y: SAT + minDim * 0.05, r }
}

function drawMuteIcon(): void {
  const b = muteRect()
  ctx.save()
  ctx.translate(b.x, b.y)
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = 2 * scl
  const s = b.r
  ctx.beginPath()
  ctx.moveTo(-s * 0.7, -s * 0.3)
  ctx.lineTo(-s * 0.2, -s * 0.3)
  ctx.lineTo(s * 0.15, -s * 0.7)
  ctx.lineTo(s * 0.15, s * 0.7)
  ctx.lineTo(-s * 0.2, s * 0.3)
  ctx.lineTo(-s * 0.7, s * 0.3)
  ctx.closePath()
  ctx.fill()
  if (Audio_.muted) {
    ctx.beginPath()
    ctx.moveTo(s * 0.4, -s * 0.5)
    ctx.lineTo(s * 0.9, s * 0.5)
    ctx.moveTo(s * 0.9, -s * 0.5)
    ctx.lineTo(s * 0.4, s * 0.5)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.arc(s * 0.35, 0, s * 0.45, -0.7, 0.7)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(s * 0.35, 0, s * 0.8, -0.7, 0.7)
    ctx.stroke()
  }
  ctx.restore()
}

/* ---------- secondary top-right control: pause (in play) / gear (menus) ---------- */
export function secondaryIconRect(): CircleRect {
  const r = minDim * 0.03
  return { x: W - SAR - minDim * 0.135, y: SAT + minDim * 0.05, r }
}

function drawSecondaryIcon(): void {
  const b = secondaryIconRect()
  if (G.state === STATE.PLAYING) {
    // pause glyph (two bars)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    const bw = b.r * 0.34
    const bh = b.r * 1.2
    const gap = b.r * 0.34
    ctx.fillRect(b.x - gap - bw, b.y - bh / 2, bw, bh)
    ctx.fillRect(b.x + gap, b.y - bh / 2, bw, bh)
  } else if (G.state === STATE.MENU || G.state === STATE.PAUSE || G.state === STATE.DEAD) {
    // gear glyph
    ctx.save()
    ctx.translate(b.x, b.y)
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 2 * scl
    ctx.beginPath()
    ctx.arc(0, 0, b.r * 0.6, 0, TAU)
    ctx.stroke()
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * b.r * 0.6, Math.sin(a) * b.r * 0.6)
      ctx.lineTo(Math.cos(a) * b.r, Math.sin(a) * b.r)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(0, 0, b.r * 0.26, 0, TAU)
    ctx.fill()
    ctx.restore()
  }
}

/* ---------- settings modal ---------- */
export let settingsBtns: Record<string, ButtonRect> = {}

function toggleRow(cx: number, cy: number, w: number, h: number, label: string, on: boolean): ButtonRect {
  const x = cx - w / 2
  const y = cy - h / 2
  const r = h * 0.28
  roundRect(x, y, w, h, r)
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  ctx.fill()
  ctx.strokeStyle = on ? hsl(190, 90, 65, 0.9) : 'rgba(255,255,255,0.22)'
  ctx.lineWidth = 2 * scl
  ctx.stroke()
  // label
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${Math.round(h * 0.34)}px "Bahnschrift",sans-serif`
  ctx.fillStyle = '#eafcff'
  ctx.fillText(label, x + h * 0.55, cy)
  // pill switch
  const pw = h * 1.5
  const ph = h * 0.5
  const px = x + w - h * 0.4 - pw
  roundRect(px, cy - ph / 2, pw, ph, ph / 2)
  ctx.fillStyle = on ? hsl(190, 90, 55, 0.55) : 'rgba(255,255,255,0.12)'
  ctx.fill()
  const kx = on ? px + pw - ph / 2 : px + ph / 2
  ctx.beginPath()
  ctx.arc(kx, cy, ph * 0.4, 0, TAU)
  ctx.fillStyle = on ? '#eafcff' : 'rgba(255,255,255,0.55)'
  ctx.fill()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  return { x, y, w, h }
}

function drawSettings(): void {
  ctx.fillStyle = 'rgba(4,3,14,0.86)'
  ctx.fillRect(0, 0, W, H)
  const cx = CX
  ctx.textAlign = 'center'
  ctx.fillStyle = '#eafcff'
  ctx.font = `700 ${Math.round(minDim * 0.06)}px "Bahnschrift",sans-serif`
  ctx.fillText('SETTINGS', cx, CY - minDim * 0.2)

  const rowW = Math.min(minDim * 0.72, W - SAL - SAR - minDim * 0.1)
  const rowH = minDim * 0.1
  const gap = minDim * 0.028
  let y = CY - minDim * 0.08
  settingsBtns = {}
  settingsBtns.sound = toggleRow(cx, y, rowW, rowH, 'SOUND', !Audio_.muted)
  y += rowH + gap
  settingsBtns.motion = toggleRow(cx, y, rowW, rowH, 'REDUCED MOTION', Settings.reducedMotion)
  y += rowH + gap
  if (canVibrate) {
    settingsBtns.haptics = toggleRow(cx, y, rowW, rowH, 'HAPTICS', Settings.haptics)
    y += rowH + gap
  }
  y += gap
  settingsBtns.done = button(cx, y + rowH * 0.45, rowW * 0.6, rowH * 0.9, 'DONE', '#38e8ff', true)

  ctx.font = `600 ${Math.round(minDim * 0.022)}px "Bahnschrift",sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.fillText('Reduced Motion dims flashes, shake & zoom', cx, H - SAB - minDim * 0.05)
}
