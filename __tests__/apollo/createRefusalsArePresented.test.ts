import { readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

/**
 * `useCreateShoppingList` settles with `present: 'none'` and hands its caller
 * the copy in `body`. A caller that returns quietly on `failed` leaves the
 * person with a spinner that stopped and no list — indistinguishable from a
 * create that worked.
 */

const HOOK = 'src/features/shoppingList/hooks/useCreateShoppingList.ts';

/** Every call site of the hook's returned function, as `file:line`. */
function callSites(): { file: string; line: number }[] {
  const out = execSync(
    `git grep -n "await createShoppingList(" -- 'src/**/*.ts' 'src/**/*.tsx' | grep -v __tests__ || true`,
    { cwd: process.cwd(), encoding: 'utf8' },
  );
  return out
    .split('\n')
    .filter(Boolean)
    .map(hit => {
      const [file = '', lineText = ''] = hit.split(':');
      return { file, line: Number(lineText) };
    })
    .filter(({ file }) => file && file !== HOOK);
}

describe('a refused list create reaches the person', () => {
  it('hands the caller copy to present', () => {
    const source = readFileSync(join(process.cwd(), HOOK), 'utf8');
    expect(source).toContain("present: 'none'");
    expect(source).toContain('body:');
  });

  it('is presented at every call site', () => {
    const sites = callSites();
    expect(sites.length).toBeGreaterThan(3);

    const silent = sites
      .filter(({ file, line }) => {
        const lines = readFileSync(join(process.cwd(), file), 'utf8').split(
          '\n',
        );
        // The call, its outcome branch, and the branch body. Every reader of
        // the outcome must show `body` — a ternary on `'created'` that maps
        // failure to null drops it as surely as a bare `return`.
        const window = lines.slice(line - 1, line + 12).join('\n');
        return !/\.body/.test(window);
      })
      .map(({ file, line }) => `${file}:${line}`);

    expect(silent).toEqual([]);
  });
});
