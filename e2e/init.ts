/**
 * Detox initialization file
 *
 * Sets up global configurations and utilities for E2E tests
 */

// Import detox - globals are already declared in detox/globals.d.ts
import 'detox';
import { execSync } from 'child_process';

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
    },
  });

  // Wait for app to initialize (5s to account for slower emulators and bundle loading)
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Re-enable synchronization for test interactions
  try {
    await device.enableSynchronization();
  } catch (error) {
    console.log('Warning: Could not enable synchronization, continuing without it');
  }
}

// Configure Detox to handle React Native Fabric compatibility
beforeAll(async () => {
  console.log('🚀 Starting Detox E2E Test Suite');
  console.log(`Platform: ${device.getPlatform()}`);

  // Setup ADB reverse for local API testing (Android only)
  setupAdbReverseForLocalTesting();
});

// Global teardown runs once after all tests
afterAll(async () => {
  console.log('✅ Detox E2E Test Suite Complete');
});
