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

  const palette = {} as DerivedPalette;
  SHADE_KEYS.forEach((key, i) => {
    palette[key] = scale[i];
  });

  return palette;
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
