/**
 * Utilities for creating optimistic responses with automatic version management
 *
 * These utilities help create optimistic responses that work seamlessly with
 * version-based conflict resolution in Apollo cache merge functions.
 */

/**
 * Base interface for entities that support versioned optimistic updates
 */
export interface VersionedEntity {
  id: string;
  version?: number | null;
  updatedAt?: string | null;
  __typename?: string;
}

/**
 * Enhances an entity with updated timestamp for optimistic responses
 *
 * Note: Does NOT increment version - the server handles version increments.
 * The optimistic response should predict the field changes but keep the
 * current version. The server response will have the incremented version.
 *
 * @template T - Entity type that extends VersionedEntity
 * @param currentItem - The current item from cache
 * @param updates - Partial updates to apply
 * @returns Enhanced item with updates and current timestamp (version unchanged)
 *
 * @example
 * ```typescript
 * optimisticResponse: variables => {
 *   const currentItem = items.find(item => item.id === variables.id);
 *   return {
 *     __typename: 'Mutation',
 *     markItemPurchased: enhanceWithVersion(currentItem, {
 *       isPurchased: variables.status
 *     })
 *   };
 * }
 * ```
 */
export function enhanceWithVersion<T extends VersionedEntity>(
  currentItem: T | undefined,
  updates: Partial<T> | Record<string, unknown>,
): T {
  if (!currentItem) {
    // If no current item, return minimal optimistic response
    // Caller should handle this case
    throw new Error('enhanceWithVersion requires a current item from cache');
  }

  return {
    ...currentItem,
    ...updates,
    // Keep current version - server will increment it
    version: currentItem.version || 0,
    updatedAt: new Date().toISOString(),
  } as T;
}

/**
 * Creates a minimal optimistic response for entities that don't exist in cache yet
 *
 * Useful for add/create mutations where the item doesn't exist yet.
 *
 * Callers MUST pass T explicitly (the fragment / mutation selection type) and
 * supply every selected field. A previous version used `Partial<>` + `as T`,
 * which let `displayFormat: undefined` slip past TypeScript and triggered
 * Apollo "Missing field" warnings at runtime.
 *
 * @template T - Fragment / mutation selection type (must be passed explicitly)
 * @param typename - GraphQL typename (e.g., 'ShoppingListItem')
 * @param id - Entity ID — the client-minted permanent cuid2 from
 *   `generateEntityId()` (also sent as the create `input.id`)
 * @param data - All selected fields except id/version/updatedAt/__typename
 * @returns Entity with version 1 and current timestamp merged in
 *
 * @example
 * ```typescript
 * createOptimisticEntity<ShoppingListItemDisplayFragment>(
 *   'ShoppingListItem',
 *   generateEntityId(),
 *   { itemName, quantity, displayFormat: DisplayFormat.Auto, ... },
 * )
 * ```
 */
export function createOptimisticEntity<T extends VersionedEntity>(
  typename: T['__typename'],
  id: string,
  data: Omit<T, 'id' | 'version' | 'updatedAt' | '__typename'>,
): T {
  return {
    __typename: typename,
    id,
    version: 1,
    updatedAt: new Date().toISOString(),
    ...data,
  } as T;
}

/**
 * Builds the standard optimistic mutation response wrapper.
 *
 * Eliminates the repetitive `{ __typename: 'Mutation', opName: { __typename: 'PayloadType', ... } }`
 * boilerplate and ensures parent aggregate fields (which can't be predicted client-side) are null.
 *
 * @param operationName - The mutation field name (e.g. 'updatePantryItem')
 * @param payloadTypename - The success payload typename (e.g. 'UpdatePantryItemPayload')
 * @param fields - The payload fields (e.g. `{ pantryItem: entity, pantry: null }`)
 *
 * @example
 * ```ts
 * optimisticResponse: buildOptimisticMutationResponse(
 *   'updatePantryItem',
 *   'UpdatePantryItemPayload',
 *   { pantryItem: optimisticEntity, pantry: null },
 * ),
 * ```
 */
export function buildOptimisticMutationResponse<
  TOpName extends string,
  TPayloadName extends string,
  TFields extends Record<string, unknown>,
>(
  operationName: TOpName,
  payloadTypename: TPayloadName,
  fields: TFields,
): { __typename: 'Mutation' } & Record<
  TOpName,
  { __typename: TPayloadName } & TFields
> {
  const result: { __typename: 'Mutation' } & Record<
    TOpName,
    { __typename: TPayloadName } & TFields
  > = {
    __typename: 'Mutation',
    [operationName]: {
      __typename: payloadTypename,
      ...fields,
    },
  } as { __typename: 'Mutation' } & Record<
    TOpName,
    { __typename: TPayloadName } & TFields
  >;
  return result;
}
