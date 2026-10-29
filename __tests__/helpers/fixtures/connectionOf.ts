interface Page {
  totalCount?: number;
  hasNextPage?: boolean;
  endCursor?: string | null;
}

interface TypedConnection<Type extends string, Node> {
  __typename: `${Type}Connection`;
  totalCount: number;
  pageInfo: {
    __typename: 'PageInfo';
    hasNextPage: boolean;
    endCursor: string | null;
  };
  edges: { __typename: `${Type}Edge`; node: Node }[];
}

/** One page of `nodes`, for a mock whose `__typename`s the SDL completion fills. */
export const connectionOf = <Node>(
  nodes: readonly Node[],
  {
    totalCount = nodes.length,
    hasNextPage = false,
    endCursor = null,
  }: Page = {},
) => ({
  totalCount,
  pageInfo: { hasNextPage, endCursor },
  edges: nodes.map(node => ({ node })),
});

/** `connectionOf` with every `__typename`, for `cache.writeQuery`. */
export const typedConnectionOf = <Type extends string, Node>(
  type: Type,
  nodes: readonly Node[],
  page: Page = {},
): TypedConnection<Type, Node> => {
  const { totalCount, pageInfo, edges } = connectionOf(nodes, page);
  return {
    __typename: `${type}Connection`,
    totalCount,
    pageInfo: { __typename: 'PageInfo', ...pageInfo },
    edges: edges.map(edge => ({ __typename: `${type}Edge`, ...edge })),
  };
};
