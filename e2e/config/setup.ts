/**
 * Jest setup file for E2E tests
 * Runs after the test framework is installed in the environment
 */

// Extend Jest timeout for individual tests
jest.setTimeout(300000); // 5 minutes

// Add custom matchers if needed
expect.extend({
  // Example custom matcher for Detox-specific assertions
  async toBeVisibleAndTappable(element: Detox.IndexableNativeElement) {
    try {
      await element.tap();
      return {
        message: () => 'Element is visible and tappable',
        pass: true,
      };
    } catch (error) {
      return {
        message: () => `Element is not visible or tappable: ${error}`,
        pass: false,
      };
    }
  },
});

// Global error handler for uncaught promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit process, let test framework handle it
});

// Configure console output
if (process.env.CI) {
  // In CI, reduce console noise
  global.console = {
    ...console,
    debug: jest.fn(), // Suppress debug logs in CI
  };
}

// Add global utilities for tests
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeVisibleAndTappable(): Promise<R>;
    }
  }
}

export {};
