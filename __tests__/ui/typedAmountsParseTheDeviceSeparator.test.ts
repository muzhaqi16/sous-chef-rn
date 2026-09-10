import { readFileSync } from 'fs';
import { sync as glob } from 'glob';

/**
 * `decimal-pad` renders the DEVICE locale's separator, so a Spanish or Italian
 * phone offers `,` whatever the interface language is. `Number('25,50')` and
 * `parseFloat('25,50')` do not read that as 25.5 — the first is NaN and the
 * second silently truncates to 25 — and a save guarded on `!Number.isNaN`
 * then skips the write while the screen closes as though it saved.
 *
 * `parseDecimalInput` (or `parseFractionalInput` where fractions are allowed)
 * is the one converter that accepts both separators.
 */
const AMOUNT_INPUT = /\b(budget|price|amount|cost|quantity)Input\b/i;
const BARE_PARSE = /\b(Number|parseFloat)\s*\(\s*[A-Za-z_$][\w$]*[Ii]nput\b/;

const sources = glob('src/**/*.{ts,tsx}', {
  ignore: ['**/*.generated.ts', '**/__tests__/**'],
});

describe('a user-typed amount is parsed with the device separator', () => {
  it('is never read with a bare Number() or parseFloat()', () => {
    const offenders = sources
      .filter(file => {
        const src = readFileSync(file, 'utf8');
        return AMOUNT_INPUT.test(src) && BARE_PARSE.test(src);
      })
      .sort();

    // A new one means a field that silently drops fractional input on three of
    // the four locales this app ships.
    expect(offenders).toEqual([]);
  });

  it('finds the amount fields it is meant to be checking', () => {
    const scanned = sources.filter(f =>
      AMOUNT_INPUT.test(readFileSync(f, 'utf8')),
    );
    expect(scanned.length).toBeGreaterThan(3);
  });
});
