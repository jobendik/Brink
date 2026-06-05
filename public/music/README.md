# Music

Drop a looping track here named **`brink-loop.mp3`**:

```
public/music/brink-loop.mp3
```

That's it — it will play automatically during runs (replacing the built-in
procedural synth bed; the sound **effects** keep firing over it). Mute and the
in-game audio controls affect it too.

- If the file is missing, the game falls back to its procedural soundtrack —
  nothing breaks.
- Formats: **MP3** (best browser support). `.ogg`/`.m4a` also work on most
  browsers — if you use a different file name or extension, change `MUSIC_URL`
  in [`src/main.ts`](../../src/main.ts).
- Aim for a seamless loop, ~60–120 s, 132 BPM, A minor (see the Suno prompt in
  the project notes).
