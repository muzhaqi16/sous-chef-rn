/**
 * Every entity type `optimisticDataPersistence` saves is restored by a screen.
 *
 * A persisted field is only half the durability: boot restoration re-applies it
 * for the types a tab screen lists in `optimisticTypes`. A type saved but never
 * listed keeps its edit on disk and shows the server's value after a restart —
 * `PantryItemBatch` shipped that way.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === '__tests__' ? [] : sources(path);
    }
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

it('restores every persisted entity type somewhere', () => {
  const persistence = read('src/apollo/offline/OptimisticDataPersistence.ts');
  const table = /const PERSISTED_TYPENAMES[^=]*=\s*\{([^}]*)\}/.exec(
    persistence,
  )?.[1];
  const persisted = [...(table ?? '').matchAll(/^\s*(\w+):/gm)].flatMap(m =>
    m[1] ? [m[1]] : [],
  );
  expect(persisted.length).toBeGreaterThan(0);

  const restored = new Set(
    sources(join(ROOT, 'src')).flatMap(file =>
      [
        ...readFileSync(file, 'utf8').matchAll(
          /optimisticTypes:\s*\[([^\]]*)\]/g,
        ),
      ].flatMap(m => [...(m[1] ?? '').matchAll(/'(\w+)'/g)].map(n => n[1])),
    ),
  );

  expect(persisted.filter(type => !restored.has(type))).toEqual([]);
});
