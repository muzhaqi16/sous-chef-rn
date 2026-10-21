import type { EffectCallback } from 'react';
import { requirePlatform } from './install';
import type { NavigationIntents } from './ports';

/**
 * The host's screen hooks, looked up on each call so importing this reads no
 * platform service. The host installs them once, so each call reaches the
 * same hook and the rules of hooks hold.
 */
export function useNavigationIntents(): NavigationIntents {
  return requirePlatform('screen').useNavigationIntents();
}

export function useScreenFocusEffect(effect: EffectCallback): void {
  requirePlatform('screen').useScreenFocusEffect(effect);
}
