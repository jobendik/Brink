import { defineConfig } from 'vite'

// https://vite.dev/config/
// `base` is set to the repository name so the production build works when
// served from GitHub Pages at https://<user>.github.io/Brink/.
// Override locally with `--base=/` if you ever host at a domain root.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/Brink/',
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    host: true,
    port: 5173,
  },
})
