/**
 * The INSTALLED Reanimated resolves an animation that passes no `reduceMotion`
 * to the OS setting, in `withTiming`, `withSpring`, `withRepeat` and the
 * entering/exiting builders. That is why `src/theme/motion.ts` has no reduced
 * twin of each token and no call site branches on reduce motion.
 * Verified: #reanimated-applies-reduce-motion-itself
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';

const ROOT = dirname(require.resolve('react-native-reanimated/package.json'));

const read = (relative: string): string =>
  readFileSync(join(ROOT, relative), 'utf8');

describe('react-native-reanimated reduce motion', () => {
  it('resolves an animation with no config to the OS setting', () => {
    expect(read('lib/module/animation/utilCommon.js')).toMatch(
      /!config \|\| config === ReduceMotion\.System \? isReduceMotionOnUI\.value/,
    );
  });

  it.each([
    ['withTiming', 'lib/module/animation/timing.js'],
    ['withSpring', 'lib/module/animation/spring/spring.js'],
    ['withRepeat', 'lib/module/animation/repeat.js'],
  ])('%s passes its config through that resolution', (_name, file) => {
    expect(read(file)).toMatch(/getReduceMotionForAnimation\(/);
  });

  it('defaults the entering/exiting builders to the OS setting', () => {
    expect(
      read(
        'lib/module/layoutReanimation/animationBuilder/BaseAnimationBuilder.js',
      ),
    ).toMatch(/reduceMotionV = ReduceMotion\.System/);
  });
});
