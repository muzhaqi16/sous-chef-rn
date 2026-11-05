import chroma from 'chroma-js';

export type PaletteShade =
  | '50'
  | '100'
  | '200'
  | '300'
  | '400'
  | '500'
  | '600'
  | '700'
  | '800'
  | '900'
  | '950';

export type DerivedPalette = Record<PaletteShade, string>;

const SHADE_KEYS: PaletteShade[] = [
  '50',
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900',
  '950',
];

/**
 * An 11-stop palette (50–950) from one hex color, in LCH so lightness steps are
 * perceptually uniform. The input anchors 500.
 */
export function derivePalette(hex: string): DerivedPalette {
  const lightest = chroma(hex).luminance(0.95);
  const darkest = chroma(hex).luminance(0.02);

  const scale = chroma
    .scale([lightest, hex, darkest])
    .mode('lch')
    .colors(SHADE_KEYS.length);

  // `colors(n)` returns exactly n stops, so the fallback is never read.
  const shade = (index: number) => scale[index] ?? hex;
  return {
    '50': shade(0),
    '100': shade(1),
    '200': shade(2),
    '300': shade(3),
    '400': shade(4),
    '500': shade(5),
    '600': shade(6),
    '700': shade(7),
    '800': shade(8),
    '900': shade(9),
    '950': shade(10),
  };
}

const AA_BODY = 4.5;

/**
 * The first shade from `from`, stepping `toward` darker or lighter, that reads at
 * AA body contrast on every ground; the palette's end if none does.
 */
export function foregroundShade(
  palette: DerivedPalette,
  grounds: readonly string[],
  from: PaletteShade,
  toward: 'darker' | 'lighter',
): string {
  const start = SHADE_KEYS.indexOf(from);
  const steps =
    toward === 'darker'
      ? SHADE_KEYS.slice(start)
      : SHADE_KEYS.slice(0, start + 1).reverse();
  const readable = steps.find(key =>
    grounds.every(ground => chroma.contrast(palette[key], ground) >= AA_BODY),
  );
  return palette[readable ?? (toward === 'darker' ? '950' : '50')];
}

/** A translucent `tint` at `alpha` as painted over `ground`. */
export function paintedTint(
  tint: string,
  alpha: number,
  ground: string,
): string {
  return chroma.mix(ground, tint, alpha, 'rgb').hex();
}

/** Whether the better of `light`/`dark` reads on `fill` at AA body contrast. */
export function carriesReadableContent(
  fill: string,
  light: string,
  dark: string,
): boolean {
  return chroma.contrast(fill, onColor(fill, light, dark)) >= AA_BODY;
}

/**
 * Whichever of `light`/`dark` reads better on `fill`. "On primary" is a function
 * of the fill's luminance, not of the theme — the brand colour is user-overridable
 * and identical in both themes, so a per-theme constant is right for at most half
 * the palette.
 */
export function onColor(fill: string, light: string, dark: string): string {
  return chroma.contrast(fill, light) >= chroma.contrast(fill, dark)
    ? light
    : dark;
}
