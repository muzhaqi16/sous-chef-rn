import { t } from '#/i18n';
import { formatCountryName } from '../region';

describe('formatCountryName', () => {
  it("names a country in the reader's language", () => {
    expect(formatCountryName('CA', t)).toBe('Canada');
    expect(formatCountryName('XK', t)).toBe('Kosovo');
  });

  it('falls back to the code when it names nothing', () => {
    expect(formatCountryName('ZZ', t)).toBe('ZZ');
  });
});
