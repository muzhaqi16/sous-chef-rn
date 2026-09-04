import { TONE_TO_COLOR } from '#utils/iconUtils';
import { lightTheme, darkTheme } from '#/theme/themes';

/**
 * `IconTone` is `keyof typeof TONE_TO_COLOR`. Annotating the map
 * `Record<string, …>` widens that to `string`, and a tone the map does not have
 * then type-checks and throws on the undefined resolver — nine call sites were
 * in that state, each a crash the moment its branch rendered.
 */
describe('icon tones', () => {
  it('resolves every tone against both themes', () => {
    const tones = Object.keys(TONE_TO_COLOR);
    expect(tones.length).toBeGreaterThan(20);

    for (const tone of tones) {
      for (const theme of [lightTheme, darkTheme]) {
        const colour = TONE_TO_COLOR[tone as keyof typeof TONE_TO_COLOR](theme);
        expect(typeof colour).toBe('string');
        expect(colour).not.toBe('');
      }
    }
  });

  it('has no tone whose colour the theme does not define', () => {
    const undefinedTones = Object.keys(TONE_TO_COLOR).filter(
      tone =>
        TONE_TO_COLOR[tone as keyof typeof TONE_TO_COLOR](lightTheme) ===
        undefined,
    );

    expect(undefinedTones).toEqual([]);
  });
});
