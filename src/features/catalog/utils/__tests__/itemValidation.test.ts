import { changeLanguage } from '#/i18n/config';
import { unitsRule } from '../itemValidation';

/**
 * The units rows validate on every keystroke, so their number rules are the
 * ones a typed "0" (on the way to "0.5") or a lone separator reaches. Each
 * carries the app's own copy in the active language — never yup's English
 * default, which names the field by its internal path.
 */
describe('unitsRule messages', () => {
  afterEach(async () => {
    await changeLanguage('en');
  });

  it('reports a zero package size in the active language', async () => {
    await changeLanguage('es');
    await expect(
      unitsRule.validate([{ unitName: 'bag', packageSize: 0 }]),
    ).rejects.toThrow('Debe ser mayor que 0');
  });

  it('reports an unparseable package size with the same copy', async () => {
    await expect(
      unitsRule.validate([{ unitName: 'bag', packageSize: Number.NaN }]),
    ).rejects.toThrow('Must be greater than 0');
  });

  it('reports a zero conversion ratio', async () => {
    await expect(
      unitsRule.validate([{ unitName: 'bag', conversionRatio: 0 }]),
    ).rejects.toThrow('Must be greater than 0');
  });
});
