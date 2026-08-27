import fs from 'fs';
import path from 'path';
import { getI18n } from '#/i18n/config';
import { appConfig } from '#/config/appConfig';

const LOCALES_DIR = path.join(__dirname, '..', '..', 'src', 'i18n', 'locales');
const LOCALES = ['en', 'es', 'it', 'sq'];

/** Every leaf string in a locale tree, with its dotted key. */
const flatten = (obj: unknown, prefix = ''): Array<[string, string]> => {
  const out: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.push([key, v]);
    else if (v && typeof v === 'object') out.push(...flatten(v, key));
  }
  return out;
};

const load = (locale: string) =>
  JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${locale}.json`), 'utf8'));

/**
 * The product name reaches copy through `{{appName}}`, fed by
 * `interpolation.defaultVariables` from `appConfig.identity.displayName`.
 *
 * Two ways that silently breaks, both worse than the literal it replaced:
 * a translation types the name in again (so a rebrand misses it), or the
 * variable is not supplied (so users read a raw `{{appName}}` on the login
 * screen). Neither shows up in `keysExist` or `localeParity`.
 */
describe('appName interpolation', () => {
  it.each(LOCALES)('%s hardcodes no product name', locale => {
    const offenders = flatten(load(locale))
      .filter(([, value]) => /Sous\s*Chef/i.test(value))
      .map(([key]) => key);

    expect(offenders).toEqual([]);
  });

  it('resolves {{appName}} to the configured display name', () => {
    const withVariable = flatten(load('en')).filter(([, v]) =>
      v.includes('{{appName}}'),
    );
    // Guard against the scan going vacuous if the copy is reworded.
    expect(withVariable.length).toBeGreaterThan(0);

    for (const [key] of withVariable) {
      const rendered = getI18n().t(key);
      expect(rendered).toContain(appConfig.identity.displayName);
      expect(rendered).not.toContain('{{appName}}');
    }
  });
});
