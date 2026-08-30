import { InMemoryCache, gql } from '@apollo/client';
import { snapshotFields, writeEntityFields } from '../localFirstFields';

// Unique per seed shape: graphql-tag warns when one name is reused for
// different content, which is the very thing the duplicate-name test below
// asserts about the code under test.
let seedCounter = 0;
const seed = (data: Record<string, unknown>, fields: string) => {
  const cache = new InMemoryCache();
  cache.writeFragment({
    id: `${data.__typename as string}:${data.id as string}`,
    fragment: gql`fragment Seed${(seedCounter += 1)} on ${
      data.__typename as string
    } { ${fields} }`,
    data,
  });
  return cache;
};

describe('writeEntityFields', () => {
  it('introduces a field the cached entity has never carried', () => {
    // Which fields an entity carries is decided by whichever query loaded it.
    // `GetMealTemplateForEdit` selects no `recipe`, and `cache.modify` runs a
    // modifier only for a field already in the store object — so writing one
    // through it was dropped with no error, leaving the row with the cleared
    // custom name and no recipe.
    const cache = seed(
      {
        __typename: 'MealTemplateItem',
        id: 'item-9',
        customMealName: 'Soup',
      },
      'id customMealName',
    );

    writeEntityFields(
      cache,
      { __typename: 'MealTemplateItem', id: 'item-9' },
      {
        customMealName: null,
        recipe: { __typename: 'Recipe', id: 'recipe-1', name: 'Carbonara' },
      },
    );

    const stored = cache.extract()['MealTemplateItem:item-9'];
    expect(stored?.customMealName).toBeNull();
    expect(stored?.recipe).toEqual({ __ref: 'Recipe:recipe-1' });
  });

  it('normalizes a nested entity instead of storing a copy of it', () => {
    const cache = seed(
      { __typename: 'StorageLocation', id: 'loc-1', name: 'Fridge' },
      'id name',
    );
    seed(
      { __typename: 'StorageLocation', id: 'loc-2', name: 'Shelf' },
      'id name',
    );
    cache.writeFragment({
      id: 'StorageLocation:loc-2',
      fragment: gql`
        fragment P on StorageLocation {
          id
          name
          parentLocation {
            id
            name
          }
        }
      `,
      data: {
        __typename: 'StorageLocation',
        id: 'loc-2',
        name: 'Shelf',
        parentLocation: null,
      },
    });

    writeEntityFields(
      cache,
      { __typename: 'StorageLocation', id: 'loc-2' },
      { parentLocation: { __typename: 'StorageLocation', id: 'loc-1' } },
    );

    // A stored copy forks the parent: renaming it afterwards moves one row and
    // leaves every child's sub-label on the old name.
    expect(cache.extract()['StorageLocation:loc-2']?.parentLocation).toEqual({
      __ref: 'StorageLocation:loc-1',
    });
    // Identity-only data must not clobber the parent's own record.
    expect(cache.extract()['StorageLocation:loc-1']?.name).toBe('Fridge');
  });

  it('skips undefined so a partial update never blanks a field', () => {
    const cache = seed(
      { __typename: 'StorageLocation', id: 'loc-1', name: 'Fridge' },
      'id name',
    );

    writeEntityFields(
      cache,
      { __typename: 'StorageLocation', id: 'loc-1' },
      { name: undefined },
    );

    expect(cache.extract()['StorageLocation:loc-1']?.name).toBe('Fridge');
  });

  /**
   * The fragment is built at RUNTIME from the update's keys, so a fixed name
   * means graphql-tag is handed different content under one name on every
   * distinct field shape. It warns per shape and keeps every document in its
   * module-scope cache, which grows for the life of the process.
   *
   * See `docs/verified-library-behaviour.md#a-document-registered-with-a-library`
   * — the same constraint `writePantryItemDetailStub` builds its per-field
   * fragments to satisfy.
   */
  it('registers distinct field shapes without a duplicate-name warning', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const cache = seed(
        { __typename: 'StorageLocation', id: 'loc-1', name: 'Fridge' },
        'id name',
      );
      const entity = { __typename: 'StorageLocation', id: 'loc-1' } as const;

      writeEntityFields(cache, entity, { name: 'Freezer' });
      writeEntityFields(cache, entity, { name: 'Pantry', notes: 'cold' });
      writeEntityFields(cache, entity, { notes: 'dry' });

      const duplicateWarnings = warn.mock.calls.filter(([first]) =>
        String(first).includes('Warning: fragment with name LocalFirstFields'),
      );
      expect(duplicateWarnings).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });

  it('is a no-op for an unidentifiable entity rather than writing ROOT_QUERY', () => {
    const cache = new InMemoryCache();
    writeEntityFields(cache, undefined, { name: 'x' });
    expect(cache.extract()).toEqual({});
  });
});

describe('snapshotFields', () => {
  /**
   * The revert's half of the contract. `writeEntityFields` skips `undefined`,
   * so a key OMITTED from the snapshot is a field the revert leaves alone —
   * which is the only correct treatment for a field the snapshot's read never
   * carried. Coercing that absence to `null` writes emptiness over a value the
   * snapshot never saw, and on the local-first path there is no next fetch to
   * repair it.
   */
  it('omits a key the read did not carry', () => {
    const previous = snapshotFields(
      { customMealName: 'Soup' },
      { customMealName: null, recipe: { __typename: 'Recipe', id: 'r-1' } },
    );

    expect('customMealName' in previous).toBe(true);
    expect('recipe' in previous).toBe(false);
  });

  it('keeps a genuinely null value as null', () => {
    const previous = snapshotFields(
      { customMealName: null, recipe: null },
      { customMealName: 'Soup', recipe: { __typename: 'Recipe', id: 'r-1' } },
    );

    expect(previous).toEqual({ customMealName: null, recipe: null });
  });

  it('snapshots only the keys the update will write', () => {
    const previous = snapshotFields(
      { name: 'Fridge', notes: 'cold', isDefault: true },
      { name: 'Freezer' },
    );

    expect(previous).toEqual({ name: 'Fridge' });
  });

  it('is empty when there is nothing to snapshot', () => {
    expect(snapshotFields(undefined, { name: 'x' })).toEqual({});
    expect(snapshotFields(null, { name: 'x' })).toEqual({});
  });

  it('leaves an unread field untouched through a real revert', () => {
    // The whole point, end to end: the entity holds a recipe the snapshot's
    // read never selected, so the revert must not blank it.
    const cache = seed(
      {
        __typename: 'MealTemplateItem',
        id: 'item-1',
        customMealName: 'Soup',
        recipe: { __typename: 'Recipe', id: 'rec-9', name: 'Ragu' },
      },
      'id customMealName recipe { __typename id name }',
    );
    const entity = { __typename: 'MealTemplateItem', id: 'item-1' } as const;

    const updates = { customMealName: null, recipe: null };
    // A read that carried only `customMealName` — the editor query's old shape.
    const previous = snapshotFields({ customMealName: 'Soup' }, updates);

    writeEntityFields(cache, entity, updates);
    writeEntityFields(cache, entity, previous);

    const stored = cache.extract()['MealTemplateItem:item-1'] as {
      customMealName?: unknown;
      recipe?: unknown;
    };
    expect(stored.customMealName).toBe('Soup');
    // Not resurrected by the revert — but not blanked BY the revert either.
    // The update nulled it; the revert simply did not write over it again.
    expect('recipe' in stored).toBe(true);
  });
});
