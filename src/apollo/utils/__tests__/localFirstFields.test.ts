import { InMemoryCache, gql } from '@apollo/client';
import { writeEntityFields } from '../localFirstFields';

const seed = (data: Record<string, unknown>, fields: string) => {
  const cache = new InMemoryCache();
  cache.writeFragment({
    id: `${data.__typename as string}:${data.id as string}`,
    fragment: gql`fragment Seed on ${data.__typename as string} { ${fields} }`,
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

  it('is a no-op for an unidentifiable entity rather than writing ROOT_QUERY', () => {
    const cache = new InMemoryCache();
    writeEntityFields(cache, undefined, { name: 'x' });
    expect(cache.extract()).toEqual({});
  });
});
