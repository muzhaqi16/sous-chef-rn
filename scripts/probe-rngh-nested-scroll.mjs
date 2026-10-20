/**
 * Probe: the RNGH Android behaviours behind the swipeable-row scroll rules.
 *
 * HARD CHECK — `cancelHandlersOnNativeTouchGrab()` cancels a v3 detector
 * handler that has not activated, so a native scroll taking the touch ends a
 * row's pending pan or press (RNGH 3.4.0, #4582). Before that only
 * `cancelAllLegacyHandlers()` ran, which matches v1/v2 alone: the row's pan
 * survived the takeover and opened mid-scroll.
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

/** The body of a member `fun <name>(` up to the next member at that indent. */
const funBody = (source, name) => {
  const start = source.indexOf(`fun ${name}(`);
  if (start === -1) return null;
  const rest = source.slice(start);
  const end = rest.search(/\n {2}(?:fun |\/\*\*|private |override )/);
  return end === -1 ? rest : rest.slice(0, end);
};

const failures = [];

// Hard check: a native touch grab cancels the detectors' pending handlers.
const grabBody = funBody(
  read('GestureHandlerOrchestrator.kt'),
  'cancelHandlersOnNativeTouchGrab',
);
const detectorTest =
  /fun usesNativeOrVirtualDetector\([^)]*\)[^=]*=\s*(.+)/.exec(
    read('GestureHandler.kt'),
  )?.[1];

const cancelsPendingDetectors =
  grabBody !== null &&
  grabBody.includes('usesNativeOrVirtualDetector(it.actionType)') &&
  grabBody.includes('!it.isActive') &&
  detectorTest !== undefined &&
  ['ACTION_TYPE_NATIVE_DETECTOR', 'ACTION_TYPE_VIRTUAL_DETECTOR'].every(c =>
    detectorTest.includes(c),
  );

if (grabBody === null) {
  failures.push(
    'cancelHandlersOnNativeTouchGrab not found in GestureHandlerOrchestrator.kt',
  );
} else if (!cancelsPendingDetectors) {
  failures.push(
    'cancelHandlersOnNativeTouchGrab no longer cancels pending v3 detector ' +
      'handlers. A row pan may survive a native scroll takeover again, and ' +
      'SwipeAwareScrollComponent becomes the only arbitration — re-measure.',
  );
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
  'Native touch grab cancels pending detectors:',
  cancelsPendingDetectors,
);
console.log('ScrollViewHook stops its nested scroll:     ', stopsNestedScroll);
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
console.log(
  '\nPASS — a native scroll takeover cancels a pending row gesture in the ' +
    'installed version.',
);
