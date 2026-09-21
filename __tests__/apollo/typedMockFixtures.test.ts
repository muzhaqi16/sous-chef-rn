import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * A hand-built mock states its operation's data, so it is typed by that
 * operation's document.
 *
 * `MockedResponse` defaults its data to `Record<string, unknown>`, so a bare
 * annotation checks nothing: a fixture naming a union member the schema dropped
 * (`UserPayload` for `completeOnboarding`), a field the operation cannot return,
 * a raw `'MEMBER'` where the enum belongs, or a stale `'BulkNotificationSummary'`
 * all compiled. The mock contract catches those when the mock is SERVED, so one
 * that no test fires is unchecked in both directions.
 *
 * `MockFor<typeof XDocument>` reads the shape off codegen while leaving what the
 * fixture omits to SDL completion. `recordMock` already types its `data` from
 * the document it takes, so a builder returning `recordMock(…).mock` is checked
 * where it is built and may still declare the bare type.
 */

const ROOTS = ['src', '__tests__'];
const HELPER = join('__tests__', 'helpers', 'apolloMockProvider.tsx');
/** This file quotes the pattern it bans, so it cannot scan itself. */
const SELF = join('__tests__', 'apollo', 'typedMockFixtures.test.ts');

const collect = (dir: string, found: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collect(full, found);
    else if (/\.tsx?$/.test(entry)) found.push(relative(process.cwd(), full));
  }
  return found;
};

const sources = ROOTS.flatMap(root => collect(root)).filter(
  file => file !== HELPER && file !== SELF,
);

/** A bare `: MockedResponse` annotation — neither `MockedResponse<…>` nor `[]`. */
const BARE = /:\s*MockedResponse\b(?!\s*[<[])/g;

/** Hand-built fixtures: the declaration writes its own `request: { query: … }`. */
const handBuilt = sources.flatMap(file => {
  const code = readFileSync(join(process.cwd(), file), 'utf8');
  return [...code.matchAll(BARE)].flatMap(match => {
    const window = code.slice(match.index, match.index + 600);
    const buildsRequest = /request:\s*\{[\s\S]{0,120}?query:/.test(window);
    const delegates = /recordMock\(/.test(window);
    if (!buildsRequest || delegates) return [];
    return [`${file}:${code.slice(0, match.index).split('\n').length}`];
  });
});

it('finds the mock fixtures at all, so the check below is not vacuous', () => {
  const typed = sources.filter(file =>
    readFileSync(join(process.cwd(), file), 'utf8').includes('MockFor<typeof '),
  );

  expect(typed.length).toBeGreaterThanOrEqual(40);
});

it('every hand-built mock is typed by its operation', () => {
  expect(handBuilt).toEqual([]);
});
