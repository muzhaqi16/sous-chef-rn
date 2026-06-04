import { extractNodes, getConnectionTotalCount } from '#/utils/connectionUtils';
import { usePreservedQueryData } from '#hooks/apollo/usePreservedQueryData';
import type {
  ConnectionResult,
  NodeOfConnection,
} from '#hooks/utils/useConnectionData';

export interface PreservedConnection<TNode> {
  /** Flattened nodes, preserved across error-driven `undefined` connections. */
  nodes: TNode[];
  /** Total count from the (preserved) connection; `undefined` before any data. */
  totalCount: number | undefined;
  /** PageInfo from the (preserved) connection; `undefined` before any data. */
  pageInfo: ConnectionResult['pageInfo'] | undefined;
}

/**
 * Preserve a relay-style connection across error-driven `undefined` transitions,
 * THEN derive `nodes` / `totalCount` / `pageInfo`.
 *
 * **Why this exists — an ORDERING defect.** With `errorPolicy: 'ignore'`, a
 * transient network failure (or any failed refetch) surfaces `data === undefined`
 * even though the persisted cache still holds the items. The previous pattern
 * `usePreservedArrayData(extractNodes(conn))` flattened that `undefined → []`
 * *before* preservation ran, so the "no data" signal was already gone and the
 * list silently wiped — while every other preserved field (e.g. `stats`)
 * survived. Preserving the connection OBJECT first keeps the undefined-vs-defined
 * signal intact. A genuinely empty list (a DEFINED `{ edges: [] }`, e.g. the last
 * item deleted) still flows through and clears correctly.
 *
 * **Apollo-validated.** Apollo's guidance is to preserve at the raw
 * data/connection level (`data ?? previousData`) rather than after a transform.
 * We use the value-keyed {@link usePreservedQueryData} instead of `previousData`
 * because `previousData` is not variable-scoped — it would briefly show a
 * previous filter/sort's list after a variable change. The flatten itself
 * (edges → nodes) is necessary and standard: relay connections require it and
 * Apollo does not auto-flatten; only its ORDER relative to preservation was wrong.
 */
export function usePreservedConnection<C extends ConnectionResult>(
  connection: C | null | undefined,
): PreservedConnection<NodeOfConnection<C>> {
  const preserved = usePreservedQueryData<C | undefined>(
    connection ?? undefined,
    undefined,
  );
  return {
    nodes: extractNodes(preserved) as NodeOfConnection<C>[],
    totalCount: preserved ? getConnectionTotalCount(preserved) : undefined,
    pageInfo: preserved?.pageInfo,
  };
}

/** Loose connection shape — only the `edges`/`node` that `extractNodes` reads. */
type EdgesConnection<TNode> = {
  edges?: Array<{ node?: TNode | null } | null> | null;
};

/**
 * Preservation-safe node extraction. Drop-in replacement for the buggy
 * `usePreservedArrayData(extractNodes(connection))` pattern: preserves the
 * connection across error-driven `undefined` (see {@link usePreservedConnection})
 * BEFORE flattening to nodes. Uses a looser `edges`-only constraint than
 * {@link usePreservedConnection} so it also covers list queries that don't
 * select `pageInfo` / `totalCount`.
 */
export function usePreservedNodes<TNode>(
  connection: EdgesConnection<TNode> | null | undefined,
): TNode[] {
  const preserved = usePreservedQueryData<EdgesConnection<TNode> | undefined>(
    connection ?? undefined,
    undefined,
  );
  return extractNodes<TNode>(preserved);
}
