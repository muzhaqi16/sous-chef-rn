/**
 * Common action helpers. Each waits for its element before interacting, and the
 * text helpers dismiss the keyboard afterwards by default.
 */

import { system } from 'detox';
import {
  waitForElementAndTap,
  waitForElementAndType,
  waitForKeyboardDismiss,
  delay,
  TIMEOUTS,
} from './waitFor';

export async function tapByID(
  testID: string,
  timeout: number = TIMEOUTS.DEFAULT,
) {
  await waitForElementAndTap(element(by.id(testID)), timeout);
}

export async function tapByText(
  text: string,
  timeout: number = TIMEOUTS.DEFAULT,
) {
  await waitForElementAndTap(element(by.text(text)), timeout);
}

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

export async function clearAndType(
  testID: string,
  text: string,
  dismissKeyboard: boolean = true,
) {
  const field = element(by.id(testID));

  await waitFor(field).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
  await field.tap();

  await field.clearText();
  await field.typeText(text);

  if (dismissKeyboard) {
    await dismissKeyboardAction();
  }
}

export async function replaceText(
  testID: string,
  text: string,
  dismissKeyboard: boolean = true,
) {
  const field = element(by.id(testID));

  // `replaceText` clears and types in one operation — cheaper than clear+type.
  await waitFor(field).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
  await field.replaceText(text);

  if (dismissKeyboard) {
    await dismissKeyboardAction();
  }
}

export async function scrollToAndTap(
  testID: string,
  direction: 'top' | 'bottom' | 'left' | 'right' = 'bottom',
) {
  const targetElement = element(by.id(testID));

  await targetElement.scrollTo(direction);
  await delay(300);
  await waitForElementAndTap(targetElement);
}

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
      await waitFor(target).toBeVisible().withTimeout(1000);
      await target.tap();
      return;
    } catch {
      await container.scroll(200, scrollDirection);
      scrollCount++;
      await delay(200);
    }
  }

  throw new Error(
    `Failed to find element ${targetID} after ${maxScrolls} scrolls`,
  );
}

export async function swipeLeft(
  testID: string,
  speed: 'fast' | 'slow' = 'fast',
  normalizedSwipeOffset: number = 0.5,
) {
  const targetElement = element(by.id(testID));
  await waitFor(targetElement).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
  await targetElement.swipe('left', speed, normalizedSwipeOffset);
}

export async function swipeRight(
  testID: string,
  speed: 'fast' | 'slow' = 'fast',
  normalizedSwipeOffset: number = 0.5,
) {
  const targetElement = element(by.id(testID));
  await waitFor(targetElement).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
  await targetElement.swipe('right', speed, normalizedSwipeOffset);
}

export async function swipeUp(
  testID: string,
  speed: 'fast' | 'slow' = 'fast',
  normalizedSwipeOffset: number = 0.5,
) {
  const targetElement = element(by.id(testID));
  await waitFor(targetElement).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
  await targetElement.swipe('up', speed, normalizedSwipeOffset);
}

export async function swipeDown(
  testID: string,
  speed: 'fast' | 'slow' = 'fast',
  normalizedSwipeOffset: number = 0.5,
) {
  const targetElement = element(by.id(testID));
  await waitFor(targetElement).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
  await targetElement.swipe('down', speed, normalizedSwipeOffset);
}

export async function longPress(testID: string, duration: number = 1000) {
  const targetElement = element(by.id(testID));
  await waitFor(targetElement).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
  await targetElement.longPress(duration);
}

export async function scrollToTop(scrollViewID: string = 'scroll-view') {
  const scrollView = element(by.id(scrollViewID));
  await waitFor(scrollView).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
  await scrollView.scrollTo('top');
  await delay(300); // Wait for scroll animation
}

export async function scrollToBottom(scrollViewID: string = 'scroll-view') {
  const scrollView = element(by.id(scrollViewID));
  await waitFor(scrollView).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
  await scrollView.scrollTo('bottom');
  await delay(300); // Wait for scroll animation
}

export async function multiTap(testID: string, times: number) {
  const targetElement = element(by.id(testID));
  await waitFor(targetElement).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
  await targetElement.multiTap(times);
}

export async function dismissKeyboardAction() {
  if (device.getPlatform() === 'ios') {
    // The keyboard's own layout view — visible by definition, unlike whatever
    // it covers. Screens that know their focused field use `dismissKeyboard`.
    try {
      await element(by.type('_UIKeyboardLayoutView')).tap();
    } catch {
      console.warn('Could not dismiss keyboard: no keyboard layout view');
    }
  } else {
    try {
      await device.pressBack();
    } catch {
      console.warn('Could not dismiss keyboard with back button');
    }
  }

  await waitForKeyboardDismiss();
}

export async function pullToRefresh(scrollViewID: string = 'scroll-view') {
  const scrollView = element(by.id(scrollViewID));
  await waitFor(scrollView).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);

  await scrollView.scrollTo('top');
  await delay(300);

  await scrollView.swipe('down', 'slow', 0.9);
  await delay(500);
}

export async function scrollToPosition(
  scrollViewID: string,
  percentage: number, // 0-100
  direction: 'vertical' | 'horizontal' = 'vertical',
) {
  const scrollView = element(by.id(scrollViewID));
  await waitFor(scrollView).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);

  const normalizedPosition = Math.min(Math.max(percentage / 100, 0), 1);

  if (direction === 'vertical') {
    await scrollView.scrollTo(normalizedPosition > 0.5 ? 'bottom' : 'top');
  } else {
    await scrollView.scrollTo(normalizedPosition > 0.5 ? 'right' : 'left');
  }

  await delay(300);
}

export async function takeScreenshot(name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const platform = device.getPlatform();
  const fullName = `${platform}-${name}-${timestamp}`;

  await device.takeScreenshot(fullName);
  console.log(`📸 Screenshot saved: ${fullName}`);
}

export async function reloadApp() {
  console.log('🔄 Reloading React Native bundle...');
  await device.reloadReactNative();
  await delay(2000);

  console.log('✅ App reloaded');
}

export async function sendToBackgroundAndReturn(duration: number = 2000) {
  console.log(`📱 Sending app to background for ${duration}ms...`);

  await device.sendToHome();
  await delay(duration);

  // `newInstance: false` resumes the existing process rather than relaunching.
  await device.launchApp({ newInstance: false });
  await delay(1000);

  console.log('✅ App returned to foreground');
}

/** Shake to open the dev menu. iOS only — Android has no Detox shake. */
export async function shakeDevice() {
  if (device.getPlatform() === 'ios') {
    await device.shake();
  } else {
    console.warn(
      'Shake not supported on Android, use device.openDevMenu() instead',
    );
  }
}

export async function setOrientation(orientation: 'portrait' | 'landscape') {
  await device.setOrientation(orientation);
  await delay(500); // Wait for orientation change animation
  console.log(`📱 Device orientation set to: ${orientation}`);
}

export async function setLocation(lat: number, lon: number) {
  await device.setLocation(lat, lon);
  console.log(`📍 Device location set to: ${lat}, ${lon}`);
}

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
 * toggle state on `value` too. Lets a test assert that a tap actually changed
 * a control, rather than only that a tap was delivered.
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
 * Poll until a switch reports a value different from `before`, else return its
 * last value. Polled, not slept: a settings flip is a local cache write landing
 * in a frame or two, and the wait must still be long enough to catch a late
 * revert — a value that flips and comes back is the failure worth catching.
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
 * iOS offers "Save Password?" after a bootstrap login. Being a system alert it
 * sits above the app and makes the tab bar unhittable, so dismiss it before
 * navigating. Unlike {@link tapSystemAlertButton}, which taps an in-app-hierarchy
 * label, this reaches the springboard alert via Detox's `system` matcher.
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
