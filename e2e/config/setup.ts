/** Runs in the test-framework context, imported by init.ts. */

jest.setTimeout(300000); // 5 minutes

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit process, let test framework handle it
});

if (process.env.CI) {
  global.console = {
    ...console,
    debug: jest.fn(), // Suppress debug logs in CI
  };
}

export {};
