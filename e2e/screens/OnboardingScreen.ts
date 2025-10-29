/**
 * OnboardingScreen
 *
 * Screen object model for the Onboarding flow.
 * Provides methods for interacting with onboarding screens and steps.
 */

import { BaseScreen } from './BaseScreen';
import { element, by, waitFor } from 'detox';

export class OnboardingScreen extends BaseScreen {
  protected screenID = 'onboarding-screen';

  // Element IDs
  private readonly skipButton = 'onboarding-skip-button';
  private readonly nextButton = 'onboarding-next-button';
  private readonly getStartedButton = 'onboarding-get-started-button';
  private readonly backButton = 'onboarding-back-button';
  private readonly carousel = 'onboarding-carousel';
  private readonly pageIndicator = 'onboarding-page-indicator';

  /**
   * Get onboarding page by index
   */
  private getPageByIndex(index: number) {
    return element(by.id(`onboarding-page-${index}`));
  }

  /**
   * Get page indicator dot by index
   */
  private getPageIndicatorDotByIndex(index: number) {
    return element(by.id(`onboarding-page-indicator-${index}`));
  }

  /**
   * Get page title by index
   */
  private getPageTitleByIndex(index: number) {
    return element(by.id(`onboarding-page-${index}-title`));
  }

  /**
   * Get page description by index
   */
  private getPageDescriptionByIndex(index: number) {
    return element(by.id(`onboarding-page-${index}-description`));
  }

  /**
   * Skip onboarding
   */
  async skip() {
    await this.tapByID(this.skipButton);

    // Wait for onboarding to close and navigate to next screen
    await waitFor(element(by.id(this.screenID)))
      .not.toBeVisible()
      .withTimeout(3000);
  }

  /**
   * Tap next button to go to next onboarding page
   */
  async tapNext() {
    await this.tapByID(this.nextButton);
  }

  /**
   * Tap back button to go to previous onboarding page
   */
  async tapBack() {
    await this.tapByID(this.backButton);
  }

  /**
   * Complete onboarding by tapping "Get Started"
   */
  async getStarted() {
    await this.tapByID(this.getStartedButton);

    // Wait for onboarding to close
    await waitFor(element(by.id(this.screenID)))
      .not.toBeVisible()
      .withTimeout(3000);
  }

  /**
   * Swipe to next page
   */
  async swipeToNextPage() {
    await this.swipe(this.carousel, 'left', 'fast');
  }

  /**
   * Swipe to previous page
   */
  async swipeToPreviousPage() {
    await this.swipe(this.carousel, 'right', 'fast');
  }

  /**
   * Navigate through all onboarding pages using next button
   */
  async navigateThroughAllPages(totalPages: number) {
    for (let i = 0; i < totalPages - 1; i++) {
      await this.tapNext();
      await this.waitForElement(`onboarding-page-${i + 1}`, 2000);
    }
  }

  /**
   * Navigate through all onboarding pages by swiping
   */
  async swipeThroughAllPages(totalPages: number) {
    for (let i = 0; i < totalPages - 1; i++) {
      await this.swipeToNextPage();
      await this.waitForElement(`onboarding-page-${i + 1}`, 2000);
    }
  }

  /**
   * Complete full onboarding flow
   */
  async completeOnboarding(totalPages: number) {
    await this.waitForScreen();
    await this.navigateThroughAllPages(totalPages);
    await this.getStarted();
  }

  /**
   * Complete onboarding by swiping
   */
  async completeOnboardingBySwipe(totalPages: number) {
    await this.waitForScreen();
    await this.swipeThroughAllPages(totalPages);
    await this.getStarted();
  }

  /**
   * Expect specific page to be visible
   */
  async expectPageVisible(pageIndex: number) {
    await this.expectVisible(`onboarding-page-${pageIndex}`);
  }

  /**
   * Expect page title
   */
  async expectPageTitle(pageIndex: number, title: string) {
    await expect(this.getPageTitleByIndex(pageIndex)).toHaveText(title);
  }

  /**
   * Expect page description
   */
  async expectPageDescription(pageIndex: number, description: string) {
    await expect(this.getPageDescriptionByIndex(pageIndex)).toHaveText(
      description,
    );
  }

  /**
   * Expect skip button to be visible
   */
  async expectSkipButtonVisible() {
    await this.expectVisible(this.skipButton);
  }

  /**
   * Expect next button to be visible
   */
  async expectNextButtonVisible() {
    await this.expectVisible(this.nextButton);
  }

  /**
   * Expect get started button to be visible
   */
  async expectGetStartedButtonVisible() {
    await this.expectVisible(this.getStartedButton);
  }

  /**
   * Expect back button to be visible
   */
  async expectBackButtonVisible() {
    await this.expectVisible(this.backButton);
  }

  /**
   * Expect page indicator to show current page
   */
  async expectPageIndicatorActive(pageIndex: number) {
    await this.expectVisible(`onboarding-page-indicator-${pageIndex}-active`);
  }

  /**
   * Expect total number of pages
   */
  async expectTotalPages(totalPages: number) {
    for (let i = 0; i < totalPages; i++) {
      await this.expectExists(`onboarding-page-indicator-${i}`);
    }
  }
}
