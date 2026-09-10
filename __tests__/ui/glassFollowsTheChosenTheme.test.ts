import { readFileSync } from 'fs';

/**
 * A theme picked IN THE APP moves `rt.themeName`; it does not move
 * `rt.colorScheme`, which follows the OS. `useTheme` and `RootNavigator` both
 * resolve `themeName` first, and the glass material must agree with them — it
 * paints the tab bar and the header, so reading only `colorScheme` left a light
 * bar under a dark theme with its labels unreadable.
 */
const SOURCE = readFileSync('src/components/atoms/GlassSurface.tsx', 'utf8');

it('resolves the glass scheme from the chosen theme, not just the OS', () => {
  const scheme = /const scheme =\s*([\s\S]*?);/.exec(SOURCE)?.[1];

  expect(scheme).toBeTruthy();
  expect(scheme).toContain('rt.themeName');
});

it('still falls back to the OS scheme when no theme is chosen', () => {
  const scheme = /const scheme =\s*([\s\S]*?);/.exec(SOURCE)?.[1] ?? '';

  expect(scheme).toContain('rt.colorScheme');
});

it('agrees with how the rest of the app resolves the theme', () => {
  // Same precedence, so the glass cannot drift from the navigator's chrome.
  const useTheme = readFileSync('src/features/profile/hooks/useTheme.ts', 'utf8');

  expect(useTheme).toMatch(/rt\.themeName \|\| rt\.colorScheme/);
});
