/**
 * Tutorial coaching: staged prompts + gentle pacing that advance on actions.
 */
import { G } from './state'
import { addToast } from './fx'
import { Store } from '../utils/store'
import { isTouch } from '../platform'

export function tutorialTick(real: number): void {
  const tut = G.tut
  if (!tut) return
  tut.t += real
  if (Math.abs(G.pv) > 0.6) tut.moved += real
  switch (tut.phase) {
    case 0:
      tut.prompt = isTouch ? 'HOLD LEFT / RIGHT TO STEER' : '← →  HOLD TO STEER'
      if (tut.moved > 0.7) tut.phase = 1
      break
    case 1:
      tut.prompt = 'PASS THROUGH THE GAP'
      if (G.wallCount >= 2 && G.grazeTimer < 5 && G.score > 0) tut.phase = 2
      if (G.grazeCount >= 1) tut.phase = 2
      break
    case 2:
      tut.prompt = 'GRAZE THE EDGE — CLOSER SCORES MORE'
      if (G.grazeCount >= 2) tut.phase = 3
      break
    case 3:
      tut.prompt = 'GRAZE TO FILL THE SURGE RING'
      if (G.surge >= 0.99) tut.phase = 4
      break
    case 4:
      tut.prompt = isTouch ? 'SURGE FULL — TAP ⚡ FOR OVERDRIVE' : 'SURGE FULL — SPACE FOR OVERDRIVE'
      if (G.overdrive > 0 || G.odUsed > 0) tut.phase = 5
      break
    case 5:
      tut.prompt = ''
      tut.done = tut.done || tut.t
      if (!G.tutDone) {
        G.tutDone = true
        Store.set('brink_tut', 'done')
        addToast("YOU'RE READY", 'g')
      }
      break
  }
}
