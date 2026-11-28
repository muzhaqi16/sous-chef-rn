import type { ApolloCache } from '@apollo/client';
import { rootFieldOf } from '#apollo/utils/documentOperation';
import {
  ConsumptionUnitsForPantryItemDocument,
  RestockUnitsForPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';

const RANKED_UNIT_FIELDS = [
  ConsumptionUnitsForPantryItemDocument,
  RestockUnitsForPantryItemDocument,
].map(rootFieldOf);

/**
 * A unit refusal makes the cached ranked lists wrong, so they are dropped and
 * the picker refetches. `schema.graphql` directs clients here: the refusal
 * carries no list of units that WOULD work, and this query answers exactly that.
 */
export function dropRankedUnits(cache: ApolloCache): void {
  for (const fieldName of RANKED_UNIT_FIELDS) {
    cache.evict({ id: 'ROOT_QUERY', fieldName });
  }
  cache.gc();
}
