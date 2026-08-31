/**
 * Wait utilities. Prefer these over `device.disableSynchronization()`, and wait
 * on a condition rather than an arbitrary interval.
 */

/** Screens appear in 1-2s. */
const DEFAULT_TIMEOUT = 5000;

const QUICK_TIMEOUT = 2000;

/** GraphQL/API operations. */
const NETWORK_TIMEOUT = 5000;

/** Complex flows, or slow devices. */
const LONG_TIMEOUT = 20000;

/** App launch plus hydration. */
const LAUNCH_TIMEOUT = 30000;

export async function waitForElementToBeVisible(
  element: Detox.IndexableNativeElement,
  timeout: number = DEFAULT_TIMEOUT,
) {
  await waitFor(element).toBeVisible().withTimeout(timeout);
}

export async function waitForElementToDisappear(
  element: Detox.IndexableNativeElement,
  timeout: number = DEFAULT_TIMEOUT,
) {
  await waitFor(element).not.toBeVisible().withTimeout(timeout);
}

/** Modals/overlays: waits for invisible, then for removal from the tree. */
export async function waitForElementRemoval(
  element: Detox.IndexableNativeElement,
  timeout: number = DEFAULT_TIMEOUT,
) {
  try {
    await waitFor(element).not.toBeVisible().withTimeout(timeout / 2);
    await waitFor(element).not.toExist().withTimeout(timeout / 2);
  } catch (error) {
    console.warn('Element removal wait failed, continuing...', error);
  }
}

export async function waitForElementToExist(
  element: Detox.IndexableNativeElement,
  timeout: number = DEFAULT_TIMEOUT,
) {
  await waitFor(element).toExist().withTimeout(timeout);
}

export async function waitForText(text: string, timeout: number = DEFAULT_TIMEOUT) {
  await waitFor(element(by.text(text))).toBeVisible().withTimeout(timeout);
}

export async function waitForElementById(
  testID: string,
  timeout: number = DEFAULT_TIMEOUT,
) {
  await waitFor(element(by.id(testID))).toBeVisible().withTimeout(timeout);
}

export async function waitForScreen(
  screenTestID: string,
  timeout: number = NETWORK_TIMEOUT,
) {
  await waitFor(element(by.id(screenTestID)))
    .toBeVisible()
    .withTimeout(timeout);
}

/** Waits out a loading spinner/skeleton by testID; a bare delay without one. */
export async function waitForNetworkIdle(
  loadingIndicatorID?: string,
  timeout: number = NETWORK_TIMEOUT,
) {
  if (!loadingIndicatorID) {
    await delay(1000);
    return;
  }

  try {
    await waitFor(element(by.id(loadingIndicatorID)))
      .toBeVisible()
      .withTimeout(2000);
  } catch {
    // Already loaded — nothing to wait out.
  }

  try {
    await waitFor(element(by.id(loadingIndicatorID)))
      .not.toBeVisible()
      .withTimeout(timeout);
  } catch (error) {
    console.warn('Network idle wait timed out, continuing...', error);
  }
}

/** Call before typing, so the keyboard is up. */
export async function waitForKeyboard(timeout: number = QUICK_TIMEOUT) {
  // Android has no reliable keyboard matcher, so it just waits.
  if (device.getPlatform() === 'android') {
    await delay(500);
    return;
  }

  try {
    await waitFor(element(by.type('UIKeyboardLayoutStar')))
      .toExist()
      .withTimeout(timeout);
  } catch {
    // Already up, or the matcher missed it.
  }
}

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
    // Already gone.
  }
}

/** Retries the tap, which absorbs the visible-then-moved race. */
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

export async function waitForElementAndType(
  targetElement: Detox.IndexableNativeElement,
  text: string,
  timeout: number = DEFAULT_TIMEOUT,
  dismissKeyboard: boolean = true,
) {
  await waitFor(targetElement).toBeVisible().withTimeout(timeout);
  await targetElement.tap();

  await waitForKeyboard();

  await targetElement.clearText();
  await targetElement.typeText(text);

  if (dismissKeyboard) {
    // Back button on Android, return key on iOS.
    if (device.getPlatform() === 'android') {
      try {
        await device.pressBack();
      } catch {
        // Back not available here.
      }
    } else {
      try {
        await targetElement.tapReturnKey();
      } catch {
        // This field has no return key.
      }
    }

    await waitForKeyboardDismiss();
  }
}

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
      await waitFor(targetElement).toBeVisible().withTimeout(1000);
      return; // Found it!
    } catch {
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

/** Waits out the full lifecycle: exists, then visible, then settled. */
export async function waitForModalReady(
  modalTestID: string,
  timeout: number = DEFAULT_TIMEOUT,
) {
  await waitFor(element(by.id(modalTestID))).toExist().withTimeout(timeout / 3);
  await waitFor(element(by.id(modalTestID))).toBeVisible().withTimeout(timeout / 3);
  await delay(300);
}

export async function waitForModalClosed(
  modalTestID: string,
  timeout: number = DEFAULT_TIMEOUT,
) {
  await waitForElementRemoval(element(by.id(modalTestID)), timeout);
  await delay(200);
}

/** Last resort — prefer a condition-based wait. Android gets a 1.2x multiplier. */
export async function delay(ms: number) {
  const platformMultiplier = device.getPlatform() === 'android' ? 1.2 : 1.0;
  return new Promise(resolve => setTimeout(resolve, ms * platformMultiplier));
}

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

/** All must become visible. */
export async function waitForElements(
  elements: Detox.IndexableNativeElement[],
  timeout: number = DEFAULT_TIMEOUT,
) {
  await Promise.all(
    elements.map(el => waitFor(el).toBeVisible().withTimeout(timeout)),
  );
}

/** Returns the index of the first to appear — for flows that branch. */
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
        // Try the next one.
      }
    }
    await delay(200);
  }

  throw new Error('None of the elements became visible within timeout');
}

/** For UI variations across builds — differing testIDs or labels. */
export async function tapFirstAvailable(
  elements: Detox.IndexableNativeElement[],
  timeout: number = DEFAULT_TIMEOUT,
): Promise<number> {
  const index = await waitForAnyElement(elements, timeout);
  await elements[index].tap();
  return index;
}

/**
 * Non-throwing PRESENCE probe, for CHOOSING a path rather than asserting one.
 * `toExist`, not `toBeVisible`: Detox wants ~75% visibility, so a full-screen
 * container with the keyboard up is present yet reads as absent. Returns as
 * soon as the element appears, so the timeout caps only the negative case.
 */
export async function exists(
  testID: string,
  timeout: number = 1000,
): Promise<boolean> {
  try {
    await waitFor(element(by.id(testID))).toExist().withTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

/** For optional UI — hints, tooltips. Skips the action if absent. */
export async function waitIfPresent(
  targetElement: Detox.IndexableNativeElement,
  action: () => Promise<void>,
  checkTimeout: number = 2000,
) {
  try {
    await waitFor(targetElement).toBeVisible().withTimeout(checkTimeout);
    await action();
  } catch {
    console.log('Optional element not present, skipping...');
  }
}

export const TIMEOUTS = {
  QUICK: QUICK_TIMEOUT,
  DEFAULT: DEFAULT_TIMEOUT,
  NETWORK: NETWORK_TIMEOUT,
  LONG: LONG_TIMEOUT,
  LAUNCH: LAUNCH_TIMEOUT,
};
