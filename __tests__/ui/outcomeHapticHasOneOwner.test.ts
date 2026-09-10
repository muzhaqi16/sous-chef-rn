import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { join } from 'node:path';

/**
 * An outcome haptic is fired by `toastService`, which pairs one with the toast
 * TYPE so every consumer gets it. A caller that fires its own beside a toast
 * buzzes twice for one failure — which is how the shopping list came to buzz
 * twice where the pantry buzzed once.
 *
 * A haptic BEFORE an action (a selection on tap, a warning as a delete starts)
 * is a different thing and is not what this checks.
 */
const SRC = join(__dirname, '../../src');

const files = globSync('**/*.{ts,tsx}', { cwd: SRC })
  .filter(f => !f.includes('__tests__') && !f.includes('__mocks__'))
  .map(f => join(SRC, f));

describe('an outcome haptic has one owner', () => {
  it('is not fired again beside the toast that already fires it', () => {
    const offenders: string[] = [];
    for (const file of files) {
      if (file.endsWith('toastService.ts')) continue;
      const source = readFileSync(file, 'utf8');
      // The two adjacent, in either order, within one statement gap.
      const doubled =
        /HapticService\.(error|success|warning)\(\);\s*\n\s*toastService\.(error|success|warning)\(/.test(
          source,
        ) ||
        /toastService\.(error|success|warning)\([^;]*\);\s*\n\s*HapticService\.(error|success|warning)\(\)/.test(
          source,
        );
      if (doubled) offenders.push(file.replace(SRC, 'src'));
    }
    expect(offenders).toEqual([]);
  });

  it('sees the pairing it is guarding — toastService fires one per type', () => {
    const source = readFileSync(join(SRC, 'services/toastService.ts'), 'utf8');
    for (const type of ['success', 'error', 'warning']) {
      expect(source).toContain(`HapticService.${type}();`);
    }
    // `info` is neutral and deliberately silent.
    expect(source).not.toContain('HapticService.info(');
  });
});
