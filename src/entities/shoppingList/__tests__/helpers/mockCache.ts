/**
 * A hand-driven `cache.modify`: the mock records the field modifiers an updater
 * installs so a test can invoke one and read what it returned. It observes the
 * modifier's OWN result, never what a real cache does with it — a rule living in
 * a type policy needs `makeCache()` instead.
 */
import type { ApolloCache } from '@apollo/client';

/** Mock Apollo cache exposing the methods the updaters touch as jest mocks. */
export type MockedCache = ApolloCache & {
  modify: jest.Mock;
  evict: jest.Mock;
  gc: jest.Mock;
  identify: jest.Mock;
  readFragment: jest.Mock;
};

/** A cache ref or normalized object the field helpers read from. */
export type MockRef = { __ref?: string; [key: string]: unknown };

/** Field-modifier helpers passed to each `cache.modify` field function. */
export interface FieldHelpers {
  toReference: jest.Mock;
  readField: jest.Mock;
  storeFieldName: string;
}

export function createMockCache(): MockedCache {
  return {
    modify: jest.fn(),
    evict: jest.fn(),
    gc: jest.fn(),
    identify: jest.fn(
      (obj: { __typename: string; id: string }) =>
        `${obj.__typename}:${obj.id}`,
    ),
    readFragment: jest.fn(),
  } as unknown as MockedCache;
}

/**
 * Given a mock cache whose `modify` was called, extract and invoke
 * a specific field function from the modify call.
 */
export function invokeFieldModifier(
  mockCache: MockedCache,
  fieldName: string,
  existingValue: unknown,
  helpers: Partial<FieldHelpers>,
  callIndex = 0,
) {
  const modifyCall = mockCache.modify.mock.calls[callIndex];
  const fields = modifyCall[0].fields;
  if (!fields[fieldName]) return undefined;
  return fields[fieldName](existingValue, helpers);
}

export function createFieldHelpers(
  overrides: Partial<FieldHelpers> = {},
): FieldHelpers {
  return {
    toReference: jest.fn((item?: { __typename: string; id: string }) =>
      item ? { __ref: `${item.__typename}:${item.id}` } : undefined,
    ),
    readField: jest.fn((fieldName: string, ref?: MockRef) => {
      if (!ref) return undefined;
      if (ref.__ref) {
        const parts = ref.__ref.split(':');
        if (fieldName === 'id') return parts[1];
      }
      return ref[fieldName];
    }),
    storeFieldName: overrides.storeFieldName ?? 'itemsConnection',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// removeFromShoppingListItemsConnection
// ---------------------------------------------------------------------------
