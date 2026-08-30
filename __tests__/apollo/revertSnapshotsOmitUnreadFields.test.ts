/**
 * Every local-first revert builds its snapshot the same way.
 *
 * `updateEntityFieldsLocalFirst` reverts by writing `previous` back, and
 * `writeEntityFields` skips `undefined` — so a key the snapshot OMITS is a field
 * the revert leaves alone. That is the only correct treatment for a field the
 * snapshot's read never carried: writing a fallback over it destroys a value
 * the snapshot never saw, and on the local-first path no later fetch repairs it.
 *
 * The hazard is the fallback, not the read. `pantry?.name ?? ''` blanked a
 * pantry's name whenever a refusal landed before its query resolved, and
 * `previousItem?.[key] ?? null` wrote null over a recipe link the editor's query
 * had never selected. Both read as defensive and both destroy data.
 *
 * `snapshotFields` is the one way to build one. This holds every call site to
 * it, so a new revert cannot reintroduce a coercion — the unit tests on the
 * helper cannot see a call site that stops using it.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const SRC = join(process.cwd(), 'src');
const HELPER = 'src/apollo/utils/localFirstFields.ts';

const collect = (dir: string, found: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== '__tests__') collect(full, found);
    } else if (
      (entry.endsWith('.ts') || entry.endsWith('.tsx')) &&
      !entry.endsWith('.generated.ts')
    ) {
      found.push(full);
    }
  }
  return found;
};

/** Files that perform a local-first field update, other than the helper itself. */
const callSites = collect(SRC)
  .map(file => ({ path: relative(process.cwd(), file), code: readFileSync(file, 'utf8') }))
  .filter(
    ({ path, code }) =>
      // Matches an explicit type argument too — `updateEntityFieldsLocalFirst<
      // AppSettings>({` is the shape two call sites use, and a detector that
      // missed them would be the same blind spot this file exists to close.
      path !== HELPER &&
      /updateEntityFieldsLocalFirst\s*(<[^>]*>)?\s*\(/.test(code),
  )
  .map(({ path }) => path)
  .sort();

describe('local-first revert snapshots', () => {
  it('finds the call sites, so the check below is not vacuous', () => {
    expect(callSites.length).toBeGreaterThanOrEqual(5);
  });

  it.each(callSites)('%s builds its snapshot with snapshotFields', file => {
    const code = readFileSync(join(process.cwd(), file), 'utf8');
    // Same allowance as the detector above: an explicit type argument is the
    // shape several sites use.
    expect(/snapshotFields\s*(<[^>]*>)?\s*\(/.test(code)).toBe(true);
  });

  it.each(callSites)(
    '%s does not coerce an unread field to a fallback value',
    file => {
      const code = readFileSync(join(process.cwd(), file), 'utf8');
      // The shapes that destroyed data: a snapshot value defaulted with `??`
      // inside the object handed to `previous`. `snapshotFields` omits instead.
      const coercedSnapshot =
        /previous:\s*\{[^}]*\?\?[^}]*\}/s.test(code) ||
        /const previous[^;]*\.map\([^;]*\?\?[^;]*\)/s.test(code);
      expect(coercedSnapshot).toBe(false);
    },
  );
});
