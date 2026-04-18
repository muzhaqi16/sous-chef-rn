import chroma from 'chroma-js';

/**
 * Shade keys matching the existing color palette structure (jaffa, charade).
 */
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
 * Generate an 11-stop color palette (50–950) from a single hex color.
 *
 * Uses LCH color space for perceptually uniform lightness transitions.
 * The input color anchors the 500 position; lighter and darker shades
 * are derived by scaling luminance.
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
