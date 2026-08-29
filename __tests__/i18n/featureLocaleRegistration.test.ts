import fs from 'fs';
import path from 'path';
import { FEATURE_LOCALES } from '#/i18n/featureLocales';
import { featureLocaleDirs } from '#/test-utils/mergedLocales';

/**
 * The gates read the same registration the runtime does.
 *
 * `src/i18n/featureLocales.ts` merges a HAND-WRITTEN map. Every gate —
 * `scripts/check-i18n.mjs`, `__tests__/helpers/mergedLocales.ts`, and through it
 * key-existence, canonical-vocabulary and locale parity — walks the FILESYSTEM
 * instead. Neither imports the map.
 *
 * So adding `src/features/<new>/locales/{en,es,it,sq}.json` and forgetting the
 * one entry produced: `check-i18n` prints "✓ i18n keys consistent across 4
 * locale(s)", every i18n suite passes, and at runtime every screen in that
 * feature renders raw dotted keys in all four languages. That is precisely the
 * failure the merge exists to prevent, and nothing could see it.
 *
 * This is the join. It runs in both directions, because each is a real defect:
 * a file with no entry never reaches the app, and an entry with no file is a
 * stale import that will not resolve.
 */

const ROOT = path.join(__dirname, '..', '..');
const FEATURES_DIR = path.join(ROOT, 'src', 'features');
const LOCALES = ['en', 'es', 'it', 'sq'] as const;

describe('feature locale registration', () => {
  const onDisk = featureLocaleDirs();
  const registered = Object.keys(FEATURE_LOCALES).sort();

  it('finds features shipping copy at all', () => {
    // A guard on the guard: an empty walk would make both directions vacuous.
    expect(onDisk.length).toBeGreaterThan(3);
  });

  it('every feature that ships copy is registered', () => {
    const unregistered = onDisk.filter(name => !(name in FEATURE_LOCALES));

    expect(unregistered).toEqual([]);
  });

  it('every registration names a feature that ships copy', () => {
    const orphaned = registered.filter(name => !onDisk.includes(name));

    expect(orphaned).toEqual([]);
  });

  it.each(registered.map(name => [name]))(
    '%s registers all four locales',
    feature => {
      const entry = FEATURE_LOCALES[feature];

      for (const locale of LOCALES) {
        expect(entry[locale]).toBeDefined();
        // A registered tree that resolved to `{}` would merge nothing and look
        // exactly like a working one.
        expect(Object.keys(entry[locale]).length).toBeGreaterThan(0);
      }
    },
  );

  it.each(onDisk.map(name => [name]))('%s ships all four locales', feature => {
    for (const locale of LOCALES) {
      const file = path.join(FEATURES_DIR, feature, 'locales', `${locale}.json`);
      expect(fs.existsSync(file)).toBe(true);
    }
  });
});
