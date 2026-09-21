import { readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

/**
 * `FractionInput` is seeded with text like "1 1/2", and its quick-select chips
 * write "1/2" into it. A digits-only or decimal keypad has no "/" and no space,
 * so after one edit the person cannot type the value back.
 */

/** Keypads with no "/" — `FractionInput`'s own default is `numbers-and-punctuation`. */
const NO_SLASH_KEYPADS = ['numeric', 'number-pad', 'decimal-pad'];

function fractionInputElements(): { file: string; element: string }[] {
  const files = execSync(
    `git grep -l "<FractionInput" -- 'src/**/*.tsx' | grep -v __tests__ || true`,
    { cwd: process.cwd(), encoding: 'utf8' },
  )
    .split('\n')
    .filter(Boolean);

  return files.flatMap(file => {
    const source = readFileSync(join(process.cwd(), file), 'utf8');
    // Each element runs from its tag to the first self-close.
    return [...source.matchAll(/<FractionInput\b[\s\S]*?\/>/g)].map(match => ({
      file,
      element: match[0],
    }));
  });
}

describe('a fraction field is shown with a keypad that can type a fraction', () => {
  it('finds the fields it guards', () => {
    expect(fractionInputElements().length).toBeGreaterThan(5);
  });

  it('never overrides the keypad with one that has no slash', () => {
    const blocked = fractionInputElements()
      .filter(({ element }) =>
        NO_SLASH_KEYPADS.some(keypad =>
          element.includes(`keyboardType="${keypad}"`),
        ),
      )
      .map(({ file }) => file);

    expect(blocked).toEqual([]);
  });
});
