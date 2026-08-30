/**
 * Custom assertion helpers. Every helper must assert what its name says — one
 * that quietly asserts less is worse than none, because the name is what a
 * reader trusts. Detox has no `toBeEnabled()`, so an "enabled" claim cannot be
 * made at all; assert visibility and say so.
 */
import { element, by, waitFor, expect } from 'detox';

export async function expectElementText(testID: string, text: string) {
  await expect(element(by.id(testID))).toHaveText(text);
}

export async function expectToastVisible(message: string) {
  await expect(element(by.text(message))).toBeVisible();
}

export async function expectToastAppearsAndDisappears(
  message: string,
  timeout: number = 5000,
) {
  await expect(element(by.text(message))).toBeVisible();
  await waitFor(element(by.text(message)))
    .not.toBeVisible()
    .withTimeout(timeout);
}

export async function expectScreenLoaded(screenTestID: string) {
  await expect(element(by.id(screenTestID))).toBeVisible();
}

export async function expectNotToExist(testID: string) {
  await expect(element(by.id(testID))).not.toExist();
}

export async function expectExistsButNotVisible(testID: string) {
  await expect(element(by.id(testID))).toExist();
  await expect(element(by.id(testID))).not.toBeVisible();
}

/**
 * Assert that `action` makes an element go away. Detox satisfies
 * `.not.toBeVisible()` for an element that does not EXIST, so a bare
 * disappearance check against a testID the app never renders passes vacuously.
 * Asserting presence BEFORE the action makes an empty matcher fail loudly.
 */
export async function expectDisappearsAfter(
  testID: string,
  action: () => Promise<void>,
  { presentTimeout = 5000, goneTimeout = 15000 } = {},
) {
  await waitFor(element(by.id(testID)))
    .toBeVisible()
    .withTimeout(presentTimeout);
  await action();
  await waitFor(element(by.id(testID)))
    .not.toBeVisible()
    .withTimeout(goneTimeout);
}

export async function expectChecked(testID: string) {
  await expect(element(by.id(testID))).toHaveToggleValue(true);
}

export async function expectUnchecked(testID: string) {
  await expect(element(by.id(testID))).toHaveToggleValue(false);
}

export async function expectFieldEmpty(testID: string) {
  await expect(element(by.id(testID))).toHaveText('');
}

export async function expectErrorMessage(message: string) {
  await expect(element(by.text(message))).toBeVisible();
}

export async function expectAllVisible(...testIDs: string[]) {
  for (const testID of testIDs) {
    await expect(element(by.id(testID))).toBeVisible();
  }
}
