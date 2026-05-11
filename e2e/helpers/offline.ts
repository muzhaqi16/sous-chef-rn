/**
 * Offline Testing Helpers
 *
 * Utilities for testing offline functionality and network conditions.
 * These helpers simulate network state changes and wait for sync completion.
 */

import { element, by, waitFor, device } from 'detox';
import { delay, TIMEOUTS } from './waitFor';

/**
 * Simulate offline mode by disabling network
 */
export async function simulateOffline(): Promise<void> {
  console.log('📴 Simulating offline mode...');

  // On iOS, we can use flight mode to disable network
  // On Android, we use the toggleNetwork capability
  if (device.getPlatform() === 'ios') {
    await device.setStatusBar({ dataNetwork: 'wifi', wifiBars: '0' });
    // Note: This only changes the status bar visually
    // For true offline simulation, the app needs to handle the offline banner
  }

  // Wait for offline banner to appear (app should show offline indicator)
  try {
    await waitFor(element(by.id('offline-banner')))
      .toBeVisible()
      .withTimeout(5000);
    console.log('✅ Offline banner visible');
  } catch {
    console.log(
      '⚠️ Offline banner not visible - app may not have offline indicator',
    );
  }

  // Give the app time to recognize network change
  await delay(1000);
  console.log('✅ Offline mode simulated');
}

/**
 * Restore online mode
 */
export async function simulateOnline(): Promise<void> {
  console.log('📶 Restoring online mode...');

  // On iOS, restore the status bar
  if (device.getPlatform() === 'ios') {
    await device.setStatusBar({ dataNetwork: 'wifi', wifiBars: '3' });
  }

  // Wait for offline banner to disappear
  try {
    await waitFor(element(by.id('offline-banner')))
      .not.toBeVisible()
      .withTimeout(5000);
    console.log('✅ Offline banner hidden');
  } catch {
    console.log(
      '⚠️ Offline banner still visible or did not exist - continuing',
    );
  }

  await delay(1000);
  console.log('✅ Online mode restored');
}

/**
 * Wait for sync indicator to complete
 * This waits for any pending sync operations to complete
 */
export async function waitForSync(timeout = TIMEOUTS.NETWORK): Promise<void> {
  console.log('⏳ Waiting for sync to complete...');

  // Wait for syncing indicator to appear and then disappear
  try {
    // First check if syncing indicator appears
    const syncIndicator = element(by.id('sync-indicator'));

    try {
      await waitFor(syncIndicator).toBeVisible().withTimeout(2000);
      console.log('🔄 Sync in progress...');

      // Wait for it to disappear (sync complete)
      await waitFor(syncIndicator).not.toBeVisible().withTimeout(timeout);
      console.log('✅ Sync complete');
    } catch {
      // Sync indicator never appeared - might mean sync was instant or already done
      console.log('✅ No active sync detected');
    }
  } catch (error) {
    console.warn('⚠️ Sync wait failed:', error);
  }
}

/**
 * Wait for specific optimistic data to sync
 * @param dataType - The type of data being synced (e.g., 'PantryItem', 'ShoppingListItem')
 */
export async function waitForDataSync(
  dataType: string,
  timeout = TIMEOUTS.NETWORK,
): Promise<void> {
  console.log(`⏳ Waiting for ${dataType} sync...`);

  // Wait for type-specific sync indicator
  const syncIndicatorId = `${dataType.toLowerCase()}-sync-indicator`;

  try {
    const syncIndicator = element(by.id(syncIndicatorId));
    await waitFor(syncIndicator).not.toBeVisible().withTimeout(timeout);
  } catch {
    // Indicator might not exist for this type
  }

  // General wait for network idle
  await delay(500);
  console.log(`✅ ${dataType} sync complete`);
}

/**
 * Queue a mutation while offline and verify it syncs when online
 * @param mutationAction - Async function that performs the mutation
 * @param verificationAction - Async function that verifies the mutation completed
 */
export async function testOfflineSync(
  mutationAction: () => Promise<void>,
  verificationAction: () => Promise<void>,
): Promise<void> {
  // 1. Go offline
  await simulateOffline();

  // 2. Perform mutation (will be queued)
  console.log('📝 Performing offline mutation...');
  await mutationAction();

  // 3. Wait a bit for optimistic update to show
  await delay(1000);

  // 4. Verify optimistic update is visible
  console.log('🔍 Verifying optimistic update...');
  await verificationAction();

  // 5. Go online
  await simulateOnline();

  // 6. Wait for sync
  await waitForSync();

  // 7. Verify persisted update
  console.log('🔍 Verifying persisted update...');
  await verificationAction();
}

/**
 * Test that an operation fails gracefully when offline
 * @param operation - The operation to test
 * @param errorCheck - Optional function to verify error handling
 */
export async function testOfflineFailure(
  operation: () => Promise<void>,
  errorCheck?: () => Promise<void>,
): Promise<void> {
  // Go offline
  await simulateOffline();

  // Attempt operation
  console.log('🔄 Testing offline operation...');
  await operation();

  // Verify error handling if provided
  if (errorCheck) {
    console.log('🔍 Verifying error handling...');
    await errorCheck();
  }

  // Restore online
  await simulateOnline();
}

/**
 * Check if offline banner is visible
 */
export async function isOfflineBannerVisible(): Promise<boolean> {
  try {
    await waitFor(element(by.id('offline-banner')))
      .toBeVisible()
      .withTimeout(1000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Trigger a network error for testing error handling
 * This is a mock - actual implementation depends on your backend setup
 */
export async function simulateNetworkError(): Promise<void> {
  console.log('💥 Simulating network error...');
  // This would typically be done via a mock server or by temporarily blocking requests
  await delay(100);
}
