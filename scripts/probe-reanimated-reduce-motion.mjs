#!/usr/bin/env node
/**
 * Does `withTiming` / `withSpring` honour the OS reduce-motion setting on its
 * own, or does a call site have to branch?
 *
 * The answer decides whether motion tokens need reduced twins. Reads the
 * installed source rather than reasoning from the docs.
 *
 *   node scripts/probe-reanimated-reduce-motion.mjs
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = require
  .resolve('react-native-reanimated/package.json')
  .replace(/package\.json$/, '');
const version = require('react-native-reanimated/package.json').version;

const read = rel => readFileSync(`${root}${rel}`, 'utf8');

const common = read('lib/module/animation/utilCommon.js');
const defaultsToSystem =
  /!config \|\| config === ReduceMotion\.System \? isReduceMotionOnUI\.value/.test(
    common,
  );

const applied = [
  { name: 'withTiming', file: 'lib/module/animation/timing.js' },
  { name: 'withSpring', file: 'lib/module/animation/spring/spring.js' },
  { name: 'withRepeat', file: 'lib/module/animation/repeat.js' },
].map(({ name, file }) => ({
  name,
  wired: /getReduceMotionForAnimation\(/.test(read(file)),
}));

const builder = read(
  'lib/module/layoutReanimation/animationBuilder/BaseAnimationBuilder.js',
);
const layoutDefault = /reduceMotionV = ReduceMotion\.System/.test(builder);

console.log(`react-native-reanimated@${version}`);
console.log(`  no config resolves to the OS setting: ${defaultsToSystem}`);
for (const { name, wired } of applied) {
  console.log(`  ${name} passes it through: ${wired}`);
}
console.log(`  entering/exiting builders default to System: ${layoutDefault}`);

const allOn = defaultsToSystem && applied.every(a => a.wired) && layoutDefault;
console.log(
  allOn
    ? '\n✓ Reduce motion is applied by the library. A call site needs a branch\n' +
        '  only for what a zero duration cannot stop — a loop or a repeat.'
    : '\n✗ Reduce motion is NOT applied by default; call sites must branch.',
);
process.exit(allOn ? 0 : 1);
