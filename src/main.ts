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
import { STATE } from './game/constants'
import './input/input'

/**
 * Optional looping music track. Drop an MP3 at `public/music/brink-loop.mp3`
 * and it plays during runs (replacing the built-in synth bed). If the file is
 * absent the game keeps its procedural soundtrack — nothing breaks.
 * Set to '' to force the procedural soundtrack.
 */
const MUSIC_URL = `${import.meta.env.BASE_URL}music/brink-loop.mp3`

let last = performance.now()
let prevState = G.state
function frame(now: number): void {
  let dt = (now - last) / 1000
  last = now
  if (dt > 0.05) dt = 0.05
  update(dt)
  render()
  // music follows the run: play during PLAYING, pause otherwise
  if (G.state !== prevState) {
    if (G.state === STATE.PLAYING) {
      if (prevState === STATE.PAUSE) Audio_.resumeMusic()
      else Audio_.restartMusic()
    } else {
      Audio_.pauseMusic()
    }
    prevState = G.state
  }
  requestAnimationFrame(frame)
}

async function boot(): Promise<void> {
  resize()
  registerServiceWorker()
  window.CrazyGames?.SDK?.game?.sdkGameLoadingStart?.()

  await hydrateSettings()
  if (MUSIC_URL) Audio_.setMusicTrack(MUSIC_URL)

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
