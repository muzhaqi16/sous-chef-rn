import { requirePlatform } from './install';

/**
 * The host's screen hooks, read once at evaluation so each export is a plain
 * hook binding. Only hooks import this, and they evaluate after the install.
 */
export const { useNavigationIntents, useScreenFocusEffect } =
  requirePlatform('screen');
