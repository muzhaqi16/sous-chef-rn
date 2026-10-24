import { readFileSync } from 'fs';

/**
 * Each list row is its own card: a row draws its fill and slots, and its
 * `RowCard` alone draws the corners, shadow, clip and the gap to the next row.
 * Card geometry back on the row primitives draws a second card inside the first.
 */
const blockOf = (src: string, name: string) => {
  const start = src.search(new RegExp(`\\b${name}:\\s*[({]`));
  expect(start).toBeGreaterThan(-1);
  return src.slice(start, src.indexOf('},', start));
};

describe('list rows', () => {
  const common = readFileSync('src/styles/commonStyles.ts', 'utf8');

  it.each(['rowSurface', 'rowContent'])(
    'keeps %s free of card geometry',
    name => {
      const body = blockOf(common, name);
      expect(body).not.toMatch(/\bmargin(Bottom|Top|Vertical)?\b/);
      expect(body).not.toMatch(/\bborder(Top|Bottom)?(Left|Right)?Radius\b/);
      expect(body).not.toMatch(/\bborderWidth\b/);
      expect(body).not.toMatch(/shadows\.|boxShadow/);
    },
  );

  it('has no per-row wrapper or clip of its own', () => {
    expect(common).not.toMatch(/\b(rowWrapper|rowClip):/);
  });

  it("leaves the card's corners, shadow, clip and gap to RowCard", () => {
    const src = readFileSync('src/components/atoms/RowCard.tsx', 'utf8');
    const card = blockOf(src, 'card');
    expect(card).toMatch(/radii\.xl/);
    expect(card).toMatch(/shadows\.card/);
    expect(card).toMatch(/layout\.rowGap/);
    expect(blockOf(src, 'clip')).toMatch(/overflow: 'hidden'/);
  });
});
