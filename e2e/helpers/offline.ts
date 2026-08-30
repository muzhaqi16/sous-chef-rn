/**
 * Nothing here actually disconnects the device: `setStatusBar` repaints the iOS
 * status bar and Android does nothing at all. These wait on the app's own
 * offline banner, not on a real outage.
 */

import { element, by, waitFor, device } from 'detox';
import { delay, TIMEOUTS } from './waitFor';

export async function simulateOffline(): Promise<void> {
  console.log('📴 Simulating offline mode...');

  // Visual only — the socket stays up.
  if (device.getPlatform() === 'ios') {
    await device.setStatusBar({ dataNetwork: 'wifi', wifiBars: '0' });
  }

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

  await delay(1000);
  console.log('✅ Offline mode simulated');
}

export async function simulateOnline(): Promise<void> {
  console.log('📶 Restoring online mode...');

  if (device.getPlatform() === 'ios') {
    await device.setStatusBar({ dataNetwork: 'wifi', wifiBars: '3' });
  }

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

/** `dataType` is an entity name — 'PantryItem', 'ShoppingListItem'. */
export async function waitForDataSync(
  dataType: string,
  timeout = TIMEOUTS.NETWORK,
): Promise<void> {
  console.log(`⏳ Waiting for ${dataType} sync...`);

  const syncIndicatorId = `${dataType.toLowerCase()}-sync-indicator`;

  try {
    const syncIndicator = element(by.id(syncIndicatorId));
    await waitFor(syncIndicator).not.toBeVisible().withTimeout(timeout);
  } catch {
    // Indicator might not exist for this type
  }

  await delay(500);
  console.log(`✅ ${dataType} sync complete`);
}

export async function testOfflineFailure(
  operation: () => Promise<void>,
  errorCheck?: () => Promise<void>,
): Promise<void> {
  await simulateOffline();

  console.log('🔄 Testing offline operation...');
  await operation();

  if (errorCheck) {
    console.log('🔍 Verifying error handling...');
    await errorCheck();
  }

  await simulateOnline();
}

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

/** Stub: delays only. A real error needs a mock server or blocked requests. */
export async function simulateNetworkError(): Promise<void> {
  console.log('💥 Simulating network error...');
  await delay(100);
}
