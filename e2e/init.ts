// Side-effect import; the globals come from detox/globals.d.ts.
import 'detox';
import { element, by, waitFor } from 'detox';
import { execSync } from 'child_process';
import './config/setup';

jest.setTimeout(120000);

/**
 * Reaches a localhost API from the Android emulator: 8081 is Metro, 4000 the
 * local API. Staging/production runs read their host from .env and need none
 * of this.
 */
function setupAdbReverseForLocalTesting() {
  try {
    if (device.getPlatform() === 'android') {
      console.log('🔧 Setting up ADB reverse for local development...');
      execSync('adb reverse tcp:8081 tcp:8081', { stdio: 'pipe' });
      execSync('adb reverse tcp:4000 tcp:4000', { stdio: 'pipe' });
      console.log('✅ ADB reverse setup complete (ports 8081, 4000)');
    }
  } catch (error) {
    console.log('⚠️ Could not setup ADB reverse (this is expected for iOS or if no emulator is connected)');
  }
}

/**
 * Whether an environment variable asks for something to be ON. Presence is not
 * the question: `E2E_TELEMETRY=0` is how anyone would write "off", and a
 * truthiness check on the raw string reads it as on.
 */
const isTruthyEnv = (value: string | undefined): boolean =>
  value !== undefined && !['', '0', 'false', 'no', 'off'].includes(value.toLowerCase());

/**
 * Launches with synchronization off: Detox's FabricUIManagerIdlingResources
 * reads an `mMountItemDispatcher` field that RN 0.82+ does not have. Sync then
 * stays off for the whole run — see the note at the end of this function.
 * @see https://github.com/wix/Detox/issues/4506
 */
export async function launchAppWithFabricWorkaround(options: any = {}) {
  await device.launchApp({
    ...options,
    launchArgs: {
      ...options.launchArgs,
      detoxEnableSynchronization: 0, // Disable sync during launch
      detoxDisableBackgroundServices: 1, // Disable timers that block Detox idle detection
      // Telemetry stays off by default; E2E_TELEMETRY=1 keeps it on for a
      // measuring run. Read by VALUE — a presence check cannot express "off",
      // so `E2E_TELEMETRY=0` would turn telemetry ON.
      ...(isTruthyEnv(process.env.E2E_TELEMETRY)
        ? { detoxEnableTelemetry: 1 }
        : {}),
    },
  });

  // The app settles on the landing auth screen (logged out) or the tab bar.
  try {
    await waitFor(element(by.id('landing-auth-screen')))
      .toBeVisible()
      .withTimeout(10000);
  } catch {
    try {
      await waitFor(element(by.id('tab-bar')))
        .toBeVisible()
        .withTimeout(5000);
    } catch {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // The subscriptions socket (ws://localhost:4000/graphql) is held open, which
  // stops Detox sync from ever completing. Blacklist it and its siblings.
  try {
    await device.setURLBlacklist([
      '.*localhost.*graphql.*',
      '.*souschef\\.dev.*graphql.*',
      '.*ws://.*',
      '.*wss://.*',
    ]);
  } catch {
    // setURLBlacklist may not be supported on all platforms
  }

  // Sync stays DISABLED, and it is a trade rather than a necessity. Measured
  // 2026-08-19 on `pantry-crud`: off 9/9 in 330s, on 8/9 in 480s — Detox does
  // reach idle, it just costs ~45% wall-clock plus one test that then waits out
  // a validation alert covering the form. The cost of off is that nothing waits
  // for idle on our behalf, so settling is explicit (see `relaunchToHomeTab`).
  // Element interactions (tap, typeText, …) still work without sync.
}

beforeAll(async () => {
  console.log('🚀 Starting Detox E2E Test Suite');
  console.log(`Platform: ${device.getPlatform()}`);

  setupAdbReverseForLocalTesting();
});

let screenshotCounter = 0;
afterEach(async () => {
  try {
    screenshotCounter++;
    const testName = expect.getState().currentTestName || 'unknown';
    const status = expect.getState().numPassingAsserts > 0 ? 'PASS' : 'FAIL';
    const sanitized = testName
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 100);
    const name = `${screenshotCounter}_${status}_${sanitized}`;
    await device.takeScreenshot(name);
    console.log(`Screenshot: ${name}`);
  } catch {
    // Don't let screenshot failures break tests
  }
});

afterAll(async () => {
  console.log('✅ Detox E2E Test Suite Complete');
});
