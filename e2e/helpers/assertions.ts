/**
 * Custom assertion helpers for E2E tests
 *
 * Every helper here must assert what its name says. Several previous ones did
 * not and were removed rather than kept as scaffolding:
 *
 * - `expectVisibleAndEnabled` only checked visibility; Detox has no
 *   `toBeEnabled()`, so the "enabled" half was never asserted.
 * - `expectVisibleButDisabled` had a body IDENTICAL to the one above — it
 *   passed on an enabled element, asserting the opposite of its name.
 * - `expectElementContainsText` ignored its `substring` argument entirely and
 *   only checked visibility.
 * - `expectListItemCount` probed a `<list>-item-<n>` testID pattern the app
 *   does not render, and never checked for extra items.
 * - `expectTabSelected` / `expectLoading*` targeted `tab-<name>` and
 *   `loading-indicator`, neither of which exists in `src/`.
 *
 * A helper that quietly asserts less than it claims is worse than no helper,
 * because its name is what a reader trusts.
 */
import { element, by, waitFor, expect } from 'detox';

/**
 * Assert element has specific text
 */
export async function expectElementText(testID: string, text: string) {
  await expect(element(by.id(testID))).toHaveText(text);
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
 * Assert that `action` makes an element go away.
 *
 * Detox satisfies `.not.toBeVisible()` for an element that does not exist, so a
 * bare disappearance check against a testID the app never renders passes
 * whether or not the thing under test happened — that is how a still-open
 * editor was reported as closed. Asserting the element is present BEFORE the
 * action turns a matcher that matches nothing into a loud failure instead of a
 * silent pass.
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
 * Assert multiple elements are visible
 */
export async function expectAllVisible(...testIDs: string[]) {
  for (const testID of testIDs) {
    await expect(element(by.id(testID))).toBeVisible();
  }
}
