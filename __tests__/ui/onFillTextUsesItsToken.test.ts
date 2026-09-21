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
 * Two of the four ways the pairing breaks are per-file and belong to
 * `sous-chef/on-fill-text-uses-its-token`: a hardcoded white, and an `on*`
 * token naming a fill other than the one beside it. What stays here needs more
 * than one file — a shared fill overridden locally under a shared foreground —
 * or needs the palette itself, to check the contrast the pairing exists for.
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
    while ((m = re.exec(source))) blocks.set(m[1]!, m[2]!);
  }
  return blocks;
};

const FILL_NAMES = ['primary', 'danger', 'error', 'success', 'warning', 'info'];
const FILL_GROUP = FILL_NAMES.join('|');

const FILLS = new RegExp(
  `backgroundColor:\\s*theme\\.colors\\.(${FILL_GROUP})\\b`,
);
/** The fill an `on*` token names — `onPrimary` belongs to `primary`. */
const fillOfOnToken = (token: string): string =>
  token.slice(2, 3).toLowerCase() + token.slice(3);

/**
 * An `on*` token in the same block as a fill it does not name. Reads as
 * correct — it is a token, not a literal — and inverts with whichever fill it
 * IS named for.
 */

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
    const sharedFill = FILLS.exec(sharedBlocks.get(shared!) ?? '')?.[1];
    const localFill = FILLS.exec(localBlocks.get(local!) ?? '')?.[1];
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
    [...source.matchAll(ON_FILL_COMPONENT)].map(m => m[1]!.toLowerCase()),
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

/**
 * The `<group>.<key>` fills some component actually paints. A `*Bg` token is
 * only a ground for the `*Text` beside it once something renders it as one, and
 * a `*Text` can sit on a surface no `*Bg` names at all — `expiration.expiredText`
 * is painted on the alert bar's own ground. Pairing by NAME measures
 * combinations that appear on no screen, so the fills are read from source:
 * the palette cannot say which pairs meet.
 */
const paintedFills = new Set(
  FILES.flatMap(file => [
    ...readFileSync(file, 'utf8').matchAll(
      /backgroundColor:\s*[\w.]*\bcolors\.(\w+)\.(\w+)/g,
    ),
  ]).map(m => `${m[1]}.${m[2]}`),
);

/**
 * Painted pairs below AA, each a standing decision rather than a queue: the
 * brand's own orange sets both, and darkening either to clear 4.5 would change
 * the tab's colour. An entry states why the pairing stands; a NEW pair below AA
 * still fails.
 */
const PALETTE_CONTRAST_EXEMPT: Record<string, string> = {
  'colors.filterTab.activeBg + .activeText':
    '2.58 — white on the brand orange, the same pairing `applyAppearance` ' +
    'derives for a custom brand; see `project_brand_color_white_on_primary`',
  'colors.filterTab.filteredBg + .filteredText':
    '3.33 — the brand orange tinted for the filtered state, which reads as ' +
    'one ramp with the active fill above and moves only with it',
};

const palettePairs = Object.entries(colors).flatMap(([group, value]) => {
  if (typeof value !== 'object' || value === null) return [];
  const entries = Object.entries(value as Record<string, unknown>);

  return entries.flatMap(([key, fill]) => {
    if (typeof fill !== 'string' || !/Bg$/.test(key)) return [];
    if (!paintedFills.has(`${group}.${key}`)) return [];
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
    // the palette was reshaped under it. `paintedFills` is the half that can
    // empty silently: a renamed token or a reshaped style block leaves the
    // regex matching nothing and every pair unchecked.
    expect(paintedFills.size).toBeGreaterThan(0);
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

/**
 * A component whose foreground names an `on*` token while its SIBLING style
 * file paints the ground from a raw palette ramp. Neither half is wrong alone,
 * both are tokens, and the two scans above cannot see it: one only knows the
 * six semantic fill names, the other only reads a single block.
 *
 * `SwipeableItem` shipped this — an icon on `onPrimary` (dark, because it is
 * picked against ORANGE) over `charade.950` navy, at 1.28:1.
 */
const ON_TOKEN_COLOR = /\bcolor:\s*theme\.colors\.(on[A-Z]\w*)/g;
const RAMP_FILL = /backgroundColor:\s*theme\.colors\.(\w+)\[['"](\d+)['"]\]/g;

/**
 * What an `on*` token actually paints. `onScrim` is fixed light; the rest are
 * `onColor(fill, white, near-black)`, so they follow the fill they are NAMED
 * for — which is the whole trap when they are painted on a different ground.
 */
const ON_TOKEN_FILL: Record<string, string | undefined> = {
  // `appConfig.branding.primaryColor` defaults to jaffa; a rebrand moves it,
  // and the point here is that it is ORANGE-ish, so `onPrimary` lands dark.
  onPrimary: colors.jaffa['500'],
  onError: colors.error,
  onSuccess: colors.success,
  onWarning: colors.warning,
  onInfo: colors.info,
};

/** `RAMP_FILL` captures the ramp name from source text, so the lookup has to
 * survive a name the palette does not carry. */
const rampStep = (ramp: string, step: string): string | undefined => {
  const scale: unknown = Reflect.get(colors, ramp);
  if (typeof scale !== 'object' || scale === null) return undefined;
  const value: unknown = Reflect.get(scale, step);
  return typeof value === 'string' ? value : undefined;
};

const resolveOnToken = (token: string): string | undefined => {
  const light = colors.neutral[0];
  if (token === 'onScrim') return light;

  const fill = ON_TOKEN_FILL[token];
  if (!fill || !chroma.valid(fill)) return undefined;

  const dark = colors.neutral[900];
  return chroma.contrast(fill, light) >= chroma.contrast(fill, dark)
    ? light
    : dark;
};

const crossFileOnTokenPairs = FILES.flatMap(file => {
  if (!/\.tsx$/.test(file)) return [];
  const dir = file.slice(0, file.lastIndexOf('/'));
  const stylePath = `${dir}/styles.ts`;
  let styleSource: string;
  try {
    styleSource = readFileSync(stylePath, 'utf8');
  } catch {
    return [];
  }

  const grounds = [...styleSource.matchAll(RAMP_FILL)].map(m =>
    rampStep(m[1]!, m[2]!),
  );
  const ground = grounds.find(g => typeof g === 'string' && chroma.valid(g));
  if (!ground) return [];

  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(ON_TOKEN_COLOR)].flatMap(m => {
    const fg = resolveOnToken(m[1]!);
    if (!fg) return [];
    return [
      {
        pair: `${file} ${m[1]} on ${stylePath} ramp fill`,
        ratio: Number(chroma.contrast(fg, ground).toFixed(2)),
      },
    ];
  });
});

describe('a foreground token over a ground painted in a sibling style file', () => {
  it('finds the pairs it exists to check', () => {
    expect(crossFileOnTokenPairs.length).toBeGreaterThan(0);
  });

  it('meets AA for normal text', () => {
    expect(crossFileOnTokenPairs.filter(p => p.ratio < AA_NORMAL)).toEqual([]);
  });
});
