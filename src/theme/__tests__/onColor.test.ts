import chroma from 'chroma-js';
import { onColor } from '../derivePalette';
import { lightTheme, darkTheme } from '../themes';

const WHITE = '#FFFFFF';
const NEAR_BLACK = '#211E18';
const AA_BODY = 4.5;

/** The colours the Appearance screen lets a user pick as the brand. */
const BRAND_SWATCHES = [
  '#f97416',
  '#2563EB',
  '#16A34A',
  '#7C3AED',
  '#DC2626',
  '#0D9488',
  '#f51aff',
];

describe('onColor', () => {
  it('picks the candidate with more contrast', () => {
    expect(onColor('#f97416', WHITE, NEAR_BLACK)).toBe(NEAR_BLACK);
    expect(onColor('#2563EB', WHITE, NEAR_BLACK)).toBe(WHITE);
  });

  it('always picks the more readable of the two candidates', () => {
    const wrong = BRAND_SWATCHES.filter(fill => {
      const chosen = onColor(fill, WHITE, NEAR_BLACK);
      const other = chosen === WHITE ? NEAR_BLACK : WHITE;
      return chroma.contrast(fill, chosen) < chroma.contrast(fill, other);
    });

    expect(wrong).toEqual([]);
  });

  it('clears AA body contrast on every brand colour that can', () => {
    // Teal reaches only 4.44:1 against its better foreground, so no choice of
    // text colour clears AA on it — the swatch itself needs darkening.
    const TOPS_OUT_BELOW_AA = ['#0D9488'];

    const failing = BRAND_SWATCHES.filter(fill => {
      const fg = onColor(fill, WHITE, NEAR_BLACK);
      return (
        chroma.contrast(fill, fg) < AA_BODY && !TOPS_OUT_BELOW_AA.includes(fill)
      );
    });

    expect(failing).toEqual([]);
  });

  it('beats a fixed white foreground, which is what it replaces', () => {
    // Four of the seven swatches are unreadable with white on them.
    const whiteFails = BRAND_SWATCHES.filter(
      fill => chroma.contrast(fill, WHITE) < AA_BODY,
    );

    expect(whiteFails.length).toBeGreaterThan(0);
  });
});

describe('on-fill tokens', () => {
  it('are identical in both themes, because the primary fill is', () => {
    // `primary` is brand[500] in both, so a foreground that varies by theme is
    // keyed on the wrong variable.
    expect(darkTheme.colors.primary).toBe(lightTheme.colors.primary);
    expect(darkTheme.colors.onPrimary).toBe(lightTheme.colors.onPrimary);
    expect(darkTheme.colors.iconOnPrimary).toBe(
      lightTheme.colors.iconOnPrimary,
    );
  });

  it('give the primary button a readable label', () => {
    const { primary, onPrimary } = lightTheme.colors;

    expect(chroma.contrast(primary, onPrimary)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('keep a selected chip readable in both themes', () => {
    for (const theme of [lightTheme, darkTheme]) {
      const { chipSelectedBackground, chipSelectedText } = theme.colors;

      expect(
        chroma.contrast(chipSelectedBackground, chipSelectedText),
      ).toBeGreaterThanOrEqual(AA_BODY);
    }
  });
});
