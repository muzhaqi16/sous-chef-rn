import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * A UNIT_INVALID refusal carries an unlocalizable English `message` by
 * construction, and no machine-readable list of the units that would work —
 * `schema.graphql` says so under UNIT_INVALID and directs clients to re-query
 * the ranked-unit list instead. Both halves were being read anyway: the dead
 * `validUnits` array, and the server's sentence shown verbatim to a Spanish,
 * Italian or Albanian reader.
 *
 * Source-scanned rather than rendered because the defect is a call site, not a
 * value: a test that renders one alert cannot see the other three.
 */
const read = (...p: string[]) => readFileSync(join(...p), 'utf8');

const CONSUMERS = [
  join('src', 'utils', 'errorHandlers.ts'),
  join('src', 'features', 'pantry', 'hooks', 'usePantryItemActions.ts'),
];

it('the unit-refusal helper exposes no server-authored message', () => {
  const source = read('src', 'utils', 'errors', 'invalidUnit.ts');

  expect(source).not.toMatch(/validUnits/);
  // A getter here is how the server's sentence reached the screen.
  expect(source).not.toMatch(/export function get/);
});

it('every unit-refusal alert takes its body from the translator', () => {
  for (const file of CONSUMERS) {
    const source = read(file);
    const alerts = [
      ...source.matchAll(/errors\.invalidUnitTitle'\),\s*([^\n]+)/g),
    ].map(m => m[1].trim());

    // Guards against the scan silently matching nothing.
    expect(alerts.length).toBeGreaterThan(0);
    for (const body of alerts) {
      expect(body).toMatch(/^t\('errors\./);
    }
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
