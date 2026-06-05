/**
 * Procedural synth + reactive sequencer. The bed builds with Surge; grazes
 * climb in pitch by tier; milestones add flourishes; Overdrive drops the bass;
 * danger raises a heartbeat. No samples — every voice is generated live.
 */
import { clamp, smooth } from '../utils/math'
import { Store } from '../utils/store'
import { G } from '../game/state'

export const Audio_ = {
  ctx: null as AudioContext | null,
  master: null as GainNode | null,
  comp: null as DynamicsCompressorNode | null,
  noise: null as AudioBuffer | null,
  muted: false,
  bpm: 132,
  step: 0,
  nextTime: 0,
  timer: null as ReturnType<typeof setInterval> | null,
  running: false,
  PENT: [0, 3, 5, 7, 10] as number[],

  // optional streamed music track. When it plays, it replaces the procedural
  // bed (the SFX keep firing). Routed through `master`, so mute affects it too.
  music: null as HTMLAudioElement | null,
  musicSrc: null as MediaElementAudioSourceNode | null,
  musicGain: null as GainNode | null,
  musicActive: false,

  init(): void {
    if (this.ctx) return
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    const ctx = (this.ctx = new AC())
    this.comp = ctx.createDynamicsCompressor()
    this.comp.threshold.value = -14
    this.comp.knee.value = 24
    this.comp.ratio.value = 6
    this.comp.attack.value = 0.003
    this.comp.release.value = 0.18
    this.master = ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 0.9
    this.master.connect(this.comp)
    this.comp.connect(ctx.destination)
    const n = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate)
    const d = n.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    this.noise = n
  },

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume()
  },

  setMuted(m: boolean): void {
    this.muted = m
    if (this.master && this.ctx)
      this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.02)
    Store.set('brink_mute', m ? '1' : '0')
  },

  now(): number {
    return this.ctx ? this.ctx.currentTime : 0
  },

  /* --- streamed music track (optional) --- */
  setMusicTrack(url: string): void {
    if (!url) return
    if (!this.music) {
      const el = new Audio()
      el.loop = true
      el.preload = 'auto'
      this.music = el
    }
    this.music.src = url
  },

  /** Play the track (creating its audio graph once). `fromStart` restarts it. */
  playMusic(fromStart: boolean): void {
    const el = this.music
    if (!el) return
    this.init()
    this.resume()
    if (this.ctx && this.master && !this.musicSrc) {
      try {
        this.musicGain = this.ctx.createGain()
        this.musicGain.gain.value = 0.55
        this.musicSrc = this.ctx.createMediaElementSource(el)
        this.musicSrc.connect(this.musicGain)
        this.musicGain.connect(this.master)
      } catch (e) {
        /* ignore */
      }
    }
    if (fromStart) {
      try {
        el.currentTime = 0
      } catch (e) {
        /* ignore */
      }
    }
    const p = el.play()
    if (p && typeof p.then === 'function') {
      p.then(() => {
        this.musicActive = true
        this.stop() // real music took over — silence the procedural bed
      }).catch(() => {
        /* no track present / autoplay blocked — keep the procedural bed */
      })
    }
  },

  restartMusic(): void {
    this.playMusic(true)
  },
  resumeMusic(): void {
    this.playMusic(false)
  },
  pauseMusic(): void {
    if (this.music) this.music.pause()
  },

  /* --- voices --- */
  kick(t: number, g = 0.9): void {
    const c = this.ctx!
    const o = c.createOscillator()
    const a = c.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(150, t)
    o.frequency.exponentialRampToValueAtTime(45, t + 0.1)
    a.gain.setValueAtTime(0.0001, t)
    a.gain.exponentialRampToValueAtTime(g, t + 0.004)
    a.gain.exponentialRampToValueAtTime(0.0001, t + 0.32)
    o.connect(a)
    a.connect(this.master!)
    o.start(t)
    o.stop(t + 0.34)
  },

  bass(t: number, freq: number, g = 0.45, dur = 0.18): void {
    const c = this.ctx!
    const o = c.createOscillator()
    const f = c.createBiquadFilter()
    const a = c.createGain()
    o.type = 'sawtooth'
    o.frequency.value = freq
    f.type = 'lowpass'
    f.frequency.value = 520
    f.Q.value = 6
    a.gain.setValueAtTime(0.0001, t)
    a.gain.exponentialRampToValueAtTime(g, t + 0.012)
    a.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(f)
    f.connect(a)
    a.connect(this.master!)
    o.start(t)
    o.stop(t + dur + 0.02)
  },

  pluck(t: number, freq: number, g = 0.18, dur = 0.16, type: OscillatorType = 'triangle'): void {
    const c = this.ctx!
    const o = c.createOscillator()
    const a = c.createGain()
    o.type = type
    o.frequency.value = freq
    a.gain.setValueAtTime(0.0001, t)
    a.gain.exponentialRampToValueAtTime(g, t + 0.006)
    a.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(a)
    a.connect(this.master!)
    o.start(t)
    o.stop(t + dur + 0.02)
  },

  hat(t: number, g = 0.1): void {
    const c = this.ctx!
    const s = c.createBufferSource()
    const f = c.createBiquadFilter()
    const a = c.createGain()
    s.buffer = this.noise
    f.type = 'highpass'
    f.frequency.value = 8000
    a.gain.setValueAtTime(g, t)
    a.gain.exponentialRampToValueAtTime(0.0001, t + 0.045)
    s.connect(f)
    f.connect(a)
    a.connect(this.master!)
    s.start(t)
    s.stop(t + 0.06)
  },

  lead(t: number, freq: number, g = 0.16, dur = 0.22): void {
    const c = this.ctx!
    const o = c.createOscillator()
    const o2 = c.createOscillator()
    const f = c.createBiquadFilter()
    const a = c.createGain()
    o.type = 'sawtooth'
    o2.type = 'square'
    o.frequency.value = freq
    o2.frequency.value = freq * 1.005
    f.type = 'lowpass'
    f.frequency.setValueAtTime(2600, t)
    f.Q.value = 4
    a.gain.setValueAtTime(0.0001, t)
    a.gain.exponentialRampToValueAtTime(g, t + 0.01)
    a.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(f)
    o2.connect(f)
    f.connect(a)
    a.connect(this.master!)
    o.start(t)
    o2.start(t)
    o.stop(t + dur + 0.02)
    o2.stop(t + dur + 0.02)
  },

  /* --- event SFX --- */
  graze(combo: number, pitchOff: number): void {
    if (!this.ctx) return
    const t = this.now() + 0.001
    const idx = combo % this.PENT.length
    const oct = Math.min(3, Math.floor(combo / this.PENT.length))
    const semi = this.PENT[idx] + 12 * oct + (pitchOff || 0)
    const f = 440 * Math.pow(2, semi / 12)
    const g = 0.12 + Math.min(0.1, (pitchOff || 0) * 0.012)
    this.pluck(t, f, g, 0.14, 'triangle')
    this.pluck(t, f * 2, 0.05, 0.09, 'sine')
  },

  flourish(level: number): void {
    if (!this.ctx) return
    const t = this.now()
    const seq = [0, 4, 7, 12, 16, 19, 24]
    const n = Math.min(seq.length, 3 + level)
    for (let i = 0; i < n; i++)
      this.lead(t + i * 0.045, 523.25 * Math.pow(2, seq[i] / 12), 0.13, 0.22)
  },

  heart(level: number): void {
    if (!this.ctx) return
    const t = this.now()
    const c = this.ctx
    const o = c.createOscillator()
    const a = c.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(70, t)
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12)
    a.gain.setValueAtTime(0.0001, t)
    a.gain.exponentialRampToValueAtTime(0.35 * level, t + 0.012)
    a.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    o.connect(a)
    a.connect(this.master!)
    o.start(t)
    o.stop(t + 0.18)
  },

  nearmiss(): void {
    if (!this.ctx) return
    const t = this.now()
    this.lead(t, 880, 0.14, 0.16)
    this.lead(t + 0.04, 1318.5, 0.12, 0.18)
  },

  shield(): void {
    if (!this.ctx) return
    const t = this.now()
    const c = this.ctx
    const s = c.createBufferSource()
    const f = c.createBiquadFilter()
    const a = c.createGain()
    s.buffer = this.noise
    f.type = 'bandpass'
    f.frequency.setValueAtTime(900, t)
    f.frequency.exponentialRampToValueAtTime(3200, t + 0.18)
    f.Q.value = 3
    a.gain.setValueAtTime(0.25, t)
    a.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
    s.connect(f)
    f.connect(a)
    a.connect(this.master!)
    s.start(t)
    s.stop(t + 0.28)
    this.lead(t, 659.25, 0.12, 0.3)
  },

  overdriveStart(): void {
    if (!this.ctx) return
    const t = this.now()
    const c = this.ctx
    const s = c.createBufferSource()
    const f = c.createBiquadFilter()
    const a = c.createGain()
    s.buffer = this.noise
    s.loop = true
    f.type = 'bandpass'
    f.Q.value = 2
    f.frequency.setValueAtTime(400, t)
    f.frequency.exponentialRampToValueAtTime(7000, t + 0.45)
    a.gain.setValueAtTime(0.0001, t)
    a.gain.exponentialRampToValueAtTime(0.18, t + 0.4)
    a.gain.exponentialRampToValueAtTime(0.0001, t + 0.55)
    s.connect(f)
    f.connect(a)
    a.connect(this.master!)
    s.start(t)
    s.stop(t + 0.6)
    const o = c.createOscillator()
    const ga = c.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(180, t + 0.42)
    o.frequency.exponentialRampToValueAtTime(38, t + 0.75)
    ga.gain.setValueAtTime(0.0001, t + 0.42)
    ga.gain.exponentialRampToValueAtTime(1.0, t + 0.46)
    ga.gain.exponentialRampToValueAtTime(0.0001, t + 1.05)
    o.connect(ga)
    ga.connect(this.master!)
    o.start(t + 0.42)
    o.stop(t + 1.1)
    ;[0, 7, 12, 16].forEach((s2) => this.lead(t + 0.46, 440 * Math.pow(2, s2 / 12), 0.1, 0.5))
  },

  overdriveEnd(): void {
    if (!this.ctx) return
    const t = this.now()
    const c = this.ctx
    const o = c.createOscillator()
    const a = c.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(120, t)
    o.frequency.exponentialRampToValueAtTime(300, t + 0.18)
    a.gain.setValueAtTime(0.2, t)
    a.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
    o.connect(a)
    a.connect(this.master!)
    o.start(t)
    o.stop(t + 0.27)
  },

  die(): void {
    if (!this.ctx) return
    const t = this.now()
    const c = this.ctx
    const o = c.createOscillator()
    const f = c.createBiquadFilter()
    const a = c.createGain()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(420, t)
    o.frequency.exponentialRampToValueAtTime(60, t + 0.5)
    f.type = 'lowpass'
    f.frequency.setValueAtTime(2200, t)
    f.frequency.exponentialRampToValueAtTime(300, t + 0.5)
    a.gain.setValueAtTime(0.0001, t)
    a.gain.exponentialRampToValueAtTime(0.5, t + 0.01)
    a.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
    o.connect(f)
    f.connect(a)
    a.connect(this.master!)
    o.start(t)
    o.stop(t + 0.62)
    const s = c.createBufferSource()
    const fa = c.createGain()
    s.buffer = this.noise
    fa.gain.setValueAtTime(0.3, t)
    fa.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
    s.connect(fa)
    fa.connect(this.master!)
    s.start(t)
    s.stop(t + 0.4)
  },

  best(): void {
    if (!this.ctx) return
    const t = this.now()
    ;[0, 4, 7, 12, 16, 19].forEach((s, i) => {
      this.lead(t + i * 0.07, 523.25 * Math.pow(2, s / 12), 0.16, 0.3)
    })
  },

  /* --- reactive sequencer --- */
  start(): void {
    if (!this.ctx || this.running) return
    this.running = true
    this.step = 0
    this.nextTime = this.now() + 0.06
    this.timer = setInterval(() => this.sched(), 25)
  },

  stop(): void {
    this.running = false
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  },

  sched(): void {
    if (!this.running) return
    const spb = 60 / this.bpm / 4
    while (this.nextTime < this.now() + 0.11) {
      const s = this.step % 16
      const t = this.nextTime
      const surge = G.surge
      const od = G.overdrive > 0
      const intensity = clamp(surge, 0, 1)
      if (s % 4 === 0) this.kick(t, 0.95)
      const roots = [55, 55, 55, 82.41, 55, 55, 73.42, 55]
      if (s % 2 === 0) this.bass(t, roots[(s / 2) % 8], 0.42 + 0.06 * intensity, 0.16)
      if (intensity > 0.18 && s % 2 === 1) this.hat(t, 0.06 + 0.06 * intensity)
      if (intensity > 0.6 && s % 4 === 2) this.hat(t, 0.05)
      if (intensity > 0.3) {
        const seq = [0, 3, 5, 7, 5, 3, 7, 10, 7, 5, 3, 5, 7, 10, 12, 10]
        const semi = seq[s]
        const f = 220 * Math.pow(2, semi / 12)
        this.pluck(t, f, 0.05 + 0.13 * smooth(0.3, 0.85, intensity), 0.12, 'square')
      }
      if (od) {
        const seq2 = [12, 12, 19, 16, 12, 15, 19, 24, 19, 16, 15, 12, 19, 24, 16, 12]
        this.lead(t, 220 * Math.pow(2, seq2[s] / 12), 0.11, 0.16)
      }
      this.nextTime += spb
      this.step++
    }
  },
}
