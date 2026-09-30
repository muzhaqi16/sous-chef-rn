import { useFragment } from '@apollo/client/react';
import type { TypedDocumentNode } from '@apollo/client';
import type { MissingTree } from '@apollo/client/cache';
import type { MaybeMasked } from '@apollo/client/masking';

interface FragmentListOptions<TData> {
  fragment: TypedDocumentNode<TData>;
  fragmentName: string;
  /** Masked refs, or `{ __typename, id }` cache keys. */
  from: ReadonlyArray<useFragment.FromOptionValue<TData>>;
}

/**
 * Apollo reports a partial array read as one `complete: false` plus a missing
 * tree keyed by entry index; an entry with no branch there read completely.
 */
function readCompletely<TData>(
  _entry: unknown,
  missing: MissingTree | undefined,
  index: number,
): _entry is MaybeMasked<TData> {
  return typeof missing === 'object' && !(String(index) in missing);
}

/**
 * Each entry's fragment, live: re-renders when any entry's own fields change,
 * which a list read off a masked query result does not. One entry per `from`,
 * `null` where it is not completely cached — a list cell's strict rule, left to
 * the caller to count rather than drop.
 */
export function useFragmentList<TData>({
  fragment,
  fragmentName,
  from,
}: FragmentListOptions<TData>): Array<MaybeMasked<TData> | null> {
  const result = useFragment({ fragment, fragmentName, from: [...from] });
  if (result.complete) return result.data;
  const { missing } = result;
  return result.data.map((entry, index) =>
    readCompletely<TData>(entry, missing, index) ? entry : null,
  );
}
