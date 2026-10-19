import type { ItemRefInput } from '#/graphql/generated/schemaTypes';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { generateEntityId } from '#/utils/generateEntityId';

/**
 * A unit, brand or storage-location reference. The API's `*RefInput` types are
 * `@oneOf`: exactly one key, and a second one is refused as BAD_USER_INPUT
 * before any resolver runs. A picked id wins over the text typed beside it.
 */
export function refByIdOrName(
  id: string | null | undefined,
  name: string | null | undefined,
): { id: string } | { name: string } | undefined {
  if (id) return { id };
  const typed = firstNonBlank(name)?.trim();
  return typed ? { name: typed } : undefined;
}

/** A list line's item as this build sends it: never the `itemName` the API retires. */
export type SentItemRef = Exclude<ItemRefInput, { itemName: string }>;

/**
 * An item typed by name, under a client-minted id: the API creates it under
 * that id, or matches one it holds and remembers the id for it.
 */
export function typedItemRef(
  name: string,
  mintId: () => string = generateEntityId,
): { inline: { id: string; name: string } } {
  return { inline: { id: mintId(), name } };
}

/** The item a line names on the device: a catalog id, or a typed item's minted one. */
export const itemIdOf = (item: SentItemRef): string | undefined =>
  item.itemId ?? item.inline?.id ?? undefined;
