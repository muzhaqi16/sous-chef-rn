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

// Configure Detox to handle React Native Fabric compatibility
beforeAll(async () => {
  console.log('🚀 Starting Detox E2E Test Suite');
  console.log(`Platform: ${device.getPlatform()}`);

  // Workaround for Fabric UIManager compatibility issue
  // This disables the problematic idling resource checks
  await device.setURLBlacklist(['.*inappbrowser.*']);
});

// Global teardown runs once after all tests
afterAll(async () => {
  console.log('✅ Detox E2E Test Suite Complete');
});
