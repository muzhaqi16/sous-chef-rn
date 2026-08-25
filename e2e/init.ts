/**
 * Detox initialization file
 *
 * Sets up global configurations and utilities for E2E tests
 */

// Import detox - globals are already declared in detox/globals.d.ts
import 'detox';
import { element, by, waitFor } from 'detox';
import { execSync } from 'child_process';
// Import custom matchers and global error handlers
import './config/setup';

// Global test timeout
jest.setTimeout(120000);

/**
 * Setup ADB reverse for local API testing
 * This is required when running tests against localhost API
 * Not needed for staging/production environments which use .env variables
 */
function setupAdbReverseForLocalTesting() {
  try {
    // Check if we're running on Android
    if (device.getPlatform() === 'android') {
      console.log('🔧 Setting up ADB reverse for local development...');
      // Port 8081: Metro bundler
      execSync('adb reverse tcp:8081 tcp:8081', { stdio: 'pipe' });
      // Port 4000: Local API server
      execSync('adb reverse tcp:4000 tcp:4000', { stdio: 'pipe' });
      console.log('✅ ADB reverse setup complete (ports 8081, 4000)');
    }
  } catch (error) {
    console.log('⚠️ Could not setup ADB reverse (this is expected for iOS or if no emulator is connected)');
  }
}

/**
 * Workaround for Detox + React Native Fabric compatibility issue
 *
 * Issue: Detox's FabricUIManagerIdlingResources tries to access
 * mMountItemDispatcher field that doesn't exist in RN 0.82+
 *
 * Solution: Disable synchronization during launch, wait for app to initialize,
 * then re-enable for test interactions
 *
 * @see https://wix.github.io/Detox/docs/troubleshooting/synchronization
 * @see https://github.com/wix/Detox/issues/4506
 */
export async function launchAppWithFabricWorkaround(options: any = {}) {
  await device.launchApp({
    ...options,
    launchArgs: {
      ...options.launchArgs,
      detoxEnableSynchronization: 0, // Disable sync during launch
      detoxDisableBackgroundServices: 1, // Disable timers that block Detox idle detection
      // `detoxDisableBackgroundServices` used to switch telemetry off too, which
      // left the only deterministic workload in the repo unable to produce a
      // measurement. Set E2E_TELEMETRY=1 to keep it on for a measuring run; the
      // default stays off so ordinary runs are unaffected.
      ...(process.env.E2E_TELEMETRY ? { detoxEnableTelemetry: 1 } : {}),
    },
  });

  // Wait for an actual UI element instead of a fixed delay.
  // The app shows either the landing auth screen (logged out) or the tab bar (logged in).
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
      // Fallback: short delay if neither element appears yet
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Blacklist URLs that cause sync issues (WebSocket connections, long-polling).
  // The app uses ws://localhost:4000/graphql for subscriptions which keeps a
  // persistent connection open, preventing Detox sync from completing.
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

  // Synchronization stays DISABLED — but not for the reason this comment used
  // to give, which was that Fabric's UIManager keeps the run loop busy so Detox
  // "never reaches idle". Measured 2026-08-19 by flipping
  // `detoxEnableSynchronization` to 1 and running `pantry-crud`:
  //
  //   sync off:  9/9,  330s,  1 busy-wait message
  //   sync on:   8/9,  480s,  1 busy-wait message
  //
  // It reaches idle fine. The real trade is ~45% wall-clock for a suite that
  // already runs 5-6 minutes per file, plus one test that then fails because
  // Detox waits out the validation alert and the form is behind it — arguably a
  // MORE accurate observation, and one that needs the test reworked rather than
  // the flag flipped back.
  //
  // The cost of leaving it off is that nothing waits for idle on our behalf, so
  // settling has to be explicit: `relaunchToHomeTab` waits before
  // `reloadReactNative` (a reload landing mid-mounting-transaction segfaults the
  // app), and the screen objects wait on the element they actually need rather
  // than assuming a tap has landed.
  //
  // Worth revisiting deliberately, with the one test reworked, rather than
  // treating the flag as settled.
  // Element interactions (tap, typeText, etc.) still work without sync.
}

// Configure Detox to handle React Native Fabric compatibility
beforeAll(async () => {
  console.log('🚀 Starting Detox E2E Test Suite');
  console.log(`Platform: ${device.getPlatform()}`);

  // Setup ADB reverse for local API testing (Android only)
  setupAdbReverseForLocalTesting();
});

// Take a screenshot after every test for tracking and debugging
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

// Global teardown runs once after all tests
afterAll(async () => {
  console.log('✅ Detox E2E Test Suite Complete');
});
