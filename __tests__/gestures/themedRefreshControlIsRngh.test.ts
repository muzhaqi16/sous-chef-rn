import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `ThemedRefreshControl` is the single place the RNGH-vs-RN choice is made for
 * every list, so `sous-chef/rngh-refresh-control-matches-host` exempts this one
 * module — and this is what holds it instead.
 *
 * RNGH's ScrollView hands its scroll gesture on as
 * `cloneElement(refreshControl, { block })`, which only a control built by
 * `createNativeWrapper` routes into `useNativeGesture`. Built on React Native's
 * control the prop is inert: no error, no warning, and a spinner that hangs
 * mid-list.
 */
const source = readFileSync(
  join(process.cwd(), 'src/components/atoms/themedComponents.tsx'),
  'utf8',
);

describe('ThemedRefreshControl', () => {
  it('is built on RNGH, not React Native', () => {
    expect(source).toMatch(
      /import\s*\{[^}]*\bRefreshControl\b[^}]*\}\s*from\s*'react-native-gesture-handler'/,
    );
  });

  it('keeps a counterpart for plain RN scrollable hosts', () => {
    // Without it, a plain host has nothing to use: the RNGH control throws there.
    expect(source).toContain('PlainScrollRefreshControl');
  });
});
