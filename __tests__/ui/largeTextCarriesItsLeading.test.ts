/**
 * A style that sets a large `fontSize` must set `lineHeight` with it.
 *
 * `Text` (`src/components/atoms/Text.tsx`) gives a size its own leading only
 * when the size is chosen through the `size` PROP. Its `variant` defaults to
 * `body`, whose line box is a fixed 24px — so a style that raises `fontSize`
 * past that leaves 26px glyphs in a 24px box, clipped top and bottom.
 *
 * What makes this worth a guard rather than a code review is that it is
 * INVISIBLE IN ENGLISH. Unaccented Latin letters fit the clipped box, so the
 * screen looks right to everyone who builds it; the first thing lost is the
 * mark above the glyph. `PantryHeader`'s greeting shipped at
 * `fontSize['2xl'] + 2` with no leading, read correctly as "Hello, Chef!", and
 * rendered "Përshëndetje" with the dots sliced off both ë.
 *
 * Scope is the risk zone, not every `fontSize`: 24px is where the body line box
 * stops fitting the glyphs. Below it there is headroom; at or above it there is
 * none.
 */
import { readFileSync } from 'fs';
import { globSync } from 'glob';
import { resolve } from 'path';
import { typography } from '#/theme/foundations/typography';

const ROOT = resolve(__dirname, '..', '..');

/** The point at which the `body` variant's 24px line box stops fitting. */
const RISK_PX = 24;

/** Tokens resolving to `RISK_PX` or more, as they appear in source. */
const RISKY_TOKENS = Object.entries(typography.fontSize)
  .filter(([, px]) => px >= RISK_PX)
  .map(([token]) => token);

/**
 * Blocks that set a large `fontSize` and legitimately need no `lineHeight`,
 * each with its reason. Keyed `<file>#<styleName>`.
 */
const ALLOWED: Record<string, string> = {
  'src/components/modals/NumberInputSheet/NumberInputSheet.tsx#input':
    'A TextInput, not the Text atom — it inherits no variant leading, and RN sizes the line box from the font.',
  'src/features/shoppingList/components/QuantityEditSheet/QuantityEditSheet.tsx#quantityInput':
    'Same: a TextInput, and digits carry nothing above the cap height.',
};

interface Block {
  file: string;
  style: string;
  line: number;
  fontSize: string;
  hasLineHeight: boolean;
}

/** Style blocks in `file` whose `fontSize` resolves to `RISK_PX` or more. */
function riskyBlocks(file: string): Block[] {
  const src = readFileSync(resolve(ROOT, file), 'utf8');
  const out: Block[] = [];

  for (const match of src.matchAll(/^[ \t]*fontSize:[ \t]*(.+?),[ \t]*$/gm)) {
    const value = match[1];
    const token = RISKY_TOKENS.find(t =>
      new RegExp(`\\['${t}'\\]|\\.${t}\\b`).test(value),
    );
    const trimmed = value.trim();
    const literal = /^\d+$/.test(trimmed) ? Number(trimmed) : undefined;
    if (!token && !(literal !== undefined && literal >= RISK_PX)) continue;

    const index = match.index ?? 0;
    const open = src.lastIndexOf('{', index);
    let depth = 0;
    let end = src.length;
    for (let i = open; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const style =
      /([A-Za-z0-9_]+)\s*:\s*$/.exec(src.slice(0, open).trimEnd())?.[1] ?? '?';

    out.push({
      file,
      style,
      line: src.slice(0, index).split('\n').length,
      fontSize: trimmed,
      hasLineHeight: src.slice(open, end).includes('lineHeight'),
    });
  }
  return out;
}

const FILES = globSync('src/**/*.{ts,tsx}', { cwd: ROOT }).filter(
  f => !f.includes('__tests__') && !f.endsWith('.d.ts'),
);

describe('large text carries its own leading', () => {
  it('scans the files it claims to scan', () => {
    // A sweep that reads nothing passes vacuously.
    expect(FILES.length).toBeGreaterThan(200);
    expect(RISKY_TOKENS.length).toBeGreaterThan(0);
  });

  it('finds the large-text styles it is meant to police', () => {
    // If this drops to nothing the matcher has broken, not the codebase.
    expect(FILES.flatMap(riskyBlocks).length).toBeGreaterThanOrEqual(5);
  });

  it('pairs every large fontSize with a lineHeight', () => {
    const offenders = FILES.flatMap(riskyBlocks)
      .filter(b => !b.hasLineHeight)
      .filter(b => !(`${b.file}#${b.style}` in ALLOWED))
      .map(b => `${b.file}:${b.line} — ${b.style} { fontSize: ${b.fontSize} }`);

    expect(offenders).toEqual([]);
  });
});
