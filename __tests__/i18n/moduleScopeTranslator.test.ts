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
 * PR #216 added five fresh call sites, which is what this exists to stop. The
 * files below predate it: they are a shrink-only WORKLIST, not an approval. An
 * entry may be removed once the file is converted; nothing may be added.
 */

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');

/**
 * Files still calling the raw accessor. Converting one is a `t(...)` swap plus
 * an import change — in a `.tsx` file the import must be aliased `tGlobal`, or
 * the hook used instead, because lint requires the language-aware `t` there.
 */
const LEGACY_CALLERS = [
  'src/features/home/hooks/useHomeDetailManagement.ts',
  'src/features/mealPlan/hooks/useGenerateShoppingList.ts',
  'src/features/pantry/hooks/useAddLowStockToShoppingList.ts',
  'src/features/pantry/hooks/usePantryItemDetailActions.ts',
  'src/features/pantry/hooks/usePantryItemTransformation.tsx',
  'src/hooks/subscriptions/useUserSubscriptions.ts',
  'src/utils/errorHandlers.ts',
  'src/utils/errors/rateLimit.ts',
  'src/utils/validateDeductionQuantity.ts',
  'src/utils/validation/auth.ts',
  'src/utils/validation/common.ts',
  'src/utils/validation/item.ts',
  'src/utils/validation/onboarding.ts',
  'src/utils/validation/profile.ts',
].sort();

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
  it('has no callers outside the recorded worklist', () => {
    const added = callers.filter(file => !LEGACY_CALLERS.includes(file));

    expect(added).toEqual([]);
  });

  it('the worklist only shrinks', () => {
    const converted = LEGACY_CALLERS.filter(file => !callers.includes(file));

    expect(converted).toEqual([]);
  });
});
