import { mergeTypePolicies } from '#/apollo/cache';

/**
 * Assembling per-feature policies is a merge, so a key two features both
 * declare has to be refused rather than resolved by ordering — the loser is
 * reported nowhere, and the policies that decide pagination, normalization and
 * write-time invariants are exactly the ones that go missing.
 */
describe('mergeTypePolicies refuses every collision it can receive', () => {
  it('merges policies that do not overlap', () => {
    const merged = mergeTypePolicies([
      { Pantry: { keyFields: ['id'] } },
      { Pantry: { fields: { stats: { merge: true } } } },
      { ShoppingList: { merge: true } },
    ]);
    expect(merged.Pantry).toMatchObject({ keyFields: ['id'] });
    expect(merged.ShoppingList).toMatchObject({ merge: true });
  });

  it('refuses two declarations of the same field', () => {
    expect(() =>
      mergeTypePolicies([
        { Pantry: { fields: { items: { merge: true } } } },
        { Pantry: { fields: { items: { merge: false } } } },
      ]),
    ).toThrow(/Pantry\.items/);
  });

  it.each(['keyFields', 'merge', 'read'])(
    'refuses two declarations of %s',
    key => {
      expect(() =>
        mergeTypePolicies([
          { Pantry: { [key]: ['a'] } },
          { Pantry: { [key]: ['b'] } },
        ]),
      ).toThrow(new RegExp(key));
    },
  );

  it('names the type and the key it refused', () => {
    expect(() =>
      mergeTypePolicies([
        { ShoppingListItem: { keyFields: ['id'] } },
        { ShoppingListItem: { keyFields: ['id', 'listId'] } },
      ]),
    ).toThrow(/ShoppingListItem/);
  });
});
