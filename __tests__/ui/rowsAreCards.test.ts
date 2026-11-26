import { findProperty, parseSource } from '#/test-utils/sourceAst';

/**
 * Each list row is its own card: a row draws its fill and slots, and its
 * `RowCard` alone draws the corners, shadow, clip and the gap to the next row.
 * Card geometry back on the row primitives draws a second card inside the first.
 */

/** The whole initializer of the style `name` in `file`, nested values included. */
const styleOf = (file: string, name: string, text?: string): string => {
  const property = findProperty(parseSource(file, text), name);
  expect(property).toBeDefined();
  return property?.initializer.getText() ?? '';
};

/** The card geometry a row primitive must not draw. */
const cardGeometryIn = (body: string): string[] =>
  [
    /\bmargin(Bottom|Top|Vertical)?\b/,
    /\bborder(Top|Bottom)?(Left|Right)?Radius\b/,
    /\bborderWidth\b/,
    /shadows\.|boxShadow/,
  ]
    .filter(pattern => pattern.test(body))
    .map(String);

describe('list rows', () => {
  it('reads a style whole, past its nested values', () => {
    const planted = `
      const styles = StyleSheet.create(theme => ({
        rowSurface: {
          variants: { pressed: { opacity: 0.5 }, },
          marginBottom: theme.spacing.sm,
        },
      }));`;

    expect(
      cardGeometryIn(styleOf('planted.ts', 'rowSurface', planted)),
    ).toEqual([String(/\bmargin(Bottom|Top|Vertical)?\b/)]);
  });

  it.each(['rowSurface', 'rowContent'])(
    'keeps %s free of card geometry',
    name => {
      expect(
        cardGeometryIn(styleOf('src/styles/commonStyles.ts', name)),
      ).toEqual([]);
    },
  );

  it('has no per-row wrapper or clip of its own', () => {
    const common = parseSource('src/styles/commonStyles.ts');
    expect(findProperty(common, 'rowWrapper')).toBeUndefined();
    expect(findProperty(common, 'rowClip')).toBeUndefined();
  });

  it("leaves the card's corners, shadow, clip and gap to RowCard", () => {
    const file = 'src/components/atoms/RowCard.tsx';
    const card = styleOf(file, 'card');
    expect(card).toMatch(/radii\.xl/);
    expect(card).toMatch(/shadows\.card/);
    expect(card).toMatch(/layout\.rowGap/);
    expect(styleOf(file, 'clip')).toMatch(/overflow: 'hidden'/);
  });
});
