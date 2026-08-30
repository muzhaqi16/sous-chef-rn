export interface VersionedEntity {
  id: string;
  version?: number | null;
  updatedAt?: string | null;
  __typename?: string;
}

/**
 * Merge `updates` into a cached entity for an optimistic response. The version is
 * kept, NOT incremented — the server owns that, and its response carries the
 * incremented one.
 */
export function enhanceWithVersion<T extends VersionedEntity>(
  currentItem: T | undefined,
  updates: Partial<T> | Record<string, unknown>,
): T {
  if (!currentItem) {
    throw new Error('enhanceWithVersion requires a current item from cache');
  }

  return {
    ...currentItem,
    ...updates,
    version: currentItem.version || 0,
    updatedAt: new Date().toISOString(),
  } as T;
}

/**
 * Minimal optimistic response for an entity not yet cached. Callers MUST pass T
 * explicitly (the fragment / mutation selection type) and supply EVERY selected
 * field — a `Partial<> + as T` signature lets `undefined` past TypeScript, and
 * Apollo warns "Missing field" at runtime. `id` is the client-minted cuid2.
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
 * Builds `{ __typename: 'Mutation', <op>: { __typename: <payload>, ...fields } }`.
 * Parent aggregate fields cannot be predicted client-side — pass them as null.
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
