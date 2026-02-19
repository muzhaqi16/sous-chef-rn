/**
 * Minimal App smoke test.
 *
 * The App component has deep native-module dependencies that make full rendering
 * impractical in a Jest environment. Real integration testing is covered by the
 * Detox E2E suite. This test verifies the module is importable.
 */

describe('App module', () => {
  it('exports a default component', () => {
    // Validate the module exists and has a default export.
    // We don't render it here because it pulls in the full navigation tree,
    // Apollo client, and many native modules.
    const mod = require('../App');
    expect(mod).toBeDefined();
    expect(typeof mod.default === 'function' || typeof mod === 'function').toBe(true);
  });
});
