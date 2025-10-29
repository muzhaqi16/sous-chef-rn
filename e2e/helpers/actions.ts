/**
 * Common action helpers for E2E tests
 *
 * Provides reusable actions for interacting with the app
 */

/**
 * Tap an element by test ID
 */
export async function tapByID(testID: string) {
  await element(by.id(testID)).tap();
}

/**
 * Tap an element by text
 */
export async function tapByText(text: string) {
  await element(by.text(text)).tap();
}

/**
 * Type text into an input by test ID
 */
export async function typeIntoField(testID: string, text: string) {
  await element(by.id(testID)).typeText(text);
}

/**
 * Clear and type text into an input
 */
export async function clearAndType(testID: string, text: string) {
  const field = element(by.id(testID));
  await field.clearText();
  await field.typeText(text);
}

/**
 * Scroll to element and tap
 */
export async function scrollToAndTap(
  testID: string,
  scrollViewID: string = 'scroll-view',
) {
  await element(by.id(testID)).scrollTo('bottom');
  await element(by.id(testID)).tap();
}

/**
 * Swipe element left
 */
export async function swipeLeft(testID: string, speed: 'fast' | 'slow' = 'fast') {
  await element(by.id(testID)).swipe('left', speed);
}

/**
 * Swipe element right
 */
export async function swipeRight(testID: string, speed: 'fast' | 'slow' = 'fast') {
  await element(by.id(testID)).swipe('right', speed);
}

/**
 * Swipe element up
 */
export async function swipeUp(testID: string, speed: 'fast' | 'slow' = 'fast') {
  await element(by.id(testID)).swipe('up', speed);
}

/**
 * Swipe element down
 */
export async function swipeDown(testID: string, speed: 'fast' | 'slow' = 'fast') {
  await element(by.id(testID)).swipe('down', speed);
}

/**
 * Long press on element
 */
export async function longPress(testID: string, duration: number = 1000) {
  await element(by.id(testID)).longPress(duration);
}

/**
 * Scroll view to top
 */
export async function scrollToTop(scrollViewID: string = 'scroll-view') {
  await element(by.id(scrollViewID)).scrollTo('top');
}

/**
 * Scroll view to bottom
 */
export async function scrollToBottom(scrollViewID: string = 'scroll-view') {
  await element(by.id(scrollViewID)).scrollTo('bottom');
}

/**
 * Tap at specific coordinates
 */
export async function tapAtPoint(testID: string, x: number, y: number) {
  await element(by.id(testID)).tapAtPoint({ x, y });
}

/**
 * Multi-tap (double tap, triple tap, etc.)
 */
export async function multiTap(testID: string, times: number) {
  await element(by.id(testID)).multiTap(times);
}

/**
 * Replace text in a field
 */
export async function replaceText(testID: string, text: string) {
  await element(by.id(testID)).replaceText(text);
}

/**
 * Dismiss keyboard (iOS)
 */
export async function dismissKeyboard() {
  if (device.getPlatform() === 'ios') {
    await element(by.id('keyboard-dismiss-button')).tap();
  } else {
    await device.pressBack();
  }
}

/**
 * Take a screenshot
 */
export async function takeScreenshot(name: string) {
  await device.takeScreenshot(name);
}

/**
 * Reload React Native bundle
 */
export async function reloadApp() {
  await device.reloadReactNative();
}

/**
 * Send app to background and bring back
 */
export async function sendToBackgroundAndReturn(duration: number = 2000) {
  await device.sendToHome();
  await new Promise(resolve => setTimeout(resolve, duration));
  await device.launchApp({ newInstance: false });
}
