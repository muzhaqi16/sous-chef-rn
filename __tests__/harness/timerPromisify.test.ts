import { promisify } from 'util';

/**
 * `jest.setup.js` replaces the global timers with wrappers that `unref()` what
 * they return, so a stray timer cannot hold the worker open.
 *
 * An arrow wrapper does not inherit `util.promisify.custom`, and `__promisify__`
 * — the property it is tempting to forward instead — is a @types/node
 * declaration with no runtime existence, so copying it assigns `undefined` and
 * `promisify(setTimeout)` throws.
 */
describe('promisified global timers', () => {
  it('resolves with the value rather than throwing', async () => {
    await expect(promisify(setTimeout)(0, 'v')).resolves.toBe('v');
  });

  it('carries the custom symbol that promisify actually reads', () => {
    expect(typeof Reflect.get(setTimeout, promisify.custom)).toBe('function');
    // `__promisify__` never existed at runtime. Asserting it stays absent keeps
    // anyone from "restoring" the copy that did nothing.
    expect(Reflect.get(setTimeout, '__promisify__')).toBeUndefined();
  });

  // Node defines no custom promisifier for `setInterval`, so the wrapper has
  // nothing to forward — pinned so the asymmetry reads as deliberate.
  it('does not invent one for setInterval', () => {
    expect(Reflect.get(setInterval, promisify.custom)).toBeUndefined();
  });
});
