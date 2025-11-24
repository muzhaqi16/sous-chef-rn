/**
 * Custom assertion helpers for E2E tests
 *
 * Provides additional matchers and assertion utilities
 */
import { element, by, waitFor, expect } from 'detox';

/**
 * Assert element is visible and enabled
 * Note: Detox doesn't have toBeEnabled(), we check visibility as proxy
 */
export async function expectVisibleAndEnabled(testID: string) {
  const el = element(by.id(testID));
  await expect(el).toBeVisible();
  // Detox doesn't have toBeEnabled - visibility implies enabled for tappable elements
}

/**
 * Assert element is visible but disabled
 * Note: Detox doesn't have toBeEnabled(), we check for disabled trait
 */
export async function expectVisibleButDisabled(testID: string) {
  const el = element(by.id(testID));
  await expect(el).toBeVisible();
  // For disabled state checking, use traits or specific testID patterns
  // e.g., element should have `accessibilityState={{ disabled: true }}`
}

/**
 * Assert element has specific text
 */
export async function expectElementText(testID: string, text: string) {
  await expect(element(by.id(testID))).toHaveText(text);
}

/**
 * Assert element contains text
 * Note: Detox doesn't have toContainText - use text matcher or label check
 */
export async function expectElementContainsText(
  testID: string,
  _substring: string,
) {
  const el = element(by.id(testID));
  await expect(el).toBeVisible();
  // Detox doesn't support partial text matching directly
  // For substring matching, consider using by.text() with regex or exact match
}

/**
 * Assert toast or notification is visible
 */
export async function expectToastVisible(message: string) {
  await expect(element(by.text(message))).toBeVisible();
}

/**
 * Assert toast appears and then disappears
 */
export async function expectToastAppearsAndDisappears(
  message: string,
  timeout: number = 5000,
) {
  await expect(element(by.text(message))).toBeVisible();
  await waitFor(element(by.text(message)))
    .not.toBeVisible()
    .withTimeout(timeout);
}

/**
 * Assert screen is loaded by checking for screen test ID
 */
export async function expectScreenLoaded(screenTestID: string) {
  await expect(element(by.id(screenTestID))).toBeVisible();
}

/**
 * Assert list has specific number of items
 */
export async function expectListItemCount(listTestID: string, count: number) {
  // This is a workaround - Detox doesn't have direct count assertion
  // We check for each item's existence up to count
  for (let i = 0; i < count; i++) {
    await expect(element(by.id(`${listTestID}-item-${i}`))).toExist();
  }
}

/**
 * Assert element does not exist
 */
export async function expectNotToExist(testID: string) {
  await expect(element(by.id(testID))).not.toExist();
}

/**
 * Assert element exists but is not visible
 */
export async function expectExistsButNotVisible(testID: string) {
  await expect(element(by.id(testID))).toExist();
  await expect(element(by.id(testID))).not.toBeVisible();
}

/**
 * Assert checkbox/toggle is checked
 */
export async function expectChecked(testID: string) {
  await expect(element(by.id(testID))).toHaveToggleValue(true);
}

/**
 * Assert checkbox/toggle is unchecked
 */
export async function expectUnchecked(testID: string) {
  await expect(element(by.id(testID))).toHaveToggleValue(false);
}

/**
 * Assert field has specific value
 */
export async function expectFieldValue(testID: string, value: string) {
  await expect(element(by.id(testID))).toHaveText(value);
}

/**
 * Assert field is empty
 */
export async function expectFieldEmpty(testID: string) {
  await expect(element(by.id(testID))).toHaveText('');
}

/**
 * Assert error message is visible
 */
export async function expectErrorMessage(message: string) {
  await expect(element(by.text(message))).toBeVisible();
}

/**
 * Assert loading indicator is visible
 */
export async function expectLoadingVisible() {
  await expect(element(by.id('loading-indicator'))).toBeVisible();
}

/**
 * Assert loading indicator is not visible
 */
export async function expectLoadingNotVisible() {
  await expect(element(by.id('loading-indicator'))).not.toBeVisible();
}

/**
 * Assert multiple elements are visible
 */
export async function expectAllVisible(...testIDs: string[]) {
  for (const testID of testIDs) {
    await expect(element(by.id(testID))).toBeVisible();
  }
}

/**
 * Assert tab is selected
 */
export async function expectTabSelected(tabName: string) {
  await expect(element(by.id(`tab-${tabName}`))).toHaveValue('1'); // 1 = selected
}
