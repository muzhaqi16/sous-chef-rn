import { stripPriceFromName } from '../stripPriceFromName';

describe('stripPriceFromName', () => {
  it('strips a trailing decimal price token', () => {
    // The exact shapes seen in the bug report (recipe-ingredient names that
    // round-tripped a legacy " $X.XX" token through to shopping-list items).
    expect(stripPriceFromName('chicken breasts $2.48')).toBe('chicken breasts');
    expect(stripPriceFromName('garlic $0.03')).toBe('garlic');
    expect(stripPriceFromName('romaine lettuce $0.80')).toBe('romaine lettuce');
    expect(stripPriceFromName('salt $0.02')).toBe('salt');
  });

  it('strips integer and trailing-dot price tokens', () => {
    expect(stripPriceFromName('eggs $3')).toBe('eggs');
    expect(stripPriceFromName('milk $2.')).toBe('milk');
  });

  it('trims surrounding whitespace', () => {
    expect(stripPriceFromName('  cinnamon $0.03  ')).toBe('cinnamon');
    expect(stripPriceFromName('  tomatoes  ')).toBe('tomatoes');
  });

  it('leaves clean names untouched', () => {
    expect(stripPriceFromName('chicken breasts')).toBe('chicken breasts');
    expect(stripPriceFromName('tomatoes')).toBe('tomatoes');
    expect(stripPriceFromName('Salt & Pepper')).toBe('Salt & Pepper');
  });

  it('only strips a price anchored to the end after whitespace', () => {
    // A price in the middle of the name is left alone (not a trailing token).
    expect(stripPriceFromName('Chicken $2 marinade')).toBe(
      'Chicken $2 marinade',
    );
    // No preceding whitespace → not treated as a price token.
    expect(stripPriceFromName('abc$5')).toBe('abc$5');
    expect(stripPriceFromName('$5')).toBe('$5');
  });

  it('handles empty input', () => {
    expect(stripPriceFromName('')).toBe('');
  });
});
