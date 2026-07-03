import type { Rarity } from './utils/speciesHash';

/**
 * Thin wrapper around the Vibration API. Only Android Chrome/Firefox
 * implement `navigator.vibrate` — iOS Safari has never supported it (no web
 * API exposes haptics on iOS at all), so this is a silent no-op there, not a
 * broken feature. Wrapped in try/catch since some browsers throw rather than
 * no-op when called outside a user gesture or with an invalid pattern.
 */
export function triggerHaptic(pattern: number | number[]): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Some browsers throw for patterns they don't like — feedback is
    // best-effort and never worth surfacing an error for.
  }
}

/** Routine tap confirmation — wizard attribute picks, result-screen buttons. */
export const HAPTIC_TAP = 12;

/**
 * Tiered by rarity so a legendary reveal feels more physically rewarding
 * than a common one, without a routine tap and a top-tier reveal feeling
 * identical. Patterns are `[vibrate, pause, vibrate, ...]` ms.
 */
export const RARITY_HAPTIC_PATTERNS: Record<Rarity, number | number[]> = {
  common: 15,
  uncommon: 15,
  rare: [20, 30, 20],
  epic: [25, 30, 25, 30, 25],
  legendary: [30, 40, 30, 40, 30, 40, 50],
};
