import { formatCountryName } from '../region';

describe('formatCountryName', () => {
  it("names a country in the reader's language", () => {
    expect(formatCountryName('CA', 'en')).toBe('Canada');
    expect(formatCountryName('DE', 'es')).toBe('Alemania');
  });

  it('falls back to the code when it names nothing', () => {
    expect(formatCountryName('not-a-code', 'en')).toBe('not-a-code');
  });
});
