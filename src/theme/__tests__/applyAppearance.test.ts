import chroma from 'chroma-js';
import { UnistylesRuntime } from 'react-native-unistyles';
import type { AppearanceSettings } from '#platform/ports';
import { applyAppearanceToRuntime } from '../applyAppearance';
import { darkTheme, lightTheme, type ThemeColors } from '../themes';

const runtime = jest.mocked(UnistylesRuntime);
const AA_BODY = 4.5;

/** The fills the Appearance screen offers as the brand; the first is the default `primary`. */
const BRAND_SWATCHES = [
  lightTheme.colors.primary,
  '#2563EB',
  '#16A34A',
  '#7C3AED',
  '#DC2626',
  '#f51aff',
];

const DEFAULTS: AppearanceSettings = {
  primaryColorOverride: null,
  densityPreference: null,
  fontScalePreference: null,
  highContrast: false,
};

/** The colours `applyAppearanceToRuntime` hands Unistyles for each theme. */
function built(settings: Partial<AppearanceSettings>) {
  runtime.updateTheme.mockClear();
  applyAppearanceToRuntime({ ...DEFAULTS, ...settings });
  const colors: Partial<Record<'light' | 'dark', ThemeColors>> = {};
  for (const [name, updater] of runtime.updateTheme.mock.calls) {
    if (name === 'light') colors.light = updater(lightTheme).colors;
    if (name === 'dark') colors.dark = updater(darkTheme).colors;
  }
  return colors;
}

/** The grounds `toneContrast.test.ts` reads the `accent` tone on. */
const pageGrounds = (c: ThemeColors) => [
  c.background,
  c.backgroundSecondary,
  c.surface,
];

describe('primaryText for a picked brand', () => {
  it('reads at AA on every page ground for every brand swatch in both themes', () => {
    const failing = BRAND_SWATCHES.flatMap(swatch => {
      const themes = built({ primaryColorOverride: swatch });
      return (['light', 'dark'] as const).flatMap(name => {
        const c = themes[name];
        if (!c) return [`${name}: not built`];
        return pageGrounds(c)
          .filter(ground => chroma.contrast(c.primaryText, ground) < AA_BODY)
          .map(ground => `${swatch} ${name} ${c.primaryText} on ${ground}`);
      });
    });

    expect(failing).toEqual([]);
  });
});

describe('a saved brand colour', () => {
  it('falls back to the default brand when no content reads on it at AA', () => {
    // Teal (#0D9488) tops out at 4.44:1, which is why Appearance stopped offering it.
    const themes = built({ primaryColorOverride: '#0D9488' });

    expect(themes.light?.primary).toBe(lightTheme.colors.primary);
    expect(themes.dark?.primary).toBe(darkTheme.colors.primary);
  });
});

describe('High Contrast with the default brand', () => {
  it('lifts every brand pairing the default keeps below AA', () => {
    const themes = built({ highContrast: true });
    const failing = (['light', 'dark'] as const).flatMap(name => {
      const c = themes[name];
      if (!c) return [`${name}: not built`];
      const pairs: [string, string, string][] = [
        ['onPrimary on primary', c.onPrimary, c.primary],
        ['active filter tab', c.filterTab.activeText, c.filterTab.activeBg],
        ...pageGrounds(c).map((ground): [string, string, string] => [
          'primaryText on page',
          c.primaryText,
          ground,
        ]),
      ];
      // The dark tints are translucent; `toneContrast.test.ts` holds them painted.
      if (name === 'light') {
        pairs.push(
          ['onPrimaryLight on its tint', c.onPrimaryLight, c.primaryLight],
          [
            'filtered filter tab',
            c.filterTab.filteredText,
            c.filterTab.filteredBg,
          ],
        );
      }
      return pairs
        .filter(([, fg, bg]) => chroma.contrast(fg, bg) < AA_BODY)
        .map(([what, fg, bg]) => `${name} ${what}: ${fg} on ${bg}`);
    });

    expect(failing).toEqual([]);
  });
});
