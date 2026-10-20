/**
 * A queued pantry create of a typed item, replayed: what the row names once the
 * server created the item under the minted id, or matched one it holds.
 */
import { gql, type InMemoryCache } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import {
  localIntakeRow,
  writeLocalIntake,
} from '#features/pantry/cache/localIntake';
import { reconcileCreatePantryItemReplay } from '../replayReconcilers';

const typed = { inline: { id: 'item-minted', name: 'Cubanelle pepper' } };
const variables = {
  input: { id: 'minted-row', pantryId: 'pantry-1', item: typed },
};

const ROW_ITEM = gql`
  fragment PantryReplayProbeRowItem on PantryItem {
    id
    item {
      id
    }
  }
`;

/** A typed add written locally, as the intake door writes it before firing. */
function queuedTyped(): InMemoryCache {
  const cache = makeCache();
  writeLocalIntake(
    cache,
    'minted-row',
    localIntakeRow('pantry-1', 'Cubanelle pepper', { item: typed }),
  );
  return cache;
}

/** The replay's answer, naming `itemId`, as Apollo writes it before the reconciler. */
function answered(cache: InMemoryCache, itemId: string) {
  const pantryItem = {
    __typename: 'PantryItem',
    id: 'minted-row',
    item: { __typename: 'Item', id: itemId },
  };
  cache.writeFragment({ fragment: ROW_ITEM, data: pantryItem });
  return {
    createPantryItem: { __typename: 'CreatePantryItemPayload', pantryItem },
  };
}

const rowItem = (cache: InMemoryCache) =>
  cache.extract()['PantryItem:minted-row']?.item;

describe('reconcileCreatePantryItemReplay, for a typed item', () => {
  it('names the item the server matched, and the minted one goes', () => {
    const cache = queuedTyped();
    expect(rowItem(cache)).toEqual({ __ref: 'Item:item-minted' });

    reconcileCreatePantryItemReplay(
      cache,
      variables,
      answered(cache, 'item-held'),
    );

    expect(rowItem(cache)).toEqual({ __ref: 'Item:item-held' });
    expect(cache.extract()).not.toHaveProperty('Item:item-minted');
  });

  it('keeps the item the server created under the minted id', () => {
    const cache = queuedTyped();

    reconcileCreatePantryItemReplay(
      cache,
      variables,
      answered(cache, 'item-minted'),
    );

    expect(rowItem(cache)).toEqual({ __ref: 'Item:item-minted' });
    expect(cache.extract()).toHaveProperty('Item:item-minted');
  });
});
