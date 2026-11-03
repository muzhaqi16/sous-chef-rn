/**
 * Two Android behaviours of the INSTALLED react-native-gesture-handler, both
 * Kotlin the app never imports, so nothing else notices when a bump changes them.
 *
 * A native scroll taking the touch cancels every v3 detector gesture that has
 * not activated, so a swipeable row stays shut through a drifting scroll.
 * Verified: #a-native-scroll-takeover-cancels-a-pending-rngh-v3-gesture
 *
 * RNGH ends the nested scroll its ScrollView opens. `SwipeAwareScrollComponent`
 * still forces `nestedScrollEnabled={false}` over React Native's `true`
 * default; a failure here means that entry is stale, not that the override breaks.
 * Verified: #rngh-ends-the-nested-scroll-its-scrollview-opens
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';

const CORE = join(
  dirname(require.resolve('react-native-gesture-handler/package.json')),
  'android/src/main/java/com/swmansion/gesturehandler/core',
);

const readCore = (name: string): string =>
  readFileSync(join(CORE, name), 'utf8');

const orchestrator = readCore('GestureHandlerOrchestrator.kt');

/** The body of a member `fun <name>(` up to the next member at that indent. */
const funBody = (source: string, name: string): string | null => {
  const start = source.indexOf(`fun ${name}(`);
  if (start === -1) return null;
  const rest = source.slice(start);
  const end = rest.search(/\n {2}(?:fun |\/\*\*|private |override )/);
  return end === -1 ? rest : rest.slice(0, end);
};

/** The body of a `private class <name>` up to the next class at that indent. */
const classBody = (source: string, name: string): string | null => {
  const start = source.indexOf(`private class ${name}`);
  if (start === -1) return null;
  const rest = source.slice(start + 1);
  const end = rest.indexOf('\n  private class ');
  return end === -1 ? rest : rest.slice(0, end);
};

describe('a native scroll takeover', () => {
  it('treats native and virtual detectors as v3 detectors', () => {
    const detectorTest =
      /fun usesNativeOrVirtualDetector\([^)]*\)[^=]*=\s*(.+)/.exec(
        readCore('GestureHandler.kt'),
      )?.[1];

    expect(detectorTest).toContain('ACTION_TYPE_NATIVE_DETECTOR');
    expect(detectorTest).toContain('ACTION_TYPE_VIRTUAL_DETECTOR');
  });

  it.each([
    'cancelHandlersOnNativeTouchGrab',
    'cancelHandlersOnNativeTouchCancel',
  ])('%s cancels a detector handler that has not activated', name => {
    const body = funBody(orchestrator, name);

    expect(body).toContain('!it.isActive');
    expect(body).toContain('usesNativeOrVirtualDetector(it.actionType)');
  });
});

describe("RNGH's ScrollView and the nested scroll", () => {
  const handler = readCore('NativeViewGestureHandler.kt');

  it('opts its ScrollView hook into stopping the nested scroll', () => {
    expect(classBody(handler, 'ScrollViewHook')).toMatch(
      /override fun shouldStopNestedScroll\(\)\s*=\s*true/,
    );
  });

  it('stops it when the gesture ends, and in a view the root cancels', () => {
    expect(handler).toMatch(
      /if \(shouldStopNestedScroll\(\)\) \{\s*view\.stopNestedScroll\(\)/,
    );
    expect(orchestrator).toMatch(
      /view\.onTouchEvent\(cancelEvent\)\s*view\.stopNestedScroll\(\)/,
    );
  });

  it('is turned on by React Native under a refreshControl unless set false', () => {
    const scrollView = readFileSync(
      join(
        dirname(require.resolve('react-native/package.json')),
        'Libraries/Components/ScrollView/ScrollView.js',
      ),
      'utf8',
    );

    expect(scrollView).toContain(
      'nestedScrollEnabled={props.nestedScrollEnabled ?? true}',
    );
  });
});
