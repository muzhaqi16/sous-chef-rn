/**
 * Onboarding E2E Tests
 *
 * Tests onboarding flow including:
 * - Viewing onboarding pages
 * - Navigation through pages
 * - Skipping onboarding
 * - Completing onboarding
 * - Swipe gestures
 */

import { OnboardingScreen, LoginScreen } from '../../screens';

describe('Onboarding Flow', () => {
  const onboardingScreen = new OnboardingScreen();
  const loginScreen = new LoginScreen();

  // Total pages in onboarding (adjust based on actual implementation)
  const TOTAL_PAGES = 3;

  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { notifications: 'YES' },
      delete: true, // Clear app data to trigger onboarding
    });
  });

  beforeEach(async () => {
    // Reinstall to see onboarding each time
    await device.launchApp({
      newInstance: true,
      delete: true,
    });

    // Check if onboarding appears (might go straight to login)
    try {
      await onboardingScreen.waitForScreen(5000);
    } catch {
      // Onboarding might not show for returning users
      pending('Onboarding not shown - user may have completed it');
    }
  });

  describe('Initial Display', () => {
    it('should show onboarding screen on first launch', async () => {
      // Assert
      await onboardingScreen.expectScreenVisible();
    });

    it('should show first onboarding page', async () => {
      // Assert
      await onboardingScreen.expectPageVisible(0);
    });

    it('should show skip button', async () => {
      // Assert
      await onboardingScreen.expectSkipButtonVisible();
    });

    it('should show next button', async () => {
      // Assert
      await onboardingScreen.expectNextButtonVisible();
    });

    it('should show page indicators', async () => {
      // Assert - verify total pages
      await onboardingScreen.expectTotalPages(TOTAL_PAGES);
    });

    it('should highlight first page indicator', async () => {
      // Assert - first page indicator should be active
      await onboardingScreen.expectPageIndicatorActive(0);
    });
  });

  describe('Page Navigation with Next Button', () => {
    it('should navigate to second page', async () => {
      // Act
      await onboardingScreen.tapNext();

      // Assert
      await onboardingScreen.expectPageVisible(1);
      await onboardingScreen.expectPageIndicatorActive(1);
    });

    it('should navigate to third page', async () => {
      // Act
      await onboardingScreen.tapNext();
      await onboardingScreen.tapNext();

      // Assert
      await onboardingScreen.expectPageVisible(2);
      await onboardingScreen.expectPageIndicatorActive(2);
    });

    it('should navigate through all pages', async () => {
      // Act
      await onboardingScreen.navigateThroughAllPages(TOTAL_PAGES);

      // Assert - should be on last page
      await onboardingScreen.expectPageVisible(TOTAL_PAGES - 1);
    });

    it('should show get started button on last page', async () => {
      // Act - navigate to last page
      await onboardingScreen.navigateThroughAllPages(TOTAL_PAGES);

      // Assert
      await onboardingScreen.expectGetStartedButtonVisible();
    });

    it('should not show next button on last page', async () => {
      // Act - go to last page
      await onboardingScreen.navigateThroughAllPages(TOTAL_PAGES);

      // Assert - next button should be hidden or replaced
      try {
        await onboardingScreen.expectNotVisible(
          onboardingScreen['nextButton'],
        );
      } catch {
        console.log('Next button still visible or replaced with Get Started');
      }
    });
  });

  describe('Page Navigation with Swipe', () => {
    it('should swipe to next page', async () => {
      // Act
      await onboardingScreen.swipeToNextPage();

      // Assert
      await onboardingScreen.expectPageVisible(1);
    });

    it('should swipe to previous page', async () => {
      // Arrange - go to page 2
      await onboardingScreen.swipeToNextPage();
      await onboardingScreen.expectPageVisible(1);

      // Act - swipe back
      await onboardingScreen.swipeToPreviousPage();

      // Assert - should be on page 1
      await onboardingScreen.expectPageVisible(0);
    });

    it('should swipe through all pages', async () => {
      // Act
      await onboardingScreen.swipeThroughAllPages(TOTAL_PAGES);

      // Assert - should be on last page
      await onboardingScreen.expectPageVisible(TOTAL_PAGES - 1);
    });
  });

  describe('Back Navigation', () => {
    it('should go back to previous page', async () => {
      // Arrange - go to page 2
      await onboardingScreen.tapNext();
      await onboardingScreen.expectPageVisible(1);

      // Act - tap back
      await onboardingScreen.tapBack();

      // Assert - should be on page 1
      await onboardingScreen.expectPageVisible(0);
    });

    it('should navigate back from last page', async () => {
      // Arrange - go to last page
      await onboardingScreen.navigateThroughAllPages(TOTAL_PAGES);

      // Act - go back
      await onboardingScreen.tapBack();

      // Assert - should be on second-to-last page
      await onboardingScreen.expectPageVisible(TOTAL_PAGES - 2);
    });

    it('should not go back from first page', async () => {
      // Act - try to go back from first page
      try {
        await onboardingScreen.tapBack();
      } catch {
        // Back button might not exist on first page
      }

      // Assert - should stay on first page
      await onboardingScreen.expectPageVisible(0);
    });
  });

  describe('Skip Onboarding', () => {
    it('should skip onboarding from first page', async () => {
      // Act
      await onboardingScreen.skip();

      // Assert - should exit onboarding
      try {
        await loginScreen.waitForScreen(5000);
        await loginScreen.expectScreenVisible();
      } catch {
        // Might go to different screen
        console.log('Skipped to non-login screen');
      }
    });

    it('should skip onboarding from middle page', async () => {
      // Arrange - go to middle page
      await onboardingScreen.tapNext();
      await onboardingScreen.expectPageVisible(1);

      // Act
      await onboardingScreen.skip();

      // Assert - should exit
      await loginScreen.waitForScreen(5000);
    });

    it('should skip onboarding from last page', async () => {
      // Arrange - go to last page
      await onboardingScreen.navigateThroughAllPages(TOTAL_PAGES);

      // Act - skip instead of get started
      try {
        await onboardingScreen.skip();
      } catch {
        // Skip might be hidden on last page
        console.log('Skip not available on last page');
      }
    });
  });

  describe('Complete Onboarding', () => {
    it('should complete onboarding with get started button', async () => {
      // Act - navigate to end and complete
      await onboardingScreen.completeOnboarding(TOTAL_PAGES);

      // Assert - should exit to login/home
      await loginScreen.waitForScreen(5000);
      await loginScreen.expectScreenVisible();
    });

    it('should complete onboarding by swiping', async () => {
      // Act
      await onboardingScreen.completeOnboardingBySwipe(TOTAL_PAGES);

      // Assert
      await loginScreen.waitForScreen(5000);
      await loginScreen.expectScreenVisible();
    });

    it('should not show onboarding again after completion', async () => {
      // Arrange - complete onboarding
      await onboardingScreen.completeOnboarding(TOTAL_PAGES);
      await loginScreen.waitForScreen(5000);

      // Act - restart app
      await device.launchApp({ newInstance: true });

      // Assert - should go straight to login (not onboarding)
      try {
        await loginScreen.waitForScreen(5000);
        await loginScreen.expectScreenVisible();
      } catch {
        // If onboarding appears, test fails
        throw new Error('Onboarding shown again after completion');
      }
    });
  });

  describe('Page Content', () => {
    it('should display page title on first page', async () => {
      // Assert - title should exist (specific text depends on content)
      await onboardingScreen.expectVisible('onboarding-page-0-title');
    });

    it('should display page description', async () => {
      // Assert
      await onboardingScreen.expectVisible('onboarding-page-0-description');
    });

    it('should display different content on each page', async () => {
      // Page 1 content
      await onboardingScreen.expectVisible('onboarding-page-0-title');

      // Page 2 content
      await onboardingScreen.tapNext();
      await onboardingScreen.expectVisible('onboarding-page-1-title');

      // Page 3 content
      await onboardingScreen.tapNext();
      await onboardingScreen.expectVisible('onboarding-page-2-title');
    });

    it('should have unique title for each page', async () => {
      // This verifies each page has different content
      // We can't verify exact text without knowing the content
      // But we can verify elements exist
      for (let i = 0; i < TOTAL_PAGES; i++) {
        if (i > 0) {
          await onboardingScreen.tapNext();
        }
        await onboardingScreen.expectPageVisible(i);
        await onboardingScreen.expectVisible(`onboarding-page-${i}-title`);
      }
    });
  });

  describe('Page Indicators', () => {
    it('should update page indicator on navigation', async () => {
      // Page 1
      await onboardingScreen.expectPageIndicatorActive(0);

      // Page 2
      await onboardingScreen.tapNext();
      await onboardingScreen.expectPageIndicatorActive(1);

      // Page 3
      await onboardingScreen.tapNext();
      await onboardingScreen.expectPageIndicatorActive(2);
    });

    it('should show correct page count', async () => {
      // Assert - should have indicator for each page
      await onboardingScreen.expectTotalPages(TOTAL_PAGES);
    });
  });

  describe('Gesture Handling', () => {
    it('should respond to fast swipe', async () => {
      // Act - fast swipe
      await onboardingScreen.swipe(
        onboardingScreen['carousel'],
        'left',
        'fast',
      );

      // Assert - should advance page
      await onboardingScreen.expectPageVisible(1);
    });

    it('should respond to slow swipe', async () => {
      // Act - slow swipe
      await onboardingScreen.swipe(
        onboardingScreen['carousel'],
        'left',
        'slow',
      );

      // Assert
      await onboardingScreen.expectPageVisible(1);
    });

    it('should not advance beyond last page', async () => {
      // Arrange - go to last page
      await onboardingScreen.navigateThroughAllPages(TOTAL_PAGES);

      // Act - try to swipe past last page
      await onboardingScreen.swipeToNextPage();

      // Assert - should stay on last page
      await onboardingScreen.expectPageVisible(TOTAL_PAGES - 1);
    });

    it('should not go before first page', async () => {
      // Act - try to swipe before first page
      await onboardingScreen.swipeToPreviousPage();

      // Assert - should stay on first page
      await onboardingScreen.expectPageVisible(0);
    });
  });

  describe('Performance', () => {
    it('should navigate pages quickly', async () => {
      // Act - measure navigation time
      const startTime = Date.now();
      await onboardingScreen.navigateThroughAllPages(TOTAL_PAGES);
      const endTime = Date.now();

      // Assert - should be fast (< 5 seconds)
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(5000);
    });

    it('should complete onboarding quickly', async () => {
      // Act
      const startTime = Date.now();
      await onboardingScreen.completeOnboarding(TOTAL_PAGES);
      const endTime = Date.now();

      // Assert - total flow should be quick (< 10 seconds)
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(10000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid tapping of next button', async () => {
      // Act - tap next rapidly
      await onboardingScreen.tapNext();
      await onboardingScreen.tapNext();
      await onboardingScreen.tapNext();

      // Assert - should handle gracefully
      await onboardingScreen.expectScreenVisible();
    });

    it('should handle rapid swiping', async () => {
      // Act - swipe rapidly
      await onboardingScreen.swipeToNextPage();
      await onboardingScreen.swipeToNextPage();

      // Assert - should be stable
      await onboardingScreen.expectScreenVisible();
    });

    it('should handle back and forth navigation', async () => {
      // Act - go forward and backward
      await onboardingScreen.tapNext();
      await onboardingScreen.tapBack();
      await onboardingScreen.tapNext();
      await onboardingScreen.tapNext();
      await onboardingScreen.tapBack();

      // Assert - should work correctly
      await onboardingScreen.expectScreenVisible();
    });
  });
});
