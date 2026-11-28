import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Nothing at build time or in JS notices this theme item going missing: text
 * still renders, and only a line with no width to spare loses its last word,
 * on Android 15+ alone. `docs/verified-library-behaviour.md`
 * § Android breaks a TextView's lines by glyph bounds.
 */
const read = (...segments: string[]) =>
  readFileSync(join(__dirname, '..', 'android', ...segments), 'utf8');

/** Whether the `AppTheme` style itself turns bounds-based breaking off. */
const appThemeBreaksByAdvance = (styles: string): boolean => {
  const [appTheme] =
    /<style name="AppTheme"[\s\S]*?<\/style>/.exec(styles) ?? [];
  return /<item name="android:useBoundsForWidth"[^>]*>false<\/item>/.test(
    appTheme ?? '',
  );
};

/** Whether the `<application>` element itself applies `AppTheme`. */
const appliesAppTheme = (manifest: string): boolean => {
  const [application] = /<application[\s\S]*?>/.exec(manifest) ?? [];
  return (application ?? '').includes('android:theme="@style/AppTheme"');
};

describe('Android text line breaking', () => {
  it('catches the item on another style, and the theme on another element', () => {
    expect(
      appThemeBreaksByAdvance(`
        <style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar"></style>
        <style name="SplashTheme">
          <item name="android:useBoundsForWidth">false</item>
        </style>`),
    ).toBe(false);
    expect(
      appliesAppTheme(`
        <application android:name=".MainApplication">
          <activity android:theme="@style/AppTheme" />
        </application>`),
    ).toBe(false);
  });

  it('keeps every TextView on the advance-based breaking React Native measures with', () => {
    expect(
      appThemeBreaksByAdvance(
        read('app', 'src', 'main', 'res', 'values', 'styles.xml'),
      ),
    ).toBe(true);
  });

  it('applies that theme to the whole application', () => {
    expect(
      appliesAppTheme(read('app', 'src', 'main', 'AndroidManifest.xml')),
    ).toBe(true);
  });
});
