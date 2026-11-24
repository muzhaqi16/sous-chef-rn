import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Every sheet renders through the shell.
 *
 * A `BottomSheetModal` rendered by hand is a sheet that has to re-derive what
 * the shell already settles: the backdrop claim, the snap points, the keyboard
 * host, and the header. Each of those has a documented failure the repo has
 * already paid for — a stranded backdrop that eats taps, a sheet blind to the
 * keyboard, a list that cannot scroll because it sits in a `BottomSheetView`.
 *
 * A sheet the shell does not fit grows the shell an option (`modalOptions`,
 * `bottomInset`) rather than rendering its own modal.
 *
 * A type reference (`RefObject<BottomSheetModal>`, `BottomSheetModalProps`) is
 * not a render — the boundary assertions on either side are what keep
 * `useBottomSheetBackHandler` and the props types out.
 */

/**
 * The shell, and the tray that still renders its own modal. `BottomSheetLayout`
 * and `BottomSheetAction` folded INTO `Sheet` — its `view`, `form` and `action`
 * modes are what they were.
 */
const SHELL = [
  'src/components/templates/Sheet.tsx',
  'src/components/templates/ActionTray/ActionTray.tsx',
];

const SRC = join(process.cwd(), 'src');

/**
 * A RENDER, not a type. The boundary on the left rejects `RefObject<Bottom…>`;
 * the one on the right rejects `BottomSheetModalProps`.
 */
const RENDERS_MODAL = /(?<![A-Za-z0-9_])<BottomSheetModal(?![A-Za-z0-9_])/;

/** Strip comments, so a docblock example does not read as a render. */
const stripComments = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(line => !line.trim().startsWith('//'))
    .join('\n');

const collect = (dir: string, found: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== '__tests__') collect(full, found);
    } else if (
      /\.tsx?$/.test(entry) &&
      !/\.(test|generated)\.tsx?$/.test(entry)
    ) {
      found.push(full);
    }
  }
  return found;
};

const renderers = collect(SRC)
  .filter(file => RENDERS_MODAL.test(stripComments(readFileSync(file, 'utf8'))))
  .map(file => relative(process.cwd(), file))
  .sort();

describe('bottom sheet shell', () => {
  // Exact, both ways: a scan broken into finding nothing fails on the shell's
  // own files, and a hand-rendered modal fails as an extra entry.
  it('only the shell renders a modal', () => {
    expect(renderers).toEqual([...SHELL].sort());
  });
});
