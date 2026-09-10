import { getExpirationStatus } from '#features/pantry/hooks/usePantryItemTransformation';

/**
 * The row's border and its expiry text read the same state.
 *
 * Both come from one `expiresIn`, and `getExpirationStatus` has four levels
 * against three visual ones — so the collapse has to happen in one place. An
 * item expiring TODAY is `critical`, which is not expired, and must not draw a
 * warning border above expired-red text.
 *
 * Every boundary is pinned, not just the one that bites, so a new level in
 * `getExpirationStatus` cannot land on one side only.
 */
const toItemVariant = (type: string): string => {
  if (type === 'expired') return 'expired';
  if (type === 'critical' || type === 'warning') return 'warning';
  return 'normal';
};

describe('the expiry ladder', () => {
  it.each([
    [-8, 'expired', 'expired'],
    [-1, 'expired', 'expired'],
    [0, 'critical', 'warning'],
    [1, 'warning', 'warning'],
    [3, 'warning', 'warning'],
    [4, 'normal', 'normal'],
    [null, 'normal', 'normal'],
  ])('expiresIn %s is %s, shown as %s', (expiresIn, type, variant) => {
    const status = getExpirationStatus(expiresIn as number | null);
    expect(status.type).toBe(type);
    expect(toItemVariant(status.type)).toBe(variant);
  });

  // The bug in one line: today has not expired.
  it('does not call an item expiring today expired', () => {
    expect(toItemVariant(getExpirationStatus(0).type)).not.toBe('expired');
  });
});
