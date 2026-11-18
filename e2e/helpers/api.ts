import { GRAPHQL_ENDPOINT, getAuthTokens } from './tokenProvider';

/** Bounded, as the token fetch is: a stalled request fails as itself. */
const REQUEST_TIMEOUT_MS = 15000;

/**
 * Runs an operation against the dev API as the e2e test user, for setup and
 * for reading back what a flow persisted. Throws on any GraphQL error or a
 * missing `data`; a mutation's typed `Error` result is `payloadOf`'s to throw.
 */
export async function asTestUser<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const { accessToken } = await getAuthTokens();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query, variables }),
    });
    const json = (await response.json()) as {
      data?: T;
      errors?: unknown[];
    };
    if (json.errors?.length || !json.data) {
      throw new Error(
        `API refused setup: ${JSON.stringify(json.errors).slice(0, 500)}`,
      );
    }
    return json.data;
  } finally {
    clearTimeout(timer);
  }
}

/** A mutation's union result, narrowed to its payload or thrown as its error. */
export function payloadOf<T extends { __typename: string }>(
  result: T,
  payload: string,
): T {
  if (result.__typename !== payload) {
    throw new Error(`Expected ${payload}, got ${JSON.stringify(result)}`);
  }
  return result;
}
