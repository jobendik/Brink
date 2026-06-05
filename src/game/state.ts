/**
 * The single mutable game-state object `G`. Mutated in place across the
 * update/render pipeline; never reassigned, so importing modules share it.
 */
import { STATE } from './constants'
import type {
  Mode,
  Particle,
  Pattern,
  Pop,
  Ring,
  Sig,
  Star,
  Toast,
  Tut,
  Wall,
} from '../types'

export interface GameState {
  state: number
  mode: Mode

  best: number
  todayBest: number
  streak: number
  streakLast: string
  yest: number | null
  tutDone: boolean

  time: number
  score: number
  dispScore: number
  mult: number
  surge: number
  overdrive: number
  odMax: number

  combo: number
  bestCombo: number
  grazeTimer: number
  alive: boolean

  pa: number
  pv: number
  dir: number

  walls: Wall[]
  spawnT: number
  currentSpeed: number
  prevCenter: number
  pattern: Pattern

  sig: Sig | null
  sinceBreather: number
  wallCount: number

  rng: () => number
  seed: number

  // fx / camera
  shake: number
  flash: number
  zoom: number
  vignette: number
  chroma: number
  timeScale: number
  timeScaleTarget: number
  hitstop: number
  danger: number
  heartT: number
  heartPulse: number
  comboFlash: number
  invulnT: number

  particles: Particle[]
  pops: Pop[]
  stars: Star[]
  rings: Ring[]
  toasts: Toast[]

  // run stats (for recap awards)
  odUsed: number
  nearMiss: number
  grazeCount: number
  perfectCount: number
  insaneCount: number
  topTierIdx: number

  // flags
  surgeReadyToasted: boolean
  shieldArmed: boolean
  shieldClimb: boolean
  newBest: boolean
  deadT: number
  menuT: number
  beat: number
  touchSide: number
  touchFlash: number

  // dynamic
  nextMileIdx: number
  tut: Tut | null
  countedStreakToday?: boolean
}

export const G: GameState = {
  state: STATE.MENU,
  mode: 'daily',
  best: 0,
  todayBest: 0,
  streak: 0,
  streakLast: '',
  yest: null,
  tutDone: false,
  time: 0,
  score: 0,
  dispScore: 0,
  mult: 1,
  surge: 0,
  overdrive: 0,
  odMax: 4.2,
  combo: 0,
  bestCombo: 0,
  grazeTimer: 0,
  alive: true,
  pa: -Math.PI / 2,
  pv: 0,
  dir: 0,
  walls: [],
  spawnT: 0,
  currentSpeed: 0,
  prevCenter: -Math.PI / 2,
  pattern: { name: 'single', left: 5, step: 0, dir: 1, base: -Math.PI / 2 },
  sig: null,
  sinceBreather: 0,
  wallCount: 0,
  rng: Math.random,
  seed: 0,
  shake: 0,
  flash: 0,
  zoom: 1,
  vignette: 0,
  chroma: 0,
  timeScale: 1,
  timeScaleTarget: 1,
  hitstop: 0,
  danger: 0,
  heartT: 0,
  heartPulse: 0,
  comboFlash: 0,
  invulnT: 0,
  particles: [],
  pops: [],
  stars: [],
  rings: [],
  toasts: [],
  odUsed: 0,
  nearMiss: 0,
  grazeCount: 0,
  perfectCount: 0,
  insaneCount: 0,
  topTierIdx: -1,
  surgeReadyToasted: false,
  shieldArmed: false,
  shieldClimb: false,
  newBest: false,
  deadT: 0,
  menuT: 0,
  beat: 0,
  touchSide: 0,
  touchFlash: 0,
  nextMileIdx: 0,
  tut: null,
}
