import { readFileSync } from 'fs';

/**
 * The toast rests at the top inset — the same band every screen header
 * occupies — so it always overlaps a header. What decides whether it is
 * READABLE there is native view order: iOS 26's liquid-glass material
 * composites above sibling RN views whatever their `zIndex`, so a toast
 * mounted inside the navigator's subtree renders behind the header's glass.
 */
const APP = readFileSync('App.tsx', 'utf8');
const TOAST = readFileSync('src/components/molecules/Toast.tsx', 'utf8');

it('mounts the toast as a leaf, not as a wrapper around the navigator', () => {
  // Wrapping is what put it below every header.
  expect(APP).not.toMatch(/<ToastProvider>/);
  expect(APP).toMatch(/<ToastProvider\s*\/>/);
});

it('mounts it last, after the global backdrop', () => {
  const backdrop = APP.indexOf('<GlobalBackdrop />');
  const toast = APP.indexOf('<ToastProvider />');

  expect(backdrop).toBeGreaterThan(-1);
  expect(toast).toBeGreaterThan(backdrop);
});

it('keeps children optional, which is what lets it be a leaf', () => {
  expect(TOAST).toMatch(/children\?: ReactNode/);
});

it('exposes no context, so nothing needs to sit inside it', () => {
  // A context would force it back to wrapping the tree.
  expect(TOAST).not.toMatch(/createContext/);
});
