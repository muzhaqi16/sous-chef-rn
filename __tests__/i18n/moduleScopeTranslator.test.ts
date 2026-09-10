import fs from 'fs';
import path from 'path';

/**
 * `getI18n().t(...)` does not come back.
 *
 * CLAUDE.md: "Don't reintroduce `getI18n().t(...)` — `t` takes i18next's full
 * options (`t('key', { count })`, `t('key', 'English fallback')`)." The
 * module-scope `t` in `src/i18n/index.ts` IS `getI18n().t` with those overloads
 * in front of it, so the raw accessor buys nothing and loses the fallback form.
 *
 * The worklist is EMPTY, which makes this an invariant rather than a debt list:
 * every caller has been converted, so any finding is a regression to fix rather
 * than a number to watch.
 */

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');

/**
 * Empty on purpose. Converting a caller is a `t(...)` swap plus an import
 * change — in a `.tsx` file the import must be aliased `tGlobal`, or the hook
 * used instead, because lint requires the language-aware `t` there.
 */
const LEGACY_CALLERS: string[] = [];

function productionFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === '__mocks__') continue;
      productionFiles(full, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const callers = productionFiles(SRC)
  // `src/i18n` is where the accessor legitimately lives.
  .filter(file => !file.startsWith(path.join(SRC, 'i18n')))
  .filter(file => /getI18n\(\)\.t\(/.test(fs.readFileSync(file, 'utf8')))
  .map(file => path.relative(ROOT, file))
  .sort();

describe('the deprecated translation accessor', () => {
  it('has no callers', () => {
    const added = callers.filter(file => !LEGACY_CALLERS.includes(file));

    expect(added).toEqual([]);
  });

  it('the worklist only shrinks', () => {
    const converted = LEGACY_CALLERS.filter(file => !callers.includes(file));

    expect(converted).toEqual([]);
  });

  // A scan that finds nothing looks the same whether the tree is clean or the
  // walk broke, so assert it is still reading the tree it thinks it is.
  it('is still scanning the source tree', () => {
    expect(productionFiles(SRC).length).toBeGreaterThan(500);
  });
});
