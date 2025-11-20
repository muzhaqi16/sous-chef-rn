/**
 * Detox initialization file
 *
 * Sets up global configurations and utilities for E2E tests
 */

import { device, element, by, waitFor, expect } from 'detox';

// Make Detox utilities globally available
global.device = device;
global.element = element;
global.by = by;
global.waitFor = waitFor;
global.expect = expect;

// Global test timeout
jest.setTimeout(120000);

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

  // Wait for app to initialize
  await new Promise(resolve => setTimeout(resolve, 3000));

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
});

// Global teardown runs once after all tests
afterAll(async () => {
  console.log('✅ Detox E2E Test Suite Complete');
});
