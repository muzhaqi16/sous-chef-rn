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
 * ORDER IS THE POINT: preserve the connection OBJECT, THEN flatten. Flattening
 * first turns an error-driven `undefined` into `[]` and the list wipes; a
 * DEFINED `{ edges: [] }` still clears correctly. Scoped by `key`, the subject
 * the connection was loaded for, so a switch never re-serves the previous
 * subject's list — unlike Apollo's `previousData`, which is not variable-scoped.
 */
export function usePreservedConnection<C extends ConnectionResult>(
  connection: C | null | undefined,
  key: string,
): PreservedConnection<NodeOfConnection<C>> {
  const preserved = usePreservedQueryData<C | undefined>(
    connection ?? undefined,
    undefined,
    key,
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
 * Node extraction that preserves before flattening (see
 * {@link usePreservedConnection}). Looser `edges`-only constraint, so it covers
 * list queries that don't select `pageInfo` / `totalCount`.
 */
export function usePreservedNodes<TNode>(
  connection: EdgesConnection<TNode> | null | undefined,
  key: string,
): TNode[] {
  const preserved = usePreservedQueryData<EdgesConnection<TNode> | undefined>(
    connection ?? undefined,
    undefined,
    key,
  );
  return extractNodes<TNode>(preserved);
}
