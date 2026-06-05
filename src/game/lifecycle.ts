/**
 * Run lifecycle: starting a run (daily / endless / tutorial), death + score
 * persistence (best, daily, streak) and returning to the menu.
 */
import { TAU } from '../utils/math'
import { dateOffsetStr, mulberry32, seedFromString, todayStr } from '../utils/rng'
import { Store } from '../utils/store'
import { CX, CY, PLAYER_R, scl } from '../render/canvas'
import { G } from './state'
import { Audio_ } from '../audio/engine'
import { SIGS, STATE } from './constants'
import { addToast, trimParticles } from './fx'
import type { Mode } from '../types'

export function startRun(mode: Mode): void {
  Audio_.init()
  Audio_.resume()
  // first ever launch -> tutorial practice run (not recorded)
  if (!G.tutDone && mode !== 'tutorial') {
    mode = 'tutorial'
  }
  G.mode = mode
  if (mode === 'daily') {
    G.seed = seedFromString('brink-' + todayStr())
    G.sig = SIGS[G.seed % SIGS.length]
  } else if (mode === 'tutorial') {
    G.seed = 12345
    G.sig = null
  } else {
    G.seed = (Math.random() * 1e9) >>> 0
    G.sig = null
  }
  G.rng = mulberry32(G.seed)
  G.state = STATE.PLAYING
  G.time = 0
  G.score = 0
  G.dispScore = 0
  G.mult = 1
  G.surge = 0
  G.overdrive = 0
  G.combo = 0
  G.bestCombo = 0
  G.grazeTimer = 0
  G.alive = true
  G.nextMileIdx = 0
  G.pa = -Math.PI / 2
  G.pv = 0
  G.dir = 0
  G.prevCenter = -Math.PI / 2
  G.walls = []
  G.spawnT = mode === 'tutorial' ? 1.1 : 0.7
  G.currentSpeed = 0
  G.pattern = { name: 'single', left: 4, step: 0, dir: G.rng() < 0.5 ? -1 : 1, base: -Math.PI / 2 }
  G.sinceBreather = 0
  G.wallCount = 0
  G.particles.length = 0
  G.pops.length = 0
  G.rings.length = 0
  G.toasts.length = 0
  G.shake = 0
  G.flash = 0
  G.zoom = 1
  G.vignette = 0
  G.chroma = 0
  G.timeScale = 1
  G.timeScaleTarget = 1
  G.hitstop = 0
  G.danger = 0
  G.heartT = 0
  G.heartPulse = 0
  G.comboFlash = 0
  G.invulnT = 0
  G.odUsed = 0
  G.nearMiss = 0
  G.grazeCount = 0
  G.perfectCount = 0
  G.insaneCount = 0
  G.topTierIdx = -1
  G.surgeReadyToasted = false
  G.shieldArmed = false
  G.shieldClimb = false
  G.newBest = false
  G.tut = mode === 'tutorial' ? { phase: 0, t: 0, moved: 0, passed: 0, grazed: 0 } : null
  Audio_.bpm = 132
  Audio_.start()
  if (mode === 'tutorial') addToast('TRAINING REACTOR', 'c')
  else {
    addToast('REACTOR ONLINE', 'c')
    if (mode === 'daily' && G.sig)
      setTimeout(() => {
        if (G.state === STATE.PLAYING) addToast('ANOMALY · ' + G.sig!.name, 'g')
      }, 1100)
  }
  window.CrazyGames?.SDK?.game?.gameplayStart?.()
}

export function die(): void {
  if (!G.alive) return
  G.alive = false
  G.state = STATE.DEAD
  G.deadT = 0
  G.timeScaleTarget = 0.25
  G.shake = Math.min(2, G.shake + 1.6)
  G.flash = 1
  G.hitstop = 0.1
  const ang = G.pa
  const r = PLAYER_R()
  const px = CX + Math.cos(ang) * r
  const py = CY + Math.sin(ang) * r
  for (let i = 0; i < 46; i++) {
    const a = Math.random() * TAU
    const sp = (Math.random() * 9 + 2) * scl * 60
    G.particles.push({
      x: px,
      y: py,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: Math.random() * 0.9 + 0.5,
      t: 0,
      r: Math.random() * 3.5 + 1.5,
      col: Math.random() < 0.5 ? 'c' : 'm',
      drag: 2.4,
    })
  }
  trimParticles()
  addToast('CORE COLLAPSE', 'r')
  Audio_.die()
  Audio_.stop()
  // tutorial run: never recorded; mark done so it won't show again
  if (G.mode === 'tutorial') {
    G.tutDone = true
    Store.set('brink_tut', 'done')
  } else {
    const sc = Math.floor(G.score)
    if (sc > G.best) {
      G.best = sc
      G.newBest = true
      Audio_.best()
      Store.set('brink_best', G.best)
      window.CrazyGames?.SDK?.game?.happytime?.()
    }
    if (G.mode === 'daily') {
      if (sc > G.todayBest) {
        G.todayBest = sc
        Store.set('brink_today', todayStr() + '|' + G.todayBest)
      }
      if (!G.countedStreakToday) {
        G.countedStreakToday = true
        if (G.streakLast === dateOffsetStr(-1)) G.streak = (G.streak || 0) + 1
        else if (G.streakLast === todayStr()) {
          /* already counted today */
        } else G.streak = 1
        G.streakLast = todayStr()
        Store.set('brink_streak', G.streak + '|' + G.streakLast)
      }
    }
  }
  window.CrazyGames?.SDK?.game?.gameplayStop?.()
}

export function toMenu(): void {
  G.state = STATE.MENU
  G.timeScaleTarget = 1
  G.timeScale = 1
  Audio_.stop()
}
