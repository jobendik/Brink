/**
 * Ambient declarations for host-provided globals that aren't part of the
 * standard DOM lib: the optional Claude-artifact `window.storage` shim, the
 * webkit-prefixed AudioContext, and the (optional) CrazyGames portal SDK.
 */
export {}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
    storage?: {
      get(key: string): Promise<{ value: string } | null>
      set(key: string, value: string): Promise<void>
    }
    CrazyGames?: {
      SDK?: {
        init?: () => Promise<void>
        game?: {
          sdkGameLoadingStart?: () => void
          sdkGameLoadingStop?: () => void
          gameplayStart?: () => void
          gameplayStop?: () => void
          happytime?: () => void
        }
      }
    }
  }
}
