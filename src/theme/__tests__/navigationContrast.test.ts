import chroma from 'chroma-js';
import { darkTheme, lightTheme, type ThemeColors } from '../themes';

// A tab glyph is a graphic that identifies a control: WCAG 1.4.11 asks 3:1.
// The selected glyph is `primary`, the add button's fill, by decision — 2.58:1
// on the light bar — so only the unselected glyphs are held here.
const NON_TEXT = 3;

/** The glass as painted: its tint over the page the bar floats above. */
const paintedGlass = (colors: ThemeColors) => {
  const tint = chroma(colors.glassTint);
  return chroma.mix(colors.background, tint.alpha(1), tint.alpha(), 'rgb');
};

describe.each([
  ['light', lightTheme.colors],
  ['dark', darkTheme.colors],
])('the %s tab bar', (_, colors) => {
  it('holds its unselected glyphs at 3:1 on the solid fallback and on the glass', () => {
    expect(
      chroma.contrast(colors.onNavigation, colors.navigationSurface),
    ).toBeGreaterThanOrEqual(NON_TEXT);
    expect(
      chroma.contrast(colors.onNavigation, paintedGlass(colors)),
    ).toBeGreaterThanOrEqual(NON_TEXT);
  });
});
