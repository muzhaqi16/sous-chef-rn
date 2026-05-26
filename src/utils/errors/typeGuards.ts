type GraphQLResult = { __typename: string };

export function isType<R extends GraphQLResult, T extends R['__typename']>(
  result: R | null | undefined,
  typename: T,
): result is Extract<R, { __typename: T }> {
  return result?.__typename === typename;
}

export function isEither<R extends GraphQLResult, T extends R['__typename']>(
  result: R | null | undefined,
  typenames: readonly T[],
): result is Extract<R, { __typename: T }> {
  return (
    result != null &&
    (typenames as readonly string[]).includes(result.__typename)
  );
}
