import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { UnitType } from '#/graphql/generated/schemaTypes';
import { buildOptimisticPantryItem } from '../buildOptimisticPantryItem';

const UNIT_FIELDS = gql`
  fragment BuildOptimisticUnitProbe on Unit {
    id
    name
    symbol
    type
    displayAsFraction
  }
`;

const ITEM_DISPLAY_UNIT = gql`
  fragment BuildOptimisticItemDisplayUnitProbe on Item {
    id
    displayUnit {
      id
      name
      symbol
      type
      displayAsFraction
    }
  }
`;

const unit = (id: string, symbol: string) => ({
  __typename: 'Unit',
  id,
  name: symbol,
  symbol,
  type: UnitType.Count,
  displayAsFraction: false,
});

function cacheWithItemDisplayUnit(
  itemId: string,
  displayUnit: ReturnType<typeof unit>,
) {
  const cache = makeCache();
  cache.writeFragment({
    id: cache.identify({ __typename: 'Item', id: itemId }),
    fragment: ITEM_DISPLAY_UNIT,
    data: { __typename: 'Item', id: itemId, displayUnit },
  });
  return cache;
}

describe('buildOptimisticPantryItem unit', () => {
  it("takes the catalog item's display unit when the add states none", () => {
    const bottle = unit('unit-bottle', 'btl');
    const cache = cacheWithItemDisplayUnit('item-1', bottle);

    const row = buildOptimisticPantryItem(
      'pi-1',
      { pantryId: 'p1', itemName: 'Olive oil', itemId: 'item-1' },
      cache,
    );

    expect(row.unit).toEqual(bottle);
  });

  it('prefers the unit the add states', () => {
    const cache = cacheWithItemDisplayUnit(
      'item-1',
      unit('unit-bottle', 'btl'),
    );
    const litre = unit('unit-l', 'L');
    cache.writeFragment({
      id: cache.identify(litre),
      fragment: UNIT_FIELDS,
      data: litre,
    });

    const row = buildOptimisticPantryItem(
      'pi-1',
      {
        pantryId: 'p1',
        itemName: 'Olive oil',
        itemId: 'item-1',
        unitId: 'unit-l',
      },
      cache,
    );

    expect(row.unit).toEqual(litre);
  });

  // The API always tracks a stack in some unit, so a row read unguarded must
  // hold one even before the replay says which.
  it('never leaves the unit null when the cache knows neither', () => {
    const row = buildOptimisticPantryItem(
      'pi-1',
      { pantryId: 'p1', itemName: 'Olive oil', itemId: 'item-unknown' },
      makeCache(),
    );

    expect(row.unit).not.toBeNull();
    expect(row.unit.symbol).toBe('');
  });
});
