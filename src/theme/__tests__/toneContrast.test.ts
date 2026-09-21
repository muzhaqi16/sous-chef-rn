import chroma from 'chroma-js';
import { TONE_COLOR, type TextTone } from '#components/atoms/Text';
import { isOwnKey } from '#utils/isOwnKey';
import { darkTheme, lightTheme, type ThemeColors } from '../themes';

const AA_BODY = 4.5;

type ThemeName = 'light' | 'dark';

const THEMES: { themeName: ThemeName; colors: ThemeColors }[] = [
  { themeName: 'light', colors: lightTheme.colors },
  { themeName: 'dark', colors: darkTheme.colors },
];

type Ground =
  | 'background'
  | 'backgroundSecondary'
  | 'surface'
  | 'surfaceVariant'
  | 'errorLight'
  | 'successLight'
  | 'warningLight'
  | 'infoLight';

const PAGE: Ground[] = ['background', 'backgroundSecondary', 'surface'];
const PAGE_AND_CHIP: Ground[] = [...PAGE, 'surfaceVariant'];

/**
 * The grounds each tone is set on. `surfaceVariant` is a chip, input or badge
 * ground, and what sits on it is neutral copy; a status colour labels the row
 * or field around it, or sits on its own tint (`Badge`).
 */
const GROUNDS: Record<TextTone, Ground[]> = {
  primary: PAGE_AND_CHIP,
  secondary: PAGE_AND_CHIP,
  onSurfaceVariant: PAGE_AND_CHIP,
  tertiary: PAGE,
  error: [...PAGE, 'errorLight'],
  danger: [...PAGE, 'errorLight'],
  success: [...PAGE, 'successLight'],
  warning: [...PAGE, 'warningLight'],
  info: [...PAGE, 'infoLight'],
  accent: PAGE,
  // The foreground of a `primary` fill, never set on a page ground.
  onPrimary: [],
};

interface Exemption {
  theme: ThemeName;
  tone: TextTone;
  reason: string;
}

const BELOW_AA_BY_DECISION: Exemption[] = [
  {
    theme: 'light',
    tone: 'accent',
    reason:
      'the brand orange is the design colour by decision; onColor.test.ts pins the same trade for onPrimary',
  },
];

const isExempt = (theme: ThemeName, tone: TextTone) =>
  BELOW_AA_BY_DECISION.some(e => e.theme === theme && e.tone === tone);

/** A translucent ground as painted, over the `surface` a badge sits on. */
const painted = (colors: ThemeColors, ground: Ground) => {
  const color = chroma(colors[ground]);
  return chroma.mix(colors.surface, color.alpha(1), color.alpha(), 'rgb');
};

const pairings = THEMES.flatMap(({ themeName, colors }) =>
  Object.entries(GROUNDS).flatMap(([tone, grounds]) =>
    isOwnKey(TONE_COLOR, tone)
      ? grounds.map(ground => ({
          themeName,
          tone,
          ground,
          ratio: chroma.contrast(
            colors[TONE_COLOR[tone]],
            painted(colors, ground),
          ),
        }))
      : [],
  ),
);

describe('text tone contrast', () => {
  it('sets every tone at AA body contrast on the grounds it is read on', () => {
    const failing = pairings
      .filter(p => p.ratio < AA_BODY && !isExempt(p.themeName, p.tone))
      .map(
        p => `${p.themeName} ${p.tone} on ${p.ground}: ${p.ratio.toFixed(2)}`,
      );

    expect(failing).toEqual([]);
  });

  it('keeps each exemption below AA, or it is stale', () => {
    const stale = BELOW_AA_BY_DECISION.filter(e =>
      pairings
        .filter(p => p.themeName === e.theme && p.tone === e.tone)
        .every(p => p.ratio >= AA_BODY),
    ).map(e => `${e.theme} ${e.tone}`);

    expect(stale).toEqual([]);
  });
});
