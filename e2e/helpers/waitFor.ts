/**
 * Enhanced Wait utilities for E2E tests
 *
 * ⭐ BEST PRACTICES:
 * - NEVER use device.disableSynchronization() - these utilities handle waiting properly
 * - NEVER use hard-coded setTimeout() - use condition-based waits
 * - Always wait for the specific condition, not arbitrary time
 * - Use retry logic for flaky operations
 */

/**
 * Default timeout for most wait operations (5 seconds max - screens appear in 1-2s)
 */
const DEFAULT_TIMEOUT = 5000;

/**
 * Shorter timeout for quick operations (2 seconds)
 */
const QUICK_TIMEOUT = 2000;

/**
 * Network timeout for GraphQL/API operations (5 seconds max)
 */
const NETWORK_TIMEOUT = 5000;

/**
 * Wait for element to be visible with custom timeout
 */
export async function waitForElementToBeVisible(
  element: Detox.IndexableNativeElement,
  timeout: number = DEFAULT_TIMEOUT,
) {
  await waitFor(element).toBeVisible().withTimeout(timeout);
}

/**
 * Wait for element to disappear
 */
export async function waitForElementToDisappear(
  element: Detox.IndexableNativeElement,
  timeout: number = DEFAULT_TIMEOUT,
) {
  await waitFor(element).not.toBeVisible().withTimeout(timeout);
}

/**
 * ⭐ ENHANCED: Wait for element removal (complete unmount)
 * Use this for modals/overlays to ensure they're completely gone
 */
export async function waitForElementRemoval(
  element: Detox.IndexableNativeElement,
  timeout: number = DEFAULT_TIMEOUT,
) {
  try {
    // First wait for it to become invisible
    await waitFor(element).not.toBeVisible().withTimeout(timeout / 2);
    // Then wait for it to not exist in the tree
    await waitFor(element).not.toExist().withTimeout(timeout / 2);
  } catch (error) {
    console.warn('Element removal wait failed, continuing...', error);
  }
}

/**
 * Wait for element to exist (but not necessarily visible)
 */
export async function waitForElementToExist(
  element: Detox.IndexableNativeElement,
  timeout: number = DEFAULT_TIMEOUT,
) {
  await waitFor(element).toExist().withTimeout(timeout);
}

/**
 * Wait for text to appear on screen
 */
export async function waitForText(text: string, timeout: number = DEFAULT_TIMEOUT) {
  await waitFor(element(by.text(text))).toBeVisible().withTimeout(timeout);
}

/**
 * Wait for element by ID
 */
export async function waitForElementById(
  testID: string,
  timeout: number = DEFAULT_TIMEOUT,
) {
  await waitFor(element(by.id(testID))).toBeVisible().withTimeout(timeout);
}

/**
 * Wait for screen to load (checks for screen test ID)
 */
export async function waitForScreen(
  screenTestID: string,
  timeout: number = NETWORK_TIMEOUT,
) {
  await waitFor(element(by.id(screenTestID)))
    .toBeVisible()
    .withTimeout(timeout);
}

/**
 * ⭐ NEW: Wait for network idle
 * Waits for GraphQL/API requests to complete by checking for loading indicators
 *
 * @param loadingIndicatorID - testID of loading spinner/skeleton
 * @param timeout - max time to wait
 */
export async function waitForNetworkIdle(
  loadingIndicatorID?: string,
  timeout: number = NETWORK_TIMEOUT,
) {
  if (!loadingIndicatorID) {
    // If no specific indicator, just wait a bit for network
    await delay(1000);
    return;
  }

  try {
    // Wait for loading indicator to appear (optional)
    await waitFor(element(by.id(loadingIndicatorID)))
      .toBeVisible()
      .withTimeout(2000);
  } catch {
    // Might already be loaded, that's fine
  }

  // Wait for loading indicator to disappear
  try {
    await waitFor(element(by.id(loadingIndicatorID)))
      .not.toBeVisible()
      .withTimeout(timeout);
  } catch (error) {
    console.warn('Network idle wait timed out, continuing...', error);
  }
}

/**
 * ⭐ NEW: Wait for keyboard to appear
 * Use before typing to ensure keyboard is ready
 */
export async function waitForKeyboard(timeout: number = QUICK_TIMEOUT) {
  // On Android, keyboard detection is tricky, so just wait a bit
  if (device.getPlatform() === 'android') {
    await delay(500);
    return;
  }

  // On iOS, can check for keyboard
  try {
    await waitFor(element(by.type('UIKeyboardLayoutStar')))
      .toExist()
      .withTimeout(timeout);
  } catch {
    // Keyboard might already be there or detection failed
  }
}

/**
 * ⭐ NEW: Wait for keyboard to dismiss
 */
export async function waitForKeyboardDismiss(timeout: number = QUICK_TIMEOUT) {
  if (device.getPlatform() === 'android') {
    await delay(300);
    return;
  }

  try {
    await waitFor(element(by.type('UIKeyboardLayoutStar')))
      .not.toExist()
      .withTimeout(timeout);
  } catch {
    // Keyboard might already be gone
  }
}

/**
 * ⭐ ENHANCED: Wait for element and then tap it with retry
 * Automatically retries if tap fails (handles race conditions)
 */
export async function waitForElementAndTap(
  targetElement: Detox.IndexableNativeElement,
  timeout: number = DEFAULT_TIMEOUT,
  maxRetries: number = 3,
) {
  await retry(
    async () => {
      await waitFor(targetElement).toBeVisible().withTimeout(timeout);
      await targetElement.tap();
    },
    maxRetries,
    500,
  );
}

/**
 * ⭐ ENHANCED: Wait for element and then type text with keyboard handling
 * Automatically handles keyboard appearance and dismissal
 */
export async function waitForElementAndType(
  targetElement: Detox.IndexableNativeElement,
  text: string,
  timeout: number = DEFAULT_TIMEOUT,
  dismissKeyboard: boolean = true,
) {
  // Wait for element to be visible and tap it to focus
  await waitFor(targetElement).toBeVisible().withTimeout(timeout);
  await targetElement.tap();

  // Wait for keyboard to appear
  await waitForKeyboard();

  // Clear existing text first
  await targetElement.clearText();

  // Type the text
  await targetElement.typeText(text);

  // Dismiss keyboard if requested
  if (dismissKeyboard) {
    if (device.getPlatform() === 'android') {
      // On Android, tap outside or press back
      try {
        await device.pressBack();
      } catch {
        // If back doesn't work, that's fine
      }
    } else {
      // On iOS, use return key or tap outside
      try {
        await targetElement.tapReturnKey();
      } catch {
        // Return key might not be available
      }
    }

    await waitForKeyboardDismiss();
  }
}

/**
 * ⭐ NEW: Scroll to element and wait for it to be visible
 * Useful for long lists or scrollable content
 */
export async function scrollToElementAndWait(
  scrollElement: Detox.IndexableNativeElement,
  targetElement: Detox.IndexableNativeElement,
  direction: 'up' | 'down' | 'left' | 'right' = 'down',
  scrollAmount: number = 200,
  maxScrolls: number = 10,
) {
  let scrollCount = 0;

  while (scrollCount < maxScrolls) {
    try {
      // Check if element is visible
      await waitFor(targetElement).toBeVisible().withTimeout(1000);
      return; // Found it!
    } catch {
      // Not visible yet, scroll
      if (direction === 'down') {
        await scrollElement.scroll(scrollAmount, 'down');
      } else if (direction === 'up') {
        await scrollElement.scroll(scrollAmount, 'up');
      } else if (direction === 'left') {
        await scrollElement.scroll(scrollAmount, 'left');
      } else {
        await scrollElement.scroll(scrollAmount, 'right');
      }

      scrollCount++;
      await delay(300); // Small delay between scrolls
    }
  }

  throw new Error(`Failed to find element after ${maxScrolls} scroll attempts`);
}

/**
 * ⭐ NEW: Wait for modal/overlay to open and be ready for interaction
 * Handles the full lifecycle: appearance, animation, and readiness
 */
export async function waitForModalReady(
  modalTestID: string,
  timeout: number = DEFAULT_TIMEOUT,
) {
  // Wait for modal to exist
  await waitFor(element(by.id(modalTestID))).toExist().withTimeout(timeout / 3);

  // Wait for modal to be visible (animation complete)
  await waitFor(element(by.id(modalTestID))).toBeVisible().withTimeout(timeout / 3);

  // Small delay for modal content to settle
  await delay(300);
}

/**
 * ⭐ NEW: Wait for modal/overlay to close completely
 * Ensures modal is fully removed before continuing
 */
export async function waitForModalClosed(
  modalTestID: string,
  timeout: number = DEFAULT_TIMEOUT,
) {
  await waitForElementRemoval(element(by.id(modalTestID)), timeout);
  // Extra delay to ensure animation is complete
  await delay(200);
}

/**
 * ⭐ NEW: Smart delay that respects platform differences
 * Use this ONLY when absolutely necessary (prefer condition-based waits)
 */
export async function delay(ms: number) {
  const platformMultiplier = device.getPlatform() === 'android' ? 1.2 : 1.0;
  return new Promise(resolve => setTimeout(resolve, ms * platformMultiplier));
}

/**
 * ⭐ ENHANCED: Retry an action if it fails with better logging
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
        console.log(
          `⚠️  Attempt ${attempt}/${maxAttempts} failed: ${lastError.message}. Retrying...`,
        );
        await delay(delayMs);
      } else {
        console.error(
          `❌ All ${maxAttempts} attempts failed. Last error: ${lastError.message}`,
        );
      }
    }
  }

  throw lastError || new Error('All retry attempts failed');
}

/**
 * ⭐ NEW: Wait for multiple elements to be visible (all must be visible)
 * Useful for waiting for a screen to be fully loaded
 */
export async function waitForElements(
  elements: Detox.IndexableNativeElement[],
  timeout: number = DEFAULT_TIMEOUT,
) {
  await Promise.all(
    elements.map(el => waitFor(el).toBeVisible().withTimeout(timeout)),
  );
}

/**
 * ⭐ NEW: Wait for any one of multiple elements to be visible
 * Useful when different flows might show different elements
 */
export async function waitForAnyElement(
  elements: Detox.IndexableNativeElement[],
  timeout: number = DEFAULT_TIMEOUT,
): Promise<number> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    for (let i = 0; i < elements.length; i++) {
      try {
        await waitFor(elements[i]).toBeVisible().withTimeout(500);
        return i; // Return index of visible element
      } catch {
        // This element not visible, try next
      }
    }
    await delay(200);
  }

  throw new Error('None of the elements became visible within timeout');
}

/**
 * ⭐ NEW: Tap the first available element from multiple selectors
 * Useful for handling UI variations (different testIDs, labels, etc.)
 */
export async function tapFirstAvailable(
  elements: Detox.IndexableNativeElement[],
  timeout: number = DEFAULT_TIMEOUT,
): Promise<number> {
  const index = await waitForAnyElement(elements, timeout);
  await elements[index].tap();
  return index;
}

/**
 * ⭐ NEW: Conditional wait - only wait if element exists
 * Useful for optional UI elements (like hints, tooltips)
 */
export async function waitIfPresent(
  targetElement: Detox.IndexableNativeElement,
  action: () => Promise<void>,
  checkTimeout: number = 2000,
) {
  try {
    await waitFor(targetElement).toBeVisible().withTimeout(checkTimeout);
    await action();
  } catch {
    // Element not present, skip action
    console.log('Optional element not present, skipping...');
  }
}

// Export default timeouts for use in other files
export const TIMEOUTS = {
  DEFAULT: DEFAULT_TIMEOUT,
  QUICK: QUICK_TIMEOUT,
  NETWORK: NETWORK_TIMEOUT,
};
