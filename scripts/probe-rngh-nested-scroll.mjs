/**
 * Probe: the RNGH Android behaviours behind the swipeable-row scroll rules.
 *
 * HARD CHECK — `cancelAllLegacyHandlers()` matches only the v1/v2 action types,
 * so a v3 detector pan survives a native scroll takeover. That is why every
 * FlashList whose rows carry RNGH gestures must render RNGH's ScrollView.
 *
 * REPORTED ONLY — whether `ScrollViewHook` ends the nested scroll it opens
 * (`shouldStopNestedScroll`). That is the upstream fix for the parked Android
 * refresh spinner, present since 3.3.0. The app still forces
 * `nestedScrollEnabled={false}` regardless, so this cannot fail the probe; it
 * is here because it says whether dropping that override is worth re-testing.
 *
 * Both are Kotlin the app never imports, so nothing else in the tree notices
 * when a bump changes them.
 */
import { readFileSync } from 'node:fs';

const CORE =
  'node_modules/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/core';

const read = name => readFileSync(`${CORE}/${name}`, 'utf8');

/** The body of a `private class <name>` up to the next class at that indent. */
const classBody = (source, name) => {
  const start = source.indexOf(`private class ${name}`);
  if (start === -1) return null;
  const rest = source.slice(start + 1);
  const end = rest.indexOf('\n  private class ');
  return end === -1 ? rest : rest.slice(0, end);
};

const failures = [];

// Hard check: the legacy-only cancellation still skips the v3 detectors.
const orchestrator = read('GestureHandlerOrchestrator.kt');
const cancelStart = orchestrator.indexOf('fun cancelAllLegacyHandlers()');
const cancelBody =
  cancelStart === -1
    ? null
    : orchestrator.slice(cancelStart, cancelStart + 400);

const handler = read('GestureHandler.kt');
const detectorConstants = [
  'ACTION_TYPE_NATIVE_DETECTOR',
  'ACTION_TYPE_VIRTUAL_DETECTOR',
];

if (cancelBody === null) {
  failures.push(
    'cancelAllLegacyHandlers not found in GestureHandlerOrchestrator.kt',
  );
} else {
  for (const constant of detectorConstants) {
    if (!handler.includes(`const val ${constant}`)) {
      failures.push(`${constant} is gone from GestureHandler.kt`);
    }
    if (cancelBody.includes(constant)) {
      failures.push(
        `cancelAllLegacyHandlers now cancels ${constant}. A native scroll ` +
          'takeover may cancel a row pan on its own — re-measure before ' +
          'relying on renderScrollComponent for arbitration.',
      );
    }
  }
}

// Reported only: the upstream fix for the parked refresh spinner.
const scrollViewHook = classBody(
  read('NativeViewGestureHandler.kt'),
  'ScrollViewHook',
);
const stopsNestedScroll =
  scrollViewHook !== null &&
  /override fun shouldStopNestedScroll\(\)\s*=\s*true/.test(scrollViewHook);

const version = JSON.parse(
  readFileSync(
    'node_modules/react-native-gesture-handler/package.json',
    'utf8',
  ),
).version;

console.log(`react-native-gesture-handler@${version}`);
console.log(
  'cancelAllLegacyHandlers skips v3 detectors:  ',
  cancelBody !== null && !detectorConstants.some(c => cancelBody.includes(c)),
);
console.log('ScrollViewHook stops its nested scroll:      ', stopsNestedScroll);
if (stopsNestedScroll) {
  console.log(
    '\n  Upstream carries the parked-spinner fix. Dropping\n' +
      '  `nestedScrollEnabled={false}` from SwipeAwareScrollComponent is a\n' +
      '  candidate, but only a real-finger A/B can settle it — a synthetic\n' +
      '  hesitant pull does not reproduce the park even on 3.2.1.',
  );
}

if (failures.length > 0) {
  console.error(`\nFAIL\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\nPASS — the takeover rule holds in the installed version.');
