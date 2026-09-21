import {
  formatQuantityForDisplay,
  formatQuantityForInput,
} from '../formatQuantity';
import { parseDecimalInput } from '../parseDecimalInput';
import { getDeviceDecimalSeparator } from '../deviceLocale';

jest.mock('../deviceLocale', () => ({
  getDeviceDecimalSeparator: jest.fn(() => '.'),
}));

const onDeviceWithSeparator = (separator: '.' | ',') => {
  (getDeviceDecimalSeparator as jest.Mock).mockReturnValue(separator);
};

/**
 * A quantity seeded into a field and read back unchanged must be the same
 * quantity. Raising the displayed precision to three decimals made every
 * eighth and every third ambiguous with thousands grouping on a comma device,
 * so `1.125` read back as `1125`.
 */

beforeEach(() => onDeviceWithSeparator(','));

describe('a quantity written by the app and read back by the app', () => {
  // `formatQuantityForInput` is the ONE seed for an editable quantity, and it
  // writes the device's separator. Seeding with a display formatter instead
  // writes a period, which the same device then reads as grouping.
  it.each([1.125, 1.333, 1.375, 1.625, 2.667, 0.125, 12.5])(
    'round-trips %p through the field it seeds',
    value => {
      const seeded = formatQuantityForInput(value, { notation: 'decimal' });
      expect(parseDecimalInput(seeded)).toBeCloseTo(value, 3);
    },
  );

  it('reads a typed thousand as a thousand', () => {
    // The grouping heuristic is deliberate and separately tested; nothing here
    // may change what a person typing `1.234` on a comma device means.
    expect(parseDecimalInput('1.234')).toBe(1234);
  });
});

describe('stored entry text is service text', () => {
  // `quantityInput` is what the API echoes back, so its separator is always a
  // period regardless of the device.
  it.each([
    ['1.125', '1 1/8'],
    ['1.333', '1 1/3'],
    ['0.125', '1/8'],
  ])('renders %s as %s', (quantityInput, rendered) => {
    expect(formatQuantityForDisplay(1.125, { quantityInput })).toBe(rendered);
  });

  it('still keeps text no parser can read', () => {
    expect(formatQuantityForDisplay(1, { quantityInput: 'a pinch' })).toBe(
      'a pinch',
    );
  });
});
