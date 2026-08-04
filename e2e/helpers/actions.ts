/**
 * ⭐ ENHANCED Common action helpers for E2E tests
 *
 * Provides reusable actions with built-in waiting and retry logic
 *
 * BEST PRACTICES:
 * - All actions wait for elements to be ready before interacting
 * - Keyboard is automatically handled for text input
 * - No hard-coded delays - uses condition-based waits
 * - Automatic retry for flaky operations
 */

import { system } from 'detox';
import {
  waitForElementAndTap,
  waitForElementAndType,
  waitForKeyboardDismiss,
  delay,
  TIMEOUTS,
} from './waitFor';

/**
 * ⭐ ENHANCED: Tap an element by test ID with automatic wait
 */
export async function tapByID(
  testID: string,
  timeout: number = TIMEOUTS.DEFAULT,
) {
  await waitForElementAndTap(element(by.id(testID)), timeout);
}

/**
 * ⭐ ENHANCED: Tap an element by text with automatic wait
 */
export async function tapByText(
  text: string,
  timeout: number = TIMEOUTS.DEFAULT,
) {
  await waitForElementAndTap(element(by.text(text)), timeout);
}

/**
 * ⭐ ENHANCED: Type text into an input by test ID with keyboard handling
 */
export async function typeIntoField(
  testID: string,
  text: string,
  dismissKeyboard: boolean = true,
) {
  await waitForElementAndType(
    element(by.id(testID)),
    text,
    TIMEOUTS.DEFAULT,
    dismissKeyboard,
  );
}

/**
 * ⭐ ENHANCED: Clear and type text into an input with keyboard handling
 */
export async function clearAndType(
  testID: string,
  text: string,
  dismissKeyboard: boolean = true,
) {
  const field = element(by.id(testID));

  // Wait for field to be visible and tap to focus
  await waitFor(field).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
  await field.tap();

  // Clear and type with keyboard handling
  await field.clearText();
  await field.typeText(text);

  // Dismiss keyboard if requested
  if (dismissKeyboard) {
    await dismissKeyboardAction();
  }
}

/**
 * ⭐ ENHANCED: Replace text in a field (clears and types in one operation)
 */
export async function replaceText(
  testID: string,
  text: string,
  dismissKeyboard: boolean = true,
) {
  const field = element(by.id(testID));

  // Wait for field and use replaceText (more efficient than clear+type)
  await waitFor(field).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
  await field.replaceText(text);

  if (dismissKeyboard) {
    await dismissKeyboardAction();
  }
}

/**
 * ⭐ ENHANCED: Scroll to element and tap with automatic wait
 */
export async function scrollToAndTap(
  testID: string,
  direction: 'top' | 'bottom' | 'left' | 'right' = 'bottom',
) {
  const targetElement = element(by.id(testID));

  // Scroll to element
  await targetElement.scrollTo(direction);

  // Wait a bit for scroll animation
  await delay(300);

  // Wait for element to be visible and tap
  await waitForElementAndTap(targetElement);
}

/**
 * ⭐ ENHANCED: Scroll within a container to find and tap element
 */
export async function scrollInContainerAndTap(
  containerID: string,
  targetID: string,
  scrollDirection: 'up' | 'down' = 'down',
  maxScrolls: number = 10,
) {
  const container = element(by.id(containerID));
  const target = element(by.id(targetID));

  let scrollCount = 0;

  while (scrollCount < maxScrolls) {
    try {
      // Check if target is visible
      await waitFor(target).toBeVisible().withTimeout(1000);
      // Found it, tap and return
      await target.tap();
      return;
    } catch {
      // Not visible, scroll
      await container.scroll(200, scrollDirection);
      scrollCount++;
      await delay(200);
    }
  }

  throw new Error(
    `Failed to find element ${targetID} after ${maxScrolls} scrolls`,
  );
}

/**
 * Swipe element left
 */
export async function swipeLeft(
  testID: string,
  speed: 'fast' | 'slow' = 'fast',
  normalizedSwipeOffset: number = 0.5,
) {
  const targetElement = element(by.id(testID));
  await waitFor(targetElement).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
  await targetElement.swipe('left', speed, normalizedSwipeOffset);
}

/**
 * Swipe element right
 */
export async function swipeRight(
  testID: string,
  speed: 'fast' | 'slow' = 'fast',
  normalizedSwipeOffset: number = 0.5,
) {
  const targetElement = element(by.id(testID));
  await waitFor(targetElement).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
  await targetElement.swipe('right', speed, normalizedSwipeOffset);
}

/**
 * Swipe element up
 */
export async function swipeUp(
  testID: string,
  speed: 'fast' | 'slow' = 'fast',
  normalizedSwipeOffset: number = 0.5,
) {
  const targetElement = element(by.id(testID));
  await waitFor(targetElement).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
  await targetElement.swipe('up', speed, normalizedSwipeOffset);
}

/**
 * Swipe element down
 */
export async function swipeDown(
  testID: string,
  speed: 'fast' | 'slow' = 'fast',
  normalizedSwipeOffset: number = 0.5,
) {
  const targetElement = element(by.id(testID));
  await waitFor(targetElement).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
  await targetElement.swipe('down', speed, normalizedSwipeOffset);
}

/**
 * ⭐ ENHANCED: Long press on element with wait
 */
export async function longPress(testID: string, duration: number = 1000) {
  const targetElement = element(by.id(testID));
  await waitFor(targetElement).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
  await targetElement.longPress(duration);
}

/**
 * ⭐ ENHANCED: Scroll view to top with wait
 */
export async function scrollToTop(scrollViewID: string = 'scroll-view') {
  const scrollView = element(by.id(scrollViewID));
  await waitFor(scrollView).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
  await scrollView.scrollTo('top');
  await delay(300); // Wait for scroll animation
}

/**
 * ⭐ ENHANCED: Scroll view to bottom with wait
 */
export async function scrollToBottom(scrollViewID: string = 'scroll-view') {
  const scrollView = element(by.id(scrollViewID));
  await waitFor(scrollView).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
  await scrollView.scrollTo('bottom');
  await delay(300); // Wait for scroll animation
}

/**
 * ⭐ ENHANCED: Tap at specific coordinates with wait
 */
export async function tapAtPoint(testID: string, x: number, y: number) {
  const targetElement = element(by.id(testID));
  await waitFor(targetElement).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
  await targetElement.tapAtPoint({ x, y });
}

/**
 * ⭐ ENHANCED: Multi-tap (double tap, triple tap, etc.) with wait
 */
export async function multiTap(testID: string, times: number) {
  const targetElement = element(by.id(testID));
  await waitFor(targetElement).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
  await targetElement.multiTap(times);
}

/**
 * ⭐ ENHANCED: Dismiss keyboard with platform-specific handling
 */
export async function dismissKeyboardAction() {
  if (device.getPlatform() === 'ios') {
    // On iOS, try multiple methods
    try {
      // Try return key first
      await element(by.type('_UIKeyboardLayoutView')).tap();
    } catch {
      try {
        // Try tapping outside keyboard area
        await tapAtPoint('root-view', 50, 50);
      } catch {
        // Last resort: tap a safe area
        console.warn('Could not dismiss keyboard using standard methods');
      }
    }
  } else {
    // On Android, use back button
    try {
      await device.pressBack();
    } catch {
      console.warn('Could not dismiss keyboard with back button');
    }
  }

  // Wait for keyboard to actually dismiss
  await waitForKeyboardDismiss();
}

/**
 * ⭐ NEW: Pull to refresh action
 */
export async function pullToRefresh(scrollViewID: string = 'scroll-view') {
  const scrollView = element(by.id(scrollViewID));
  await waitFor(scrollView).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);

  // Scroll to top first
  await scrollView.scrollTo('top');
  await delay(300);

  // Pull down to trigger refresh
  await scrollView.swipe('down', 'slow', 0.9);

  // Wait for refresh animation
  await delay(500);
}

/**
 * ⭐ NEW: Scroll to percentage position
 */
export async function scrollToPosition(
  scrollViewID: string,
  percentage: number, // 0-100
  direction: 'vertical' | 'horizontal' = 'vertical',
) {
  const scrollView = element(by.id(scrollViewID));
  await waitFor(scrollView).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);

  // Calculate normalized position (0-1)
  const normalizedPosition = Math.min(Math.max(percentage / 100, 0), 1);

  if (direction === 'vertical') {
    await scrollView.scrollTo(normalizedPosition > 0.5 ? 'bottom' : 'top');
  } else {
    await scrollView.scrollTo(normalizedPosition > 0.5 ? 'right' : 'left');
  }

  await delay(300);
}

/**
 * Take a screenshot with automatic naming
 */
export async function takeScreenshot(name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const platform = device.getPlatform();
  const fullName = `${platform}-${name}-${timestamp}`;

  await device.takeScreenshot(fullName);
  console.log(`📸 Screenshot saved: ${fullName}`);
}

/**
 * ⭐ ENHANCED: Reload React Native bundle with wait
 */
export async function reloadApp() {
  console.log('🔄 Reloading React Native bundle...');
  await device.reloadReactNative();

  // Wait for app to reload
  await delay(2000);

  console.log('✅ App reloaded');
}

/**
 * ⭐ ENHANCED: Send app to background and bring back with proper wait
 */
export async function sendToBackgroundAndReturn(duration: number = 2000) {
  console.log(`📱 Sending app to background for ${duration}ms...`);

  await device.sendToHome();
  await delay(duration);

  // Bring app back without creating new instance
  await device.launchApp({ newInstance: false });

  // Wait for app to be active again
  await delay(1000);

  console.log('✅ App returned to foreground');
}

/**
 * ⭐ NEW: Shake device to trigger dev menu (useful for debugging)
 */
export async function shakeDevice() {
  if (device.getPlatform() === 'ios') {
    await device.shake();
  } else {
    // On Android, shake might not work, use menu button
    console.warn(
      'Shake not supported on Android, use device.openDevMenu() instead',
    );
  }
}

/**
 * ⭐ NEW: Set device orientation
 */
export async function setOrientation(orientation: 'portrait' | 'landscape') {
  await device.setOrientation(orientation);
  await delay(500); // Wait for orientation change animation
  console.log(`📱 Device orientation set to: ${orientation}`);
}

/**
 * ⭐ NEW: Set device location (for location-based features)
 */
export async function setLocation(lat: number, lon: number) {
  await device.setLocation(lat, lon);
  console.log(`📍 Device location set to: ${lat}, ${lon}`);
}

/**
 * ⭐ NEW: Tap system alert button (permissions, etc.)
 */
export async function tapSystemAlertButton(buttonLabel: string) {
  try {
    if (device.getPlatform() === 'ios') {
      await element(by.label(buttonLabel)).tap();
    } else {
      await element(by.text(buttonLabel)).tap();
    }
    await delay(500);
  } catch (error) {
    console.warn(
      `⚠️  Could not tap system alert button "${buttonLabel}":`,
      error,
    );
  }
}

/**
 * Read a switch's own value. iOS reports `'1'` / `'0'`; Android reports the
 * toggle state on `value` too. Used to assert that a single tap actually
 * changed a control, rather than that a tap was delivered.
 */
export async function getToggleValue(
  testID: string,
): Promise<string | undefined> {
  const attributes = (await element(by.id(testID)).getAttributes()) as {
    value?: string;
  };
  return attributes.value;
}

/**
 * Poll until a switch reports a value different from `before`, or give up and
 * return whatever it reports last.
 *
 * Polling rather than sleeping a fixed interval: a settings flip is a local
 * cache write, so it lands in a frame or two — a fixed wait is dead time on
 * every run and still has to be long enough to catch a late revert (a value
 * that flips and comes back is the failure worth catching).
 */
export async function waitForToggleChange(
  testID: string,
  before: string | undefined,
  timeoutMs = 2500,
): Promise<string | undefined> {
  const deadline = Date.now() + timeoutMs;
  let latest = before;
  while (Date.now() < deadline) {
    latest = await getToggleValue(testID);
    if (latest !== before) return latest;
    await delay(50);
  }
  return latest;
}

/**
 * iOS offers "Save Password?" after a bootstrap login. It's a system alert, so
 * it sits above the app and makes the tab bar unhittable — dismiss it before
 * any navigation. No-op on Android and on simulators that don't show it.
 *
 * Distinct from {@link tapSystemAlertButton}, which taps an in-app-hierarchy
 * label; this one reaches the springboard alert via Detox's `system` matcher.
 */
export async function dismissSavePasswordPrompt(): Promise<void> {
  try {
    await system.element(by.system.label('Not Now')).tap();
  } catch {
    // Not shown on this simulator — fine.
  }
}

/**
 * Tap a switch once and report whether it actually moved. Screenshots the
 * result so a run is reviewable in `e2e/artifacts`.
 */
export async function tapToggleOnce(
  testID: string,
): Promise<{ before: string | undefined; after: string | undefined }> {
  const before = await getToggleValue(testID);
  await element(by.id(testID)).tap();
  const after = await waitForToggleChange(testID, before);
  await device.takeScreenshot(`${testID}-after-one-tap`);
  return { before, after };
}
