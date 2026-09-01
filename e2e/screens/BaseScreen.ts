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

  /** The field holding the keyboard, for screens whose return key blurs. */
  protected keyboardInput?: string;

  /**
   * A hittable region ABOVE the keyboard. Tapping the screen container instead
   * cannot work: a tap needs the element 100% hittable and the keyboard is
   * exactly what covers it.
   */
  protected blurTarget?: string;

  /**
   * Drop the keyboard. The return key alone is not enough under `focusChaining`,
   * where it ADVANCES a field and the keyboard stays up, so a declared
   * {@link blurTarget} is tapped after it. A screen with NEITHER cannot act,
   * and returning quietly would report success for work not done.
   */
  async dismissKeyboard(inputTestID: string | undefined = this.keyboardInput) {
    if (!inputTestID && !this.blurTarget) {
      throw new Error(
        `${this.constructor.name} has no keyboardInput or blurTarget, so dismissKeyboard cannot act. Declare a blurTarget: a testID above the keyboard that carries no press handler.`,
      );
    }
    if (inputTestID) {
      try {
        await this.getElementById(inputTestID).tapReturnKey();
      } catch {
        // Nothing focused.
      }
    }
    if (!this.blurTarget) return;
    try {
      await this.getElementById(this.blurTarget).tap();
    } catch {
      // Already blurred, or the target is off screen.
    }
  }

  /**
   * Tap a control the keyboard may cover, re-blurring between attempts. Neither
   * dismissal alone is reliable across these forms — the return key submits on
   * some and only chains focus on others — so retry rather than pick one.
   */
  protected async tapPastKeyboard(testID: string, attempts: number = 3) {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        await this.tapByID(testID);
        return;
      } catch (error) {
        if (attempt === attempts) throw error;
        await this.dismissKeyboard();
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
