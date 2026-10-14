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

describe('Android text line breaking', () => {
  it('keeps every TextView on the advance-based breaking React Native measures with', () => {
    const styles = read('app', 'src', 'main', 'res', 'values', 'styles.xml');
    const [appTheme] =
      /<style name="AppTheme"[\s\S]*?<\/style>/.exec(styles) ?? [];

    expect(appTheme).toMatch(
      /<item name="android:useBoundsForWidth"[^>]*>false<\/item>/,
    );
  });

  it('applies that theme to the whole application', () => {
    const manifest = read('app', 'src', 'main', 'AndroidManifest.xml');
    const [application] = /<application[\s\S]*?>/.exec(manifest) ?? [];

    expect(application).toContain('android:theme="@style/AppTheme"');
  });
});
