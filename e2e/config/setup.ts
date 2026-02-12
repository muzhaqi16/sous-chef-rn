/**
 * Jest setup file for E2E tests
 * Imported by init.ts which runs in the test framework context
 */

// Extend Jest timeout for individual tests
jest.setTimeout(300000); // 5 minutes

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

export {};
