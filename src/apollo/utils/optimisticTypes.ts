/**
 * Typed helpers for building optimistic mutation responses
 *
 * Eliminates `as any` casts by providing type-safe builders for common
 * mutation response patterns used throughout the app.
 */

/**
 * Build a typed optimistic mutation response for a standard payload pattern.
 *
 * @example
 * ```typescript
 * optimisticResponse: buildOptimisticMutationResponse(
 *   'updatePantryItem',
 *   'PantryItemPayload',
 *   'pantryItem',
 *   enhanceWithVersion(currentItem, updates)
 * )
 * ```
 */
export function buildOptimisticMutationResponse<TEntity, TResult = any>(
  mutationField: string,
  payloadTypename: string,
  entityField: string,
  entity: TEntity,
): TResult {
  return {
    __typename: 'Mutation' as const,
    [mutationField]: {
      __typename: payloadTypename,
      success: true,
      message: '',
      code: 'SUCCESS',
      [entityField]: entity,
    },
  } as any; // justified: dynamic computed property [mutationField] can't satisfy specific generated mutation types
}

/**
 * Build a typed optimistic response for remove/delete mutations
 * where only the entity ID is returned.
 *
 * @example
 * ```typescript
 * optimisticResponse: buildOptimisticDeleteResponse(
 *   'deletePantryItem',
 *   'PantryItemPayload',
 *   'pantryItem',
 *   'PantryItem',
 *   variables.id
 * )
 * ```
 */
export function buildOptimisticDeleteResponse<TResult = any>(
  mutationField: string,
  payloadTypename: string,
  entityField: string,
  entityTypename: string,
  entityId: string,
): TResult {
  return {
    __typename: 'Mutation' as const,
    [mutationField]: {
      __typename: payloadTypename,
      success: true,
      message: '',
      code: 'SUCCESS',
      [entityField]: {
        __typename: entityTypename,
        id: entityId,
      },
    },
  } as any; // justified: dynamic computed property [mutationField] can't satisfy specific generated mutation types
}

/**
 * Build a typed optimistic response for the ShoppingListItem remove mutation
 * which has a non-standard response shape (returns the item directly, not a payload).
 */
export function buildOptimisticRemoveItemResponse<TEntity extends { __typename: string; id: string }, TResult = any>(
  mutationField: string,
  entity: TEntity,
): TResult {
  return {
    __typename: 'Mutation' as const,
    [mutationField]: entity,
  } as any; // justified: dynamic computed property [mutationField] can't satisfy specific generated mutation types
}
