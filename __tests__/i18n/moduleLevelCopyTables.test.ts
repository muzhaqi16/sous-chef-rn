import fs from 'fs';
import path from 'path';

/**
 * The one shape no lint rule in this repo can see.
 *
 * `i18next/no-literal-string` checks JSX text and copy-carrying attributes; the
 * `no-restricted-syntax` sink selectors check toasts and alerts. Both look at
 * the point where a string is *written*. A module-level table —
 *
 *   const STEPS = [{ instruction: 'Swipe right to see item actions' }];
 *   …
 *   <Text>{step.instruction}</Text>
 *
 * — writes the string somewhere neither rule inspects and renders it as an
 * identifier, which is indistinguishable from any other variable. Four separate
 * sweeps missed exactly this shape, and it was found each time by grep, which
 * means it was only ever caught when someone thought to look.
 *
 * The same shape is a second bug independent of translation: a `const`
 * evaluated at import time freezes whichever language loaded first, so even a
 * localized table built this way stops following a language change. The fix for
 * both is the same — hold **key paths** and resolve with `t` at render, or make
 * the table a factory taking `t`.
 *
 * This is a heuristic, not a proof. It reads the source rather than the AST and
 * matches quoted values that look like English prose. It is here to make the
 * grep repeatable and to fail a PR that reintroduces the shape, not to
 * guarantee the category is empty.
 */
const SRC = path.join(__dirname, '..', '..', 'src');

/**
 * Values that match the prose heuristic but are not copy. Each entry is a
 * decision, so adding one should be deliberate.
 */
const ALLOWED = [
  // Platform font stacks — 'Helvetica' is a typeface, not a sentence.
  'components/charts/TrendLineChart.tsx',
];

/** A quoted value that reads like English prose: two or more words, or one
 *  capitalised word followed by a comma inside an object/array literal. */
const PROSE = /:\s*'([A-Z][a-z]+(?:[ /][A-Za-z&]+)+)'/;

/** `const NAME = ` / `export const NAME: T = ` at column 0. */
const MODULE_CONST = /^(?:export\s+)?const\s+[A-Za-z_][A-Za-z0-9_]*\b/;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['__tests__', '__mocks__', 'generated', 'locales'].includes(entry.name))
        continue;
      sourceFiles(full, out);
    } else if (/\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Lines of prose inside the 12 lines following a module-level `const`. */
function findCopyTables(file: string): string[] {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const hits: string[] = [];
  lines.forEach((line, index) => {
    if (!MODULE_CONST.test(line)) return;
    for (let i = index; i < Math.min(index + 12, lines.length); i++) {
      // Stop at the next module-level statement.
      if (i > index && /^[a-zA-Z}]/.test(lines[i]) && !/^\s/.test(lines[i]))
        break;
      const match = PROSE.exec(lines[i]);
      if (match) hits.push(`${file.slice(SRC.length + 1)}:${i + 1}  ${match[1]}`);
    }
  });
  return hits;
}

describe('module-level tables of user-visible copy', () => {
  it('are not reintroduced — hold key paths or take t, never resolved strings', () => {
    const offenders = sourceFiles(SRC)
      .filter(file => !ALLOWED.some(allowed => file.endsWith(allowed)))
      .flatMap(findCopyTables);

    expect(offenders).toEqual([]);
  });
});
