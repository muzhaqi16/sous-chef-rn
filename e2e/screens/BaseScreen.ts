import { element, by, waitFor, device, expect } from 'detox';

export abstract class BaseScreen {
  protected abstract screenID: string;

  get screen() {
    return element(by.id(this.screenID));
  }

  /** The 5s default is generous — screens appear in 1-2s. */
  async waitForScreen(timeout: number = 5000) {
    await waitFor(this.screen).toBeVisible().withTimeout(timeout);
  }

  async expectScreenVisible() {
    await this.waitForScreen();
    await expect(this.screen).toBeVisible();
  }

  protected getElementById(testID: string) {
    return element(by.id(testID));
  }

  protected getElementByText(text: string) {
    return element(by.text(text));
  }

  /** `by.label` is the iOS accessibilityLabel, the Android contentDescription. */
  protected getElementByLabel(label: string) {
    return element(by.label(label));
  }

  async tapByID(testID: string) {
    await this.waitForElement(testID);
    await this.getElementById(testID).tap();
  }

  async tapByText(text: string) {
    await waitFor(this.getElementByText(text))
      .toBeVisible()
      .withTimeout(5000);
    await this.getElementByText(text).tap();
  }

  async typeIntoField(testID: string, text: string) {
    await this.getElementById(testID).typeText(text);
  }

  async clearAndType(testID: string, text: string) {
    const field = this.getElementById(testID);
    await field.clearText();
    await field.typeText(text);
  }

  async scrollTo(testID: string, direction: 'top' | 'bottom' = 'bottom') {
    await this.getElementById(testID).scrollTo(direction);
  }

  async swipe(
    testID: string,
    direction: 'left' | 'right' | 'up' | 'down',
    speed: 'fast' | 'slow' = 'fast',
  ) {
    await this.getElementById(testID).swipe(direction, speed);
  }

  async waitForElement(testID: string, timeout: number = 5000) {
    await waitFor(this.getElementById(testID))
      .toBeVisible()
      .withTimeout(timeout);
  }

  async waitForElementToDisappear(testID: string, timeout: number = 5000) {
    await waitFor(this.getElementById(testID))
      .not.toBeVisible()
      .withTimeout(timeout);
  }

  async expectVisible(testID: string) {
    await this.waitForElement(testID);
    await expect(this.getElementById(testID)).toBeVisible();
  }

  async expectNotVisible(testID: string) {
    await this.waitForElementToDisappear(testID);
    await expect(this.getElementById(testID)).not.toBeVisible();
  }

  /** Existence only — an element can exist while off-screen or covered. */
  async expectExists(testID: string) {
    await waitFor(this.getElementById(testID))
      .toExist()
      .withTimeout(5000);
    await expect(this.getElementById(testID)).toExist();
  }

  async expectTextVisible(text: string) {
    await waitFor(this.getElementByText(text))
      .toBeVisible()
      .withTimeout(5000);
    await expect(this.getElementByText(text)).toBeVisible();
  }

  async expectElementText(testID: string, text: string) {
    await expect(this.getElementById(testID)).toHaveText(text);
  }

  async dismissKeyboard() {
    if (device.getPlatform() === 'ios') {
      // The Return key's label varies (Return, Done, Go), so `by.label('return')`
      // often misses; tapping the screen container to blur is the fallback.
      try {
        await element(by.label('return')).atIndex(0).tap();
      } catch {
        try {
          await this.screen.tap({ x: 10, y: 10 });
        } catch {
          // No keyboard up — nothing to dismiss.
        }
      }
    } else {
      // pressBack() can navigate away from the screen, so tap outside first.
      try {
        await this.screen.tap({ x: 10, y: 10 });
      } catch {
        await device.pressBack();
      }
    }
  }

  async goBack() {
    if (device.getPlatform() === 'ios') {
      await this.tapByID('header-back-button');
    } else {
      await device.pressBack();
    }
  }

  async takeScreenshot(suffix?: string, description?: string) {
    try {
      const timestamp = Date.now();
      const parts = [this.screenID];
      if (suffix) parts.push(suffix);
      if (description) parts.push(description.replace(/[^a-zA-Z0-9]/g, '_'));
      parts.push(String(timestamp));
      const screenshotName = parts.join('-');
      await device.takeScreenshot(screenshotName);
      console.log(`Screenshot: ${screenshotName}`);
    } catch (error) {
      console.warn(`Failed to take screenshot: ${error}`);
    }
  }

  async reloadApp() {
    await device.reloadReactNative();
  }
}
