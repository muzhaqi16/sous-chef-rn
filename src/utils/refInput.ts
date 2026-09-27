import { firstNonBlank } from '#/utils/firstNonBlank';

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
