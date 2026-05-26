/**
 * Typed error classes for GraphQL mutation payload discrimination.
 *
 * unwrapPayload() throws these instead of generic Error so callers and
 * error boundaries can distinguish transport failures (GraphQLNetworkError)
 * from server-rejected domain errors (GraphQLDomainError).
 */

export class GraphQLDomainError extends Error {
  override readonly name = 'GraphQLDomainError';
  readonly __typename: string;
  readonly code: string;
  readonly payload: Record<string, unknown>;

  constructor(payload: {
    __typename: string;
    code: string;
    message: string;
    [k: string]: unknown;
  }) {
    super(payload.message);
    this.__typename = payload.__typename;
    this.code = payload.code;
    this.payload = payload;
  }
}

export class GraphQLNetworkError extends Error {
  override readonly name = 'GraphQLNetworkError';

  constructor(fallbackMessage: string) {
    super(fallbackMessage);
  }
}
