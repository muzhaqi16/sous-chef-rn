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
 * mark above the glyph. A greeting shipped at `fontSize['2xl'] + 2` with no
 * leading, read correctly as "Hello, Chef!", and rendered "Përshëndetje" with
 * the dots sliced off both ë.
 *
 * Scope is the risk zone, not every `fontSize`: 24px is where the body line box
 * stops fitting the glyphs. Below it there is headroom; at or above it there is
 * none.
 */
import * as ts from 'typescript';
import { typography } from '#theme/foundations/typography';
import {
  lineOf,
  nodesOf,
  parseSource,
  productionSources,
  propertyName,
} from '#/test-utils/sourceAst';

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
  'src/features/shoppingList/components/QuantityEditSheet/QuantityEditSheet.tsx#quantityInput':
    'A TextInput, not the Text atom — it inherits no variant leading, and RN sizes the line box from the font; digits carry nothing above the cap height.',
};

interface Block {
  file: string;
  style: string;
  line: number;
  fontSize: string;
  hasLineHeight: boolean;
}

const isRisky = (value: string): boolean => {
  const token = RISKY_TOKENS.find(t =>
    new RegExp(`\\['${t}'\\]|\\.${t}\\b`).test(value),
  );
  return !!token || (/^\d+$/.test(value) && Number(value) >= RISK_PX);
};

/** Style objects in `file` whose own `fontSize` resolves to `RISK_PX` or more. */
function riskyBlocks(file: string, text?: string): Block[] {
  return nodesOf(parseSource(file, text))
    .filter(ts.isObjectLiteralExpression)
    .flatMap(style => {
      const own = (name: string) =>
        style.properties.find(
          property =>
            (ts.isPropertyAssignment(property) ||
              ts.isShorthandPropertyAssignment(property)) &&
            propertyName(property.name) === name,
        );
      const fontSize = own('fontSize');
      if (!fontSize || !ts.isPropertyAssignment(fontSize)) return [];
      const value = fontSize.initializer.getText();
      if (!isRisky(value)) return [];
      const holder = style.parent;
      return [
        {
          file,
          style:
            ts.isPropertyAssignment(holder) && propertyName(holder.name)
              ? propertyName(holder.name) ?? '?'
              : '?',
          line: lineOf(fontSize),
          fontSize: value,
          hasLineHeight: !!own('lineHeight'),
        },
      ];
    });
}

const FILES = productionSources();

describe('large text carries its own leading', () => {
  it('catches a one-line style with no leading', () => {
    const planted = `
      const styles = StyleSheet.create(theme => ({
        title: { fontSize: theme.typography.fontSize['2xl'], fontWeight: '700' },
        body: { fontSize: 28, lineHeight: 34 },
      }));`;

    expect(
      riskyBlocks('planted.ts', planted)
        .filter(block => !block.hasLineHeight)
        .map(block => block.style),
    ).toEqual(['title']);
  });

  it('scans the files it claims to scan', () => {
    // A sweep that reads nothing passes vacuously.
    expect(FILES.length).toBeGreaterThan(200);
    expect(RISKY_TOKENS.length).toBeGreaterThan(0);
  });

  it('finds the large-text styles it is meant to police', () => {
    // If this drops to nothing the matcher has broken, not the codebase.
    expect(
      FILES.flatMap(file => riskyBlocks(file)).length,
    ).toBeGreaterThanOrEqual(5);
  });

  it('pairs every large fontSize with a lineHeight', () => {
    const offenders = FILES.flatMap(file => riskyBlocks(file))
      .filter(b => !b.hasLineHeight)
      .filter(b => !(`${b.file}#${b.style}` in ALLOWED))
      .map(b => `${b.file}:${b.line} — ${b.style} { fontSize: ${b.fontSize} }`);

    expect(offenders).toEqual([]);
  });
});
