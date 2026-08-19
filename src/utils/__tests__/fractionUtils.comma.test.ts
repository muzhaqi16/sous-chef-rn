import { parseFractionalInput } from '../fractionUtils';
import { getDeviceDecimalSeparator } from '../deviceLocale';

jest.mock('../deviceLocale', () => ({
  getDeviceDecimalSeparator: jest.fn(() => '.'),
}));

const onDeviceWithSeparator = (separator: '.' | ',') => {
  (getDeviceDecimalSeparator as jest.Mock).mockReturnValue(separator);
};

beforeEach(() => onDeviceWithSeparator('.'));

describe('parseFractionalInput accepts either decimal separator', () => {
  // This is the parser behind every quantity field. fraction.js throws
  // `Invalid argument` on a comma, so this returned null and the quantity was
  // rejected as invalid — on a device whose keypad offers no period at all.
  it.each([
    ['4,99', 4.99],
    ['1,5', 1.5],
    ['0,25', 0.25],
  ])('%s -> %p', (input, expected) => {
    expect(parseFractionalInput(input)).toBe(expected);
  });

  it.each([
    ['4.99', 4.99],
    ['1.5', 1.5],
    ['2', 2],
  ])('still reads %s as %p', (input, expected) => {
    expect(parseFractionalInput(input)).toBe(expected);
  });

  it.each([
    ['1 1/4', 1.25],
    ['3/4', 0.75],
    ['1 1/2', 1.5],
  ])('still reads the fraction %s as %p', (input, expected) => {
    expect(parseFractionalInput(input)).toBe(expected);
  });

  it('resolves the ambiguous single separator against the device', () => {
    onDeviceWithSeparator('.');
    expect(parseFractionalInput('1,234')).toBe(1234);

    onDeviceWithSeparator(',');
    expect(parseFractionalInput('1,234')).toBe(1.234);
  });

  it('still returns null for input that is not a number', () => {
    expect(parseFractionalInput('')).toBeNull();
    expect(parseFractionalInput('   ')).toBeNull();
    expect(parseFractionalInput('abc')).toBeNull();
  });
});
