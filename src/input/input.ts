/**
 * Input — keyboard + pointer (mouse & touch). The left/right screen halves
 * steer; taps drive menu/dead-screen buttons and the touch overdrive control.
 */
import { cv, CX } from '../render/canvas'
import { G } from '../game/state'
import { STATE } from '../game/constants'
import { Audio_ } from '../audio/engine'
import { startRun, toMenu } from '../game/lifecycle'
import { triggerOverdrive } from '../game/update'
import { deadBtns, menuBtns, muteRect, odBtnRect } from '../render/render'
import { isTouch } from '../platform'
import type { ButtonRect, CircleRect } from '../types'

interface Point {
  x: number
  y: number
}
type PointerId = string | number

const pointers = new Map<PointerId, Point>()

function pt(e: { clientX: number; clientY: number }): Point {
  const r = cv.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}
function hit(b: ButtonRect | undefined, p: Point): boolean {
  return !!b && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h
}
function hitCircle(b: CircleRect, p: Point): boolean {
  return Math.hypot(p.x - b.x, p.y - b.y) <= b.r
}

function onDown(p: Point, id: PointerId): void {
  if (hitCircle(muteRect(), p)) {
    Audio_.setMuted(!Audio_.muted)
    return
  }
  if (G.state === STATE.MENU) {
    if (hit(menuBtns.play, p)) {
      startRun('tutorial')
      return
    }
    if (hit(menuBtns.daily, p)) {
      startRun('daily')
      return
    }
    if (hit(menuBtns.endless, p)) {
      startRun('endless')
      return
    }
    // first-launch: tapping anywhere starts (TAP TO START feel)
    if (!G.tutDone) {
      startRun('tutorial')
      return
    }
    return
  }
  if (G.state === STATE.DEAD) {
    if (hit(deadBtns.menu, p)) {
      toMenu()
      return
    }
    if (hit(deadBtns.daily, p)) {
      startRun('daily')
      return
    }
    if (hit(deadBtns.endless, p)) {
      startRun('endless')
      return
    }
    // AGAIN button or anywhere else -> fastest replay
    startRun(G.mode === 'tutorial' ? 'daily' : G.mode)
    return
  }
  if (G.state === STATE.PAUSE) {
    G.state = STATE.PLAYING
    return
  }
  if (G.state === STATE.PLAYING) {
    if (isTouch && G.surge >= 1 && G.overdrive <= 0 && hitCircle(odBtnRect(), p)) {
      triggerOverdrive()
      return
    }
    pointers.set(id, p)
    updateSteer()
    G.touchSide = p.x < CX ? -1 : 1
    G.touchFlash = 1
  }
}

function onMove(p: Point, id: PointerId): void {
  if (pointers.has(id)) {
    pointers.set(id, p)
    updateSteer()
    if (G.state === STATE.PLAYING) {
      G.touchSide = p.x < CX ? -1 : 1
    }
  }
}

function onUp(id: PointerId): void {
  pointers.delete(id)
  updateSteer()
}

function updateSteer(): void {
  if (G.state !== STATE.PLAYING) {
    G.dir = 0
    return
  }
  if (pointers.size === 0) {
    G.dir = 0
    return
  }
  let last: Point | null = null
  for (const v of pointers.values()) last = v
  if (!last) {
    G.dir = 0
    return
  }
  G.dir = last.x < CX ? -1 : 1
}

cv.addEventListener('mousedown', (e) => {
  onDown(pt(e), 'm')
})
window.addEventListener('mousemove', (e) => {
  onMove(pt(e), 'm')
})
window.addEventListener('mouseup', () => {
  onUp('m')
})
cv.addEventListener(
  'touchstart',
  (e) => {
    e.preventDefault()
    for (const t of e.changedTouches) onDown(pt(t), t.identifier)
  },
  { passive: false },
)
cv.addEventListener(
  'touchmove',
  (e) => {
    e.preventDefault()
    for (const t of e.changedTouches) onMove(pt(t), t.identifier)
  },
  { passive: false },
)
cv.addEventListener(
  'touchend',
  (e) => {
    e.preventDefault()
    for (const t of e.changedTouches) onUp(t.identifier)
  },
  { passive: false },
)
cv.addEventListener('touchcancel', (e) => {
  for (const t of e.changedTouches) onUp(t.identifier)
})

const keys: { left?: boolean; right?: boolean } = {}
window.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault()
  if (e.repeat) return
  const k = e.key.toLowerCase()
  if (k === 'm') {
    Audio_.setMuted(!Audio_.muted)
    return
  }
  if (G.state === STATE.MENU) {
    if (!G.tutDone) {
      if (k === ' ' || k === 'enter') startRun('tutorial')
      return
    }
    if (k === ' ' || k === 'enter') startRun('daily')
    if (k === 'e') startRun('endless')
    return
  }
  if (G.state === STATE.DEAD) {
    if (k === 'escape') toMenu()
    else if (k === 'e') startRun('endless')
    else if (k === 'd') startRun('daily')
    else startRun(G.mode === 'tutorial' ? 'daily' : G.mode)
    return
  }
  if (G.state === STATE.PAUSE) {
    G.state = STATE.PLAYING
    return
  }
  if (G.state === STATE.PLAYING) {
    if (k === 'arrowleft' || k === 'a') keys.left = true
    if (k === 'arrowright' || k === 'd') keys.right = true
    if (k === ' ' || k === 'enter' || k === 'arrowup' || k === 'w') triggerOverdrive()
    if (k === 'escape') {
      G.state = STATE.PAUSE
    }
    refreshKeyDir()
  }
})
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase()
  if (k === 'arrowleft' || k === 'a') keys.left = false
  if (k === 'arrowright' || k === 'd') keys.right = false
  refreshKeyDir()
})
function refreshKeyDir(): void {
  if (pointers.size > 0) return
  G.dir = (keys.left ? -1 : 0) + (keys.right ? 1 : 0)
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.state === STATE.PLAYING) {
    G.state = STATE.PAUSE
    keys.left = keys.right = false
    G.dir = 0
  }
})
