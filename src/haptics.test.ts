import { describe, it, expect, vi, afterEach } from 'vitest';
import { triggerHaptic, HAPTIC_TAP, RARITY_HAPTIC_PATTERNS } from './haptics';

describe('triggerHaptic', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls navigator.vibrate with the given pattern when supported', () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });

    triggerHaptic(HAPTIC_TAP);

    expect(vibrate).toHaveBeenCalledWith(HAPTIC_TAP);
  });

  it('does nothing when navigator.vibrate is unavailable (e.g. iOS Safari)', () => {
    vi.stubGlobal('navigator', {});
    expect(() => triggerHaptic(HAPTIC_TAP)).not.toThrow();
  });

  it('swallows errors thrown by navigator.vibrate', () => {
    vi.stubGlobal('navigator', {
      vibrate: () => {
        throw new Error('nope');
      },
    });
    expect(() => triggerHaptic(HAPTIC_TAP)).not.toThrow();
  });

  it('has a distinct, escalating pattern per rarity tier', () => {
    expect(RARITY_HAPTIC_PATTERNS.common).toBe(15);
    expect(RARITY_HAPTIC_PATTERNS.legendary).toEqual([30, 40, 30, 40, 30, 40, 50]);
  });
});
