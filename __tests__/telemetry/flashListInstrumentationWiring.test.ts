import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * A list that adopts `useFlashListPerformance` wires ALL of it.
 *
 * The hook's metrics are not computed from the hook — they are computed from
 * callbacks the list has to hand back to FlashList:
 *
 *   - `CellRendererComponent` is how blank cells are counted at all. FlashList's
 *     own viewability is geometric and 250 ms-lagged, so without the renderer
 *     the blank-cell series is not merely wrong, it is absent.
 *   - `onCommitLayoutEffect` drives the `hasContentLayout` latch, which is what
 *     fires `markFullyDrawn()` — a once-per-SESSION metric claimed by whichever
 *     instrumented list the launch lands on first.
 *
 * A list wired to half of it produces no signal distinguishable from a list
 * that was never instrumented, and `app_fully_drawn_ms` silently never fires
 * for a launch that lands there. `ItemList` shipped exactly that way: it took
 * `CellRendererComponent` and `onLoad` and omitted the commit callback.
 *
 * Derived from the tree rather than from a list of files, so a new consumer
 * cannot ship half-wired by not being added here.
 */

const SRC = join(process.cwd(), 'src');

/** Required for every consumer: the prop, and the callback it must receive. */
const REQUIRED_PROPS = [
  'CellRendererComponent={perfCallbacks.CellRendererComponent}',
  'onCommitLayoutEffect={perfCallbacks.onCommitLayoutEffect}',
];

const stripComments = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      return !trimmed.startsWith('//') && !trimmed.startsWith('*');
    })
    .join('\n');

const collectTsxFiles = (dir: string, found: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== '__tests__') collectTsxFiles(full, found);
    } else if (entry.endsWith('.tsx')) {
      found.push(full);
    }
  }
  return found;
};

/** Files that CALL the hook — the hook's own module and tests are excluded. */
const consumers = collectTsxFiles(SRC)
  .filter(file =>
    stripComments(readFileSync(file, 'utf8')).includes(
      'useFlashListPerformance(',
    ),
  )
  .map(file => relative(process.cwd(), file))
  .sort();

describe('FlashList performance instrumentation wiring', () => {
  it('finds the consumers at all, so the checks below are not vacuous', () => {
    expect(consumers.length).toBeGreaterThanOrEqual(3);
    expect(consumers).toEqual(
      expect.arrayContaining([
        'src/components/organisms/ItemList.tsx',
        'src/features/pantry/components/PantryContent.tsx',
        'src/features/shoppingList/components/SortableShoppingList/SortableList.tsx',
      ]),
    );
  });

  it.each(consumers)('%s wires every instrumentation callback', file => {
    const source = readFileSync(join(process.cwd(), file), 'utf8');
    for (const prop of REQUIRED_PROPS) {
      expect(source).toContain(prop);
    }
  });
});
