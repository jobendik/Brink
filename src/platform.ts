/** Coarse pointer / touch capability detection (read once at load). */
export const isTouch: boolean =
  'ontouchstart' in window || navigator.maxTouchPoints > 0
