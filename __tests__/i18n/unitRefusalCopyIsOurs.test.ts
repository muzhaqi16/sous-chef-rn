import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * A UNIT_INVALID refusal carries an unlocalizable English `message` by
 * construction. The stock operations' `UnitEligibilityError` names the units
 * that would work (`validUnits`) and why (`denial`); those are the only parts of
 * the refusal the alert may use, around the app's own sentences.
 *
 * Source-scanned rather than rendered because the defect is a call site, not a
 * value: a test that renders one alert cannot see the other three.
 */
const read = (...p: string[]) => readFileSync(join(...p), 'utf8');

// Every mutation failure is described in one place.
const CONSUMERS = [join('src', 'apollo', 'utils', 'settleMutation.ts')];

it('every unit-refusal alert takes its body from the translator', () => {
  for (const file of CONSUMERS) {
    const source = read(file);
    const alerts = [
      ...source.matchAll(/errors\.invalidUnitTitle'\),\s*body:\s*([^\n]+)/g),
    ].map(m => m[1]!.trim());

    // Guards against the scan silently matching nothing.
    expect(alerts.length).toBeGreaterThan(0);
    for (const body of alerts) {
      expect(body).toMatch(/^(t\('errors\.|unitRefusalBody\()/);
    }
    // The helper builds from the translator and the refusal's fields alone.
    const helper = /function unitRefusalBody[\s\S]*?\n}\n/.exec(source)?.[0];
    if (helper) expect(helper).not.toMatch(/message/);
  }
});

it('the four locales all carry copy for the refusal and its field', () => {
  for (const locale of ['en', 'es', 'it', 'sq']) {
    const copy = JSON.parse(read('src', 'i18n', 'locales', `${locale}.json`));

    expect(copy.errors.codes.unitInvalid).toBeTruthy();
    // Without this key a ValidationError naming the field falls through to the
    // server's raw English, which is the one path localization cannot reach.
    expect(copy.errors.field.usageUnitId).toBeTruthy();
    // Nothing can fill its {{units}} slot any more.
    expect(copy.errors.validUnits).toBeUndefined();
  }
});
