/**
 * BRINK · Edge Rush — entry point. Wires up boot (persisted state + CrazyGames
 * lifecycle), the fixed render/update main loop, and imports the input module
 * for its side-effect event listeners.
 */
import './style.css'
import { dateOffsetStr, todayStr } from './utils/rng'
import { Store } from './utils/store'
import { resize } from './render/canvas'
import { G } from './game/state'
import { Audio_ } from './audio/engine'
import { update } from './game/update'
import { render } from './render/render'
import { hydrateSettings } from './game/settings'
import './input/input'

let last = performance.now()
function frame(now: number): void {
  let dt = (now - last) / 1000
  last = now
  if (dt > 0.05) dt = 0.05
  update(dt)
  render()
  requestAnimationFrame(frame)
}

async function boot(): Promise<void> {
  resize()
  registerServiceWorker()
  window.CrazyGames?.SDK?.game?.sdkGameLoadingStart?.()

  await hydrateSettings()

  const mute = await Store.get('brink_mute')
  if (mute === '1') Audio_.muted = true

  const tut = await Store.get('brink_tut')
  if (tut === 'done') G.tutDone = true

  const b = await Store.get('brink_best')
  if (b) G.best = parseInt(b) || 0

  const td = await Store.get('brink_today')
  if (td) {
    const [d, s] = td.split('|')
    if (d === todayStr()) G.todayBest = parseInt(s) || 0
    else if (d === dateOffsetStr(-1)) G.yest = parseInt(s) || 0
  }

  const st = await Store.get('brink_streak')
  if (st) {
    const [c, d] = st.split('|')
    G.streak = parseInt(c) || 0
    G.streakLast = d
    if (d !== todayStr() && d !== dateOffsetStr(-1)) G.streak = 0
  }

  const bootEl = document.getElementById('boot')
  if (bootEl) bootEl.style.display = 'none'

  window.CrazyGames?.SDK?.game?.sdkGameLoadingStop?.()
  requestAnimationFrame(frame)
}

/** Register the offline service worker (production builds only). */
function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {})
  })
}

boot()
