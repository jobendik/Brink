/**
 * Shared data shapes for game entities and configuration tables.
 */

/** Glow/trail colour keys: cyan, magenta, gold, white, red. */
export type Col = 'c' | 'm' | 'g' | 'w' | 'r'

export type Mode = 'daily' | 'endless' | 'tutorial'

export interface Gap {
  c: number
  h: number
}

export interface Wall {
  radius: number
  gaps: Gap[]
  hue: number
  minEdge: number
  scored: boolean
  dangerSeen: boolean
  pulse: boolean
  fake: boolean
  jack: boolean
  born: number
  phase: number
  segs: Array<[number, number]>
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  t: number
  r: number
  col: Col
  drag: number
}

export interface Pop {
  x: number
  y: number
  t: number
  life: number
  txt: string
  big: boolean
  col: Col
  od?: boolean
}

export interface Ring {
  x: number
  y: number
  r: number
  v: number
  life: number
  t: number
  col: Col
  w: number
}

export interface Toast {
  txt: string
  col: Col
  t: number
  life: number
}

export interface Star {
  a: number
  r: number
  s: number
  sp: number
  tw: number
}

export interface Pattern {
  name: string
  left: number
  step: number
  dir: number
  base: number
}

export interface Tier {
  name: string
  min: number
  pts: number
  surge: number
  mult: number
  parts: number
  shake: number
  flash: number
  col: Col
  pitch: number
  micro: number
  ring: boolean
  big: boolean
}

export interface Rank {
  min: number
  name: string
  hue: number
  trail: Col
}

export interface Sig {
  name: string
  bias: string
}

export interface Tut {
  phase: number
  t: number
  moved: number
  passed: number
  grazed: number
  prompt?: string
  done?: number
}

export interface ButtonRect {
  x: number
  y: number
  w: number
  h: number
}

export interface CircleRect {
  x: number
  y: number
  r: number
}
