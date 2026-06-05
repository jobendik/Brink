# BRINK · Edge Rush

A neon arcade survival game for mobile and desktop. Orbit the reactor core,
thread collapsing compression waves, **graze the edges** to charge Surge, and
unleash **Overdrive**. Features a deterministic daily anomaly and an endless
mode. Rendered on a single `<canvas>` with a procedural Web Audio soundtrack —
no art or audio assets.

> Originally a single-file HTML prototype, now a professionally structured,
> fully-typed (TypeScript) Vite project.

## Play

- **Steer:** hold the left / right halves of the screen, or use `←` / `→`
  (also `A` / `D`).
- **Overdrive:** tap the `⚡` button (touch) or press `Space` / `↑` when the
  Surge ring is full.
- **Graze:** pass as close to a wall edge as you dare — closer grazes score
  more, build your multiplier and charge Surge.
- **Mute:** tap the speaker icon or press `M`.

## Tech stack

- [Vite](https://vite.dev/) for dev server and production bundling
- [TypeScript](https://www.typescriptlang.org/) in `strict` mode
- Zero runtime dependencies — Canvas 2D + Web Audio only

## Project structure

```
src/
├── main.ts              # entry: boot + main loop
├── style.css            # global styles (safe-area aware)
├── global.d.ts          # ambient types (window.storage, CrazyGames SDK)
├── platform.ts          # touch capability detection
├── types.ts             # shared entity/config interfaces
├── utils/
│   ├── math.ts          # clamp, lerp, angles, colour helpers
│   ├── rng.ts           # seedable PRNG + date helpers (daily determinism)
│   └── store.ts         # persistence shim (window.storage | localStorage)
├── audio/
│   └── engine.ts        # procedural synth + reactive sequencer
├── render/
│   ├── canvas.ts        # context, viewport metrics, geometry, primitives
│   ├── glow.ts          # pre-rendered glow sprites
│   └── render.ts        # full scene + HUD + menu/dead/pause draw
├── game/
│   ├── constants.ts     # ranks, graze tiers, anomalies, states
│   ├── state.ts         # the mutable game state `G`
│   ├── fx.ts            # shared toast/particle helpers
│   ├── spawn.ts         # wall spawning + pattern scheduler
│   ├── update.ts        # per-frame simulation
│   ├── tutorial.ts      # staged coaching
│   └── lifecycle.ts     # run start / death / menu
└── input/
    └── input.ts         # keyboard + pointer handling
```

## Local development

```bash
npm install
npm run dev        # start the Vite dev server (http://localhost:5173)
npm run build      # type-check + production build into dist/
npm run preview    # preview the production build locally
npm run type-check # tsc --noEmit only
```

## Deployment (GitHub Pages)

This repo ships a GitHub Actions workflow at
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) that builds and
deploys to GitHub Pages on every push to `main`.

One-time setup: in the repository **Settings → Pages**, set **Source** to
**GitHub Actions**.

The Vite `base` is set to `/Brink/` so assets resolve correctly at
`https://<user>.github.io/Brink/`. If you host at a domain root instead, build
with `VITE_BASE=/ npm run build`.

## License

MIT
