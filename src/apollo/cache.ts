import { InMemoryCache } from '@apollo/client';
import type { TypePolicies, TypePolicy } from '@apollo/client';
// Import generated fragment matcher for proper interface/union type handling
import fragmentMatcherData from '#/graphql/generated/fragmentMatcher.json';
import { FEATURE_TYPE_POLICIES } from '#features/registry.cache';

/**
 * Assembles every feature's type policies; owns nothing domain-shaped itself.
 * A policy lives in `features/<name>/cache/typePolicies.ts`.
 */
export function makeCache(): InMemoryCache {
  return new InMemoryCache({
    // Configure possibleTypes for proper fragment matching on interfaces
    // This ensures Apollo can correctly normalize types implementing Node, Connection, Edge
    possibleTypes: fragmentMatcherData.possibleTypes,
    typePolicies: mergeTypePolicies(FEATURE_TYPE_POLICIES),
  });
}

/**
 * Two features contributing to the same type is expected — `Query` is where
 * they all meet — so `fields` merge rather than replace. A collision on the
 * same field throws: the only symptom of a silent overwrite is a list that
 * stops appending pages.
 */
export function mergeTypePolicies(parts: TypePolicies[]): TypePolicies {
  const merged: TypePolicies = {};
  for (const part of parts) {
    for (const [typename, policy] of Object.entries(part)) {
      const existing = merged[typename];
      if (!existing) {
        merged[typename] = policy;
        continue;
      }
      merged[typename] = combine(typename, existing, policy);
    }
  }
  return merged;
}

function combine(
  typename: string,
  existing: TypePolicy,
  incoming: TypePolicy,
): TypePolicy {
  const existingFields = existing.fields ?? {};
  const incomingFields = incoming.fields ?? {};
  for (const field of Object.keys(incomingFields)) {
    if (field in existingFields) {
      throw new Error(
        `Two features declare a cache policy for ${typename}.${field}. ` +
          'One would silently overwrite the other — give the field to one feature.',
      );
    }
  }
  return {
    ...existing,
    ...incoming,
    fields: { ...existingFields, ...incomingFields },
  };
}
