import { BaseScreen } from './BaseScreen';
import { element, by, waitFor, expect } from 'detox';

export class OnboardingScreen extends BaseScreen {
  protected screenID = 'onboarding-screen';

  private readonly skipButton = 'onboarding-skip-button';
  private readonly nextButton = 'onboarding-next-button';
  private readonly getStartedButton = 'onboarding-get-started-button';
  private readonly backButton = 'onboarding-back-button';
  private readonly carousel = 'onboarding-carousel';
  private readonly pageIndicator = 'onboarding-page-indicator';

  private getPageByIndex(index: number) {
    return element(by.id(`onboarding-page-${index}`));
  }

  private getPageIndicatorDotByIndex(index: number) {
    return element(by.id(`onboarding-page-indicator-${index}`));
  }

  private getPageTitleByIndex(index: number) {
    return element(by.id(`onboarding-page-${index}-title`));
  }

  private getPageDescriptionByIndex(index: number) {
    return element(by.id(`onboarding-page-${index}-description`));
  }

  async skip() {
    await this.tapByID(this.skipButton);

    await waitFor(element(by.id(this.screenID)))
      .not.toBeVisible()
      .withTimeout(3000);
  }

  async tapNext() {
    await this.tapByID(this.nextButton);
  }

  async tapBack() {
    await this.tapByID(this.backButton);
  }

  async getStarted() {
    await this.tapByID(this.getStartedButton);

    await waitFor(element(by.id(this.screenID)))
      .not.toBeVisible()
      .withTimeout(3000);
  }

  async swipeToNextPage() {
    await this.swipe(this.carousel, 'left', 'fast');
  }

  async swipeToPreviousPage() {
    await this.swipe(this.carousel, 'right', 'fast');
  }

  async navigateThroughAllPages(totalPages: number) {
    for (let i = 0; i < totalPages - 1; i++) {
      await this.tapNext();
      await this.waitForElement(`onboarding-page-${i + 1}`, 2000);
    }
  }

  async swipeThroughAllPages(totalPages: number) {
    for (let i = 0; i < totalPages - 1; i++) {
      await this.swipeToNextPage();
      await this.waitForElement(`onboarding-page-${i + 1}`, 2000);
    }
  }

  async completeOnboarding(totalPages: number) {
    await this.waitForScreen();
    await this.navigateThroughAllPages(totalPages);
    await this.getStarted();
  }

  async completeOnboardingBySwipe(totalPages: number) {
    await this.waitForScreen();
    await this.swipeThroughAllPages(totalPages);
    await this.getStarted();
  }

  async expectPageVisible(pageIndex: number) {
    await this.expectVisible(`onboarding-page-${pageIndex}`);
  }

  async expectPageTitle(pageIndex: number, title: string) {
    await expect(this.getPageTitleByIndex(pageIndex)).toHaveText(title);
  }

  async expectPageDescription(pageIndex: number, description: string) {
    await expect(this.getPageDescriptionByIndex(pageIndex)).toHaveText(
      description,
    );
  }

  async expectSkipButtonVisible() {
    await this.expectVisible(this.skipButton);
  }

  async expectNextButtonVisible() {
    await this.expectVisible(this.nextButton);
  }

  async expectGetStartedButtonVisible() {
    await this.expectVisible(this.getStartedButton);
  }

  async expectBackButtonVisible() {
    await this.expectVisible(this.backButton);
  }

  /** The active dot carries a distinct id: `…-indicator-<i>-active`. */
  async expectPageIndicatorActive(pageIndex: number) {
    await this.expectVisible(`onboarding-page-indicator-${pageIndex}-active`);
  }

  async expectTotalPages(totalPages: number) {
    for (let i = 0; i < totalPages; i++) {
      await this.expectExists(`onboarding-page-indicator-${i}`);
    }
  }
}
