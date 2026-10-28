import { putSuggestionBack, takeSuggestion } from '#domain/suggestionRemoval';

const row = (itemId: string) => ({ id: `sug-${itemId}`, itemId });

describe('takeSuggestion', () => {
  it('removes the item and records where it sat', () => {
    const { list, removal } = takeSuggestion(
      [row('a'), row('b'), row('c')],
      'b',
    );

    expect(list.map(r => r.itemId)).toEqual(['a', 'c']);
    expect(removal).toEqual({ index: 1, entry: row('b') });
  });

  it('records nothing for an item the list does not hold', () => {
    const { list, removal } = takeSuggestion([row('a')], 'z');

    expect(list).toEqual([row('a')]);
    expect(removal).toBeNull();
  });
});

describe('putSuggestionBack', () => {
  it('returns the entry to its old index', () => {
    const { list, removal } = takeSuggestion(
      [row('a'), row('b'), row('c')],
      'b',
    );

    expect(putSuggestionBack(list, removal).map(r => r.itemId)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  // Others left meanwhile: the entry goes to the end rather than past it.
  it('appends to a list that has since shrunk below its index', () => {
    const { removal } = takeSuggestion([row('a'), row('b'), row('c')], 'c');

    expect(putSuggestionBack([row('a')], removal).map(r => r.itemId)).toEqual([
      'a',
      'c',
    ]);
  });

  it('leaves a list that holds the item again as it is', () => {
    const { removal } = takeSuggestion([row('a'), row('b')], 'b');
    const refetched = [row('b'), row('a')];

    expect(putSuggestionBack(refetched, removal)).toEqual(refetched);
  });

  it('does nothing without a removal', () => {
    expect(putSuggestionBack([row('a')], null)).toEqual([row('a')]);
  });
});
