import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * A number is never glued to a translated noun in code.
 *
 * `${count} ${t('recipes.ingredientsSuffix')}` looks harmless and is wrong three
 * ways at once:
 *
 *   - **No plural agreement.** At one it reads "1 ingredients". i18next picks
 *     the form from `count`; a suffix key has no count to pick from.
 *   - **Word order is assumed.** The number-then-noun order is English's. A
 *     locale that wants the number elsewhere, or a classifier between them, has
 *     nowhere to say so — the order lives in the code, not the translation.
 *   - **The number is not localised.** It reaches the screen through string
 *     interpolation rather than a formatter, so a comma-decimal locale gets a
 *     dot.
 *
 * The fix is one key holding the whole phrase, with the number interpolated
 * into it: `t('recipes.ingredientCount', { count })` against
 * `"{{count}} ingredient"` / `"{{count}} ingredients"`. The translation then
 * owns the agreement, the order, and the spacing.
 *
 * The same reasoning drove the worst instance of this, which was not a suffix
 * key at all: `formatQuantityBreakdown` appended a literal "s" for any count
 * but 1 — English pluralisation applied to a server-supplied unit label,
 * producing "2 lattinas" in Italian and "2 kgs" in English.
 *
 * This is a source-level scan, so it is a heuristic rather than a proof, and it
 * is written to fail on the code it was written against.
 */
const SRC = join(__dirname, '..', '..', 'src');

/**
 * A number-ish expression immediately followed by a `t(...)` call, inside a
 * template literal or as adjacent JSX expressions.
 *
 * Both forms are the same defect; they differ only in whether the concatenation
 * is written with `${}` or with JSX's implicit joining of sibling expressions.
 */
const PATTERNS: ReadonlyArray<{ name: string; regex: RegExp }> = [
  {
    // The first expression must contain no quote character. A quoted
    // expression is a separator or a conditional string — `${a ? ' · ' : ''}` —
    // which is joining, not gluing a number to a noun.
    name: 'template literal: `${number} ${t(...)}`',
    regex: /\$\{[^}'"`]*\}\s*\$\{\s*t(?:Global)?\(/g,
  },
  {
    name: 'JSX: {number} {t(...)}',
    regex: /\{[A-Za-z_$][\w.$?[\]]*\}\s*\{\s*t(?:Global)?\(/g,
  },
  {
    name: 'English "s" suffix on a variable label',
    regex: /\$\{[^}]*\?\s*'s'\s*:\s*''\}|\+\s*\(\s*\w+\s*!==?\s*1\s*\?\s*'s'/g,
  },
];

/**
 * Known-good matches, each with the reason. Empty today — kept so an exception
 * is recorded rather than the pattern being loosened for everyone.
 */
const ALLOWED: ReadonlyArray<{ file: string; reason: string }> = [];

const sourceFiles = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === '__mocks__') continue;
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry) && !entry.endsWith('.generated.ts')) {
      out.push(full);
    }
  }
  return out;
};

describe('numbers are interpolated into translations, not concatenated', () => {
  const files = sourceFiles(SRC);

  it('scans a meaningful number of files', () => {
    // A broken walk would make every assertion below pass vacuously.
    expect(files.length).toBeGreaterThan(100);
  });

  it.each(PATTERNS)('no $name', ({ regex }) => {
    const offenders: string[] = [];

    for (const file of files) {
      const rel = relative(join(__dirname, '..', '..'), file);
      if (ALLOWED.some(a => a.file === rel)) continue;
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(new RegExp(regex.source, 'g'))) {
        const line = source.slice(0, match.index).split('\n').length;
        offenders.push(`${rel}:${line}  ${match[0].replace(/\s+/g, ' ')}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('the patterns still match the shapes they were written for', () => {
    // Non-trivial regexes that quietly stop matching are how a check like this
    // rots into decoration.
    const samples = [
      '`${totalTime} ${t(\'recipes.minutes\')}`',
      "{recipe.servings} {t('recipes.servingsSuffix')}",
      "`${total} ${label}${total !== 1 ? 's' : ''}`",
    ];

    const missed = samples.filter(
      sample => !PATTERNS.some(p => new RegExp(p.regex.source).test(sample)),
    );

    expect(missed).toEqual([]);
  });
});
