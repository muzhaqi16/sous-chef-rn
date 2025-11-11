/**
 * Wait utilities for E2E tests
 *
 * Provides helper functions for waiting on elements and conditions
 */

/**
 * Wait for element to be visible with custom timeout
 */
export async function waitForElementToBeVisible(
  element: Detox.IndexableNativeElement,
  timeout: number = 5000,
) {
  await waitFor(element).toBeVisible().withTimeout(timeout);
}

/**
 * Wait for element to disappear
 */
export async function waitForElementToDisappear(
  element: Detox.IndexableNativeElement,
  timeout: number = 5000,
) {
  await waitFor(element).not.toBeVisible().withTimeout(timeout);
}

/**
 * Wait for element to exist (but not necessarily visible)
 */
export async function waitForElementToExist(
  element: Detox.IndexableNativeElement,
  timeout: number = 5000,
) {
  await waitFor(element).toExist().withTimeout(timeout);
}

/**
 * Wait for text to appear on screen
 */
export async function waitForText(text: string, timeout: number = 5000) {
  await waitFor(element(by.text(text))).toBeVisible().withTimeout(timeout);
}

/**
 * Wait for element by ID
 */
export async function waitForElementById(
  testID: string,
  timeout: number = 5000,
) {
  await waitFor(element(by.id(testID))).toBeVisible().withTimeout(timeout);
}

/**
 * Wait for screen to load (checks for screen test ID)
 */
export async function waitForScreen(
  screenTestID: string,
  timeout: number = 10000,
) {
  await waitFor(element(by.id(screenTestID)))
    .toBeVisible()
    .withTimeout(timeout);
}

/**
 * Wait with a simple delay (use sparingly, prefer waitFor)
 */
export async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for element and then tap it
 */
export async function waitAndTap(
  element: Detox.IndexableNativeElement,
  timeout: number = 5000,
) {
  await waitFor(element).toBeVisible().withTimeout(timeout);
  await element.tap();
}

/**
 * Wait for element and then type text
 */
export async function waitAndType(
  element: Detox.IndexableNativeElement,
  text: string,
  timeout: number = 5000,
) {
  await waitFor(element).toBeVisible().withTimeout(timeout);
  await element.typeText(text);
}

/**
 * Retry an action if it fails
 */
export async function retry<T>(
  action: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await action();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        console.log(`Attempt ${attempt} failed, retrying...`);
        await delay(delayMs);
      }
    }
  }

  throw lastError || new Error('All retry attempts failed');
}
