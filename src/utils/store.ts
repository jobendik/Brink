/**
 * Persistence shim: prefers the Claude-artifact `window.storage` API when
 * present, otherwise falls back to `localStorage`. All access is async so the
 * two backends share one interface.
 */
export const Store = {
  async get(k: string): Promise<string | null> {
    try {
      if (typeof window !== 'undefined' && window.storage && window.storage.get) {
        const r = await window.storage.get(k)
        return r ? r.value : null
      }
    } catch (e) {
      /* ignore */
    }
    try {
      return localStorage.getItem(k)
    } catch (e) {
      return null
    }
  },

  async set(k: string, v: string | number | boolean): Promise<void> {
    const value = String(v)
    try {
      if (typeof window !== 'undefined' && window.storage && window.storage.set) {
        await window.storage.set(k, value)
        return
      }
    } catch (e) {
      /* ignore */
    }
    try {
      localStorage.setItem(k, value)
    } catch (e) {
      /* ignore */
    }
  },
}
