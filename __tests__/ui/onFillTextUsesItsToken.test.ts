import { readFileSync } from 'fs';
import { globSync } from 'fs';
import { relative } from 'path';
import chroma from 'chroma-js';

import { colors } from '#/theme/foundations/colors';

/**
 * Text on a `primary`/`danger` fill must read the matching `on*` token. The
 * foreground follows the fill's luminance and the fill is user-overridable, so
 * a hardcoded white is wrong for four of the seven pickable brand colours.
 *
 * A hardcoded white is one of four ways the pairing breaks; the other three
 * read as correct, and each gets its own scan below.
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
  const shapes = [
    /\n {2}(\w+): \{\n([\s\S]*?)\n {2}\},/g,
    /\n {2}(\w+): \{([^\n{}]*)\},/g,
  ];
  for (const re of shapes) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(source))) blocks.set(m[1], m[2]);
  }
  return blocks;
};

const FILL_NAMES = ['primary', 'danger', 'error', 'success', 'warning', 'info'];
const FILL_GROUP = FILL_NAMES.join('|');

const FILLS = new RegExp(
  `backgroundColor:\\s*theme\\.colors\\.(${FILL_GROUP})\\b`,
);
const WHITE = /\bcolor:\s*theme\.colors\.white\b/;

/** The fill an `on*` token names — `onPrimary` belongs to `primary`. */
const fillOfOnToken = (token: string): string =>
  token.slice(2, 3).toLowerCase() + token.slice(3);

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

/**
 * An `on*` token in the same block as a fill it does not name. Reads as
 * correct — it is a token, not a literal — and inverts with whichever fill it
 * IS named for.
 */
const misTokened = FILES.flatMap(file => {
  const blocks = styleBlocks(readFileSync(file, 'utf8'));

  return [...blocks.entries()].flatMap(([name, body]) => {
    const fill = FILLS.exec(body)?.[1];
    const onToken = /\bcolor:\s*theme\.colors\.(on[A-Z]\w*)/.exec(body)?.[1];
    if (!fill || !onToken) return [];
    return fillOfOnToken(onToken) === fill ? [] : [`${file}#${name}`];
  });
});

/**
 * A shared fill overridden locally, under a shared foreground naming the
 * original. Split across two files, so neither half reads as wrong alone.
 */
const COMPOSED_FILL = /style=\{\[commonStyles\.(\w+),\s*styles\.(\w+)\]\}/g;

const sharedBlocks = styleBlocks(
  readFileSync('src/styles/commonStyles.ts', 'utf8'),
);

const overriddenSharedFills = FILES.flatMap(file => {
  const source = readFileSync(file, 'utf8');
  const localBlocks = styleBlocks(source);

  return [...source.matchAll(COMPOSED_FILL)].flatMap(([, shared, local]) => {
    const sharedFill = FILLS.exec(sharedBlocks.get(shared) ?? '')?.[1];
    const localFill = FILLS.exec(localBlocks.get(local) ?? '')?.[1];
    if (!sharedFill || !localFill || sharedFill === localFill) return [];

    // The foreground travels with the shared fill under the `<name>Text`
    // convention; it is what ends up painted on the overriding fill.
    const onToken = /\bcolor:\s*theme\.colors\.(on[A-Z]\w*)/.exec(
      sharedBlocks.get(`${shared}Text`) ?? '',
    )?.[1];
    if (!onToken) return [];

    // At the POINT OF USE: a `styles.<name>Text` left behind after the JSX
    // stopped composing it would otherwise keep this quiet.
    const composedForeground = new RegExp(
      `style=\\{\\[\\s*commonStyles\\.${shared}Text\\s*,\\s*styles\\.(\\w+)`,
    ).exec(source)?.[1];
    const corrected = composedForeground
      ? /\bcolor:\s*theme\.colors\.(on[A-Z]\w*)/.exec(
          localBlocks.get(composedForeground) ?? '',
        )?.[1]
      : undefined;
    if (corrected && fillOfOnToken(corrected) === localFill) return [];

    return [`${file}#${local} overrides commonStyles.${shared} (${onToken})`];
  });
});

/**
 * `withUnistyles` resolves natively, so under Jest neither the rendered colour
 * nor the wrapper's identity is assertable — the NAME is all that remains. The
 * `<` matters: a leftover import would otherwise satisfy this.
 */
const ON_FILL_COMPONENT = /<On([A-Z]\w+?)(ActivityIndicator)\b/g;

const strandedOnFillComponents = FILES.flatMap(file => {
  const source = readFileSync(file, 'utf8');
  const rendered = new Set(
    [...source.matchAll(ON_FILL_COMPONENT)].map(m => m[1].toLowerCase()),
  );
  if (rendered.size === 0) return [];

  // A variant this file branches on that no rendered indicator is named for.
  const branched = FILL_NAMES.filter(f =>
    new RegExp(`variant === '${f}'`).test(source),
  );
  const fillOfVariant = (v: string) => (v === 'danger' ? 'error' : v);

  const titleCase = (s: string) => s.slice(0, 1).toUpperCase() + s.slice(1);

  return branched
    .filter(v => !rendered.has(fillOfVariant(v)))
    .map(
      v =>
        `${file}: '${v}' variant has no On${titleCase(
          fillOfVariant(v),
        )} indicator`,
    );
});

/**
 * Fill/text pairs as literal hexes. The token scans cannot reach these:
 * `src/theme/` is excluded and a nested object is not a style block.
 */
const AA_NORMAL = 4.5;

/** Pairs below AA that predate this guard, each with the ratio it sits at. */
const PALETTE_CONTRAST_EXEMPT: Record<string, string> = {
  'colors.expiration.expiredBg + .expiredText':
    '4.41 — pre-existing, marginal; expiration chrome is reviewed as a set',
  'colors.expiration.warningBg + .warningText':
    '3.43 — pre-existing; same set as expiredText',
  'colors.filterTab.filteredBg + .filteredText':
    '3.35 — pre-existing; the filtered state, not the active fill',
};

const palettePairs = Object.entries(colors).flatMap(([group, value]) => {
  if (typeof value !== 'object' || value === null) return [];
  const entries = Object.entries(value as Record<string, unknown>);

  return entries.flatMap(([key, fill]) => {
    if (typeof fill !== 'string' || !/Bg$/.test(key)) return [];
    const textKey = key.replace(/Bg$/, 'Text');
    const text = (value as Record<string, unknown>)[textKey];
    if (typeof text !== 'string') return [];
    if (!chroma.valid(fill) || !chroma.valid(text)) return [];

    return [
      {
        pair: `colors.${group}.${key} + .${textKey}`,
        ratio: Number(chroma.contrast(fill, text).toFixed(2)),
      },
    ];
  });
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

  it('never paints an on-token over a fill it does not name', () => {
    expect(misTokened).toEqual([]);
  });

  it('does not let a caller override a shared fill under its foreground', () => {
    expect(overriddenSharedFills).toEqual([]);
  });

  it('gives every branched variant an indicator named for its own fill', () => {
    expect(strandedOnFillComponents).toEqual([]);
  });
});

describe('palette groups pairing a fill with its own text', () => {
  it('finds the pairs it exists to check', () => {
    // A scan matching nothing passes identically whether the contract holds or
    // the palette was reshaped under it.
    expect(palettePairs.length).toBeGreaterThan(0);
  });

  it('meets AA for normal text', () => {
    const failing = palettePairs
      .filter(p => p.ratio < AA_NORMAL)
      .filter(p => !(p.pair in PALETTE_CONTRAST_EXEMPT));

    expect(failing).toEqual([]);
  });

  it('keeps the exemption list honest', () => {
    const below = new Set(
      palettePairs.filter(p => p.ratio < AA_NORMAL).map(p => p.pair),
    );
    const stale = Object.keys(PALETTE_CONTRAST_EXEMPT).filter(
      k => !below.has(k),
    );

    expect(stale).toEqual([]);
  });
});
