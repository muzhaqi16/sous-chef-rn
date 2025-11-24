/**
 * BaseScreen
 *
 * Base class for all screen object models.
 * Provides common functionality for interacting with screens in E2E tests.
 */

import { element, by, waitFor, device } from 'detox';

export abstract class BaseScreen {
  /**
   * The test ID of the screen container.
   * Must be implemented by subclasses.
   */
  protected abstract screenID: string;

  /**
   * Get the screen container element
   */
  get screen() {
    return element(by.id(this.screenID));
  }

  /**
   * Wait for the screen to be visible (5 second max - screens appear in 1-2s)
   */
  async waitForScreen(timeout: number = 5000) {
    await waitFor(this.screen).toBeVisible().withTimeout(timeout);
  }

  /**
   * Assert that the screen is visible (wait first, then check)
   */
  async expectScreenVisible() {
    await this.waitForScreen();
    await expect(this.screen).toBeVisible();
  }

  /**
   * Find element by test ID
   */
  protected getElementById(testID: string) {
    return element(by.id(testID));
  }

  /**
   * Find element by text
   */
  protected getElementByText(text: string) {
    return element(by.text(text));
  }

  /**
   * Find element by label (iOS) or contentDescription (Android)
   */
  protected getElementByLabel(label: string) {
    return element(by.label(label));
  }

  /**
   * Tap element by test ID (wait for element first)
   */
  async tapByID(testID: string) {
    await this.waitForElement(testID);
    await this.getElementById(testID).tap();
  }

  /**
   * Tap element by text (wait for element first)
   */
  async tapByText(text: string) {
    await waitFor(this.getElementByText(text))
      .toBeVisible()
      .withTimeout(5000);
    await this.getElementByText(text).tap();
  }

  /**
   * Type text into field by test ID
   */
  async typeIntoField(testID: string, text: string) {
    await this.getElementById(testID).typeText(text);
  }

  /**
   * Clear field and type text
   */
  async clearAndType(testID: string, text: string) {
    const field = this.getElementById(testID);
    await field.clearText();
    await field.typeText(text);
  }

  /**
   * Scroll to element within the screen
   */
  async scrollTo(testID: string, direction: 'top' | 'bottom' = 'bottom') {
    await this.getElementById(testID).scrollTo(direction);
  }

  /**
   * Swipe element
   */
  async swipe(
    testID: string,
    direction: 'left' | 'right' | 'up' | 'down',
    speed: 'fast' | 'slow' = 'fast',
  ) {
    await this.getElementById(testID).swipe(direction, speed);
  }

  /**
   * Wait for element to be visible
   */
  async waitForElement(testID: string, timeout: number = 5000) {
    await waitFor(this.getElementById(testID))
      .toBeVisible()
      .withTimeout(timeout);
  }

  /**
   * Wait for element to disappear
   */
  async waitForElementToDisappear(testID: string, timeout: number = 5000) {
    await waitFor(this.getElementById(testID))
      .not.toBeVisible()
      .withTimeout(timeout);
  }

  /**
   * Expect element to be visible (wait first, then check)
   */
  async expectVisible(testID: string) {
    await this.waitForElement(testID);
    await expect(this.getElementById(testID)).toBeVisible();
  }

  /**
   * Expect element to not be visible (wait first, then check)
   */
  async expectNotVisible(testID: string) {
    await this.waitForElementToDisappear(testID);
    await expect(this.getElementById(testID)).not.toBeVisible();
  }

  /**
   * Expect element to exist (may not be visible)
   */
  async expectExists(testID: string) {
    await waitFor(this.getElementById(testID))
      .toExist()
      .withTimeout(5000);
    await expect(this.getElementById(testID)).toExist();
  }

  /**
   * Expect text to be visible (wait first, then check)
   */
  async expectTextVisible(text: string) {
    await waitFor(this.getElementByText(text))
      .toBeVisible()
      .withTimeout(5000);
    await expect(this.getElementByText(text)).toBeVisible();
  }

  /**
   * Expect element to have text
   */
  async expectElementText(testID: string, text: string) {
    await expect(this.getElementById(testID)).toHaveText(text);
  }

  /**
   * Dismiss keyboard
   */
  async dismissKeyboard() {
    if (device.getPlatform() === 'ios') {
      try {
        await element(by.id('keyboard-dismiss-button')).tap();
      } catch {
        // Fallback: tap outside keyboard area
        await this.screen.tap();
      }
    } else {
      // On Android, tap outside the input field to dismiss keyboard
      // Using pressBack() can navigate away from the screen
      try {
        await this.screen.tap({ x: 10, y: 10 });
      } catch {
        // Fallback: use pressBack but only if necessary
        await device.pressBack();
      }
    }
  }

  /**
   * Go back using native back button
   */
  async goBack() {
    if (device.getPlatform() === 'ios') {
      await this.tapByID('back-button');
    } else {
      await device.pressBack();
    }
  }

  /**
   * Take screenshot with screen name
   */
  async takeScreenshot(suffix?: string) {
    const screenshotName = suffix
      ? `${this.screenID}-${suffix}`
      : this.screenID;
    await device.takeScreenshot(screenshotName);
  }

  /**
   * Reload React Native
   */
  async reloadApp() {
    await device.reloadReactNative();
  }
}
