import { readFileSync } from 'fs';
import { globSync } from 'fs';
import { relative } from 'path';

/**
 * Text on a `primary`/`danger` fill must read the matching `on*` token, not
 * `theme.colors.white`. The foreground follows the fill's luminance — and the
 * fill is user-overridable — so a hardcoded white is wrong for four of the seven
 * pickable brand colours. Deriving it in the Button atom alone left hand-rolled
 * buttons white, which is how the app briefly had two different labels on the
 * same orange.
 */
const FILES = globSync('src/**/*.{ts,tsx}', {
  exclude: (p: string) =>
    /__tests__|__mocks__|\.test\.tsx?$|\.generated\.ts$|(^|\/)src\/theme\//.test(
      p,
    ),
}).map(f => relative(process.cwd(), f));

/**
 * `name: { … }` blocks, one nesting level deep, out of a StyleSheet. Both
 * spellings: a single-line block is how `scanDotActive` hid its primary fill.
 */
const styleBlocks = (source: string): Map<string, string> => {
  const blocks = new Map<string, string>();
  const shapes = [/\n {2}(\w+): \{\n([\s\S]*?)\n {2}\},/g, /\n {2}(\w+): \{([^\n{}]*)\},/g];
  for (const re of shapes) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(source))) blocks.set(m[1], m[2]);
  }
  return blocks;
};

const FILLS =
  /backgroundColor:\s*theme\.colors\.(primary|danger|error|success|warning|info)\b/;
const WHITE = /\bcolor:\s*theme\.colors\.white\b/;

/**
 * White text that is NOT on the fill — a scrim over a photo or the camera, or a
 * translucent badge layered on top of one. Keyed `<file>#<style>` with a reason.
 */
const NOT_ON_THE_FILL: Record<string, string> = {
  'src/features/catalog/ui/ItemPhotoCarousel.tsx#pendingText':
    'a pill on the photo itself, not on the primary fill',
  'src/features/shoppingList/components/moveToPantry/PantrySelector.tsx#defaultBadgeTextActive':
    'sits on overlays.light, a dark scrim drawn over the filled option',
  'src/features/barcode/screens/BarcodeScannerScreen.tsx#messageText':
    'camera overlay chrome',
  'src/features/barcode/screens/BarcodeScannerScreen.tsx#headerTitle':
    'camera overlay chrome',
  'src/features/barcode/screens/BarcodeScannerScreen.tsx#instructionsText':
    'camera overlay chrome',
  'src/features/barcode/screens/BarcodeScannerScreen.tsx#subInstructionsText':
    'camera overlay chrome',
  'src/features/barcode/screens/BarcodeScannerScreen.tsx#scanStatusText':
    'camera overlay chrome',
};

const suspects = FILES.flatMap(file => {
  const blocks = styleBlocks(readFileSync(file, 'utf8'));
  const fills = [...blocks.values()].some(b => FILLS.test(b));
  if (!fills) return [];

  return [...blocks.entries()]
    .filter(([, body]) => WHITE.test(body))
    .map(([name]) => `${file}#${name}`);
});

describe('text on a primary or danger fill', () => {
  it('scans the files it claims to scan', () => {
    // A sweep that reads nothing passes vacuously.
    expect(FILES.length).toBeGreaterThan(400);
  });

  it('reads onPrimary/onError rather than a hardcoded white', () => {
    const offenders = suspects.filter(s => !(s in NOT_ON_THE_FILL));

    expect(offenders).toEqual([]);
  });

  it('keeps the not-on-the-fill list honest', () => {
    // An entry whose style stopped matching is a stale exemption that will
    // silently cover the next style to take its name.
    const stale = Object.keys(NOT_ON_THE_FILL).filter(
      k => !suspects.includes(k),
    );

    expect(stale).toEqual([]);
  });
});
