import { isReference, type ApolloCache } from '@apollo/client';
import type { ModifierDetails } from '@apollo/client/cache';
import { isRecord } from '#/utils/isRecord';

/** The row whose `suggestions` a surface reads. */
export type SuggestionParent = {
  __typename: 'Pantry' | 'ShoppingList';
  id: string;
};

/** Where one stored suggestion sat, so it can go back exactly there. */
export type HeldSuggestion = {
  storeFieldName: string;
  section: string;
  index: number;
  entry: unknown;
};

const suggests = (
  entry: unknown,
  itemId: string,
  { readField }: ModifierDetails,
): boolean => {
  if (isReference(entry)) return readField('itemId', entry) === itemId;
  return isRecord(entry) && entry.itemId === itemId;
};

/** Every place the item is suggested, in each cached variant of the sections. */
export function readHeldSuggestions(
  cache: ApolloCache,
  parent: SuggestionParent,
  itemId: string,
): HeldSuggestion[] {
  const held: HeldSuggestion[] = [];
  cache.modify({
    id: cache.identify(parent),
    optimistic: true,
    fields: {
      suggestions: (existing: unknown, details: ModifierDetails) => {
        if (!isRecord(existing)) return existing;
        for (const [section, list] of Object.entries(existing)) {
          if (!Array.isArray(list)) continue;
          list.forEach((entry: unknown, index) => {
            if (!suggests(entry, itemId, details)) return;
            const { storeFieldName } = details;
            held.push({ storeFieldName, section, index, entry });
          });
        }
        return existing;
      },
    },
  });
  return held;
}

export function hideSuggestion(
  cache: ApolloCache,
  parent: SuggestionParent,
  itemId: string,
): void {
  cache.modify({
    id: cache.identify(parent),
    fields: {
      suggestions: (existing: unknown, details: ModifierDetails) =>
        isRecord(existing)
          ? Object.fromEntries(
              Object.entries(existing).map(([section, list]) => [
                section,
                Array.isArray(list)
                  ? list.filter(
                      (entry: unknown) => !suggests(entry, itemId, details),
                    )
                  : list,
              ]),
            )
          : existing,
    },
  });
}

/**
 * Each entry back at its old index, or at the end of a list that has since
 * shrunk. A list that holds the item again is left as it is.
 */
export function putSuggestionsBack(
  cache: ApolloCache,
  parent: SuggestionParent,
  itemId: string,
  held: readonly HeldSuggestion[],
): void {
  cache.modify({
    id: cache.identify(parent),
    fields: {
      suggestions: (existing: unknown, details: ModifierDetails) => {
        if (!isRecord(existing)) return existing;
        const restored = { ...existing };
        for (const { storeFieldName, section, index, entry } of held) {
          const stored = restored[section];
          if (storeFieldName !== details.storeFieldName) continue;
          if (!Array.isArray(stored)) continue;
          const list: unknown[] = stored;
          if (list.some(item => suggests(item, itemId, details))) continue;
          const at = Math.min(index, list.length);
          restored[section] = [...list.slice(0, at), entry, ...list.slice(at)];
        }
        return restored;
      },
    },
  });
}
