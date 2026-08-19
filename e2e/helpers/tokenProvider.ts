/**
 * Token Provider for E2E tests
 *
 * Fetches real auth tokens via direct GraphQL API call,
 * bypassing UI login for faster test bootstrapping.
 * Tokens are cached for 10 minutes to avoid repeated API calls.
 */

import { TEST_USER } from '../fixtures/testData';

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql';
const TOKEN_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
    role: string;
    onBoarded: boolean;
    createdAt: string;
    updatedAt: string;
    timezone: string;
  };
}

/**
 * Long enough for a cold API, far short of jest's 120s hook timeout — the point
 * is that a stalled request fails as itself rather than as an unexplained
 * `beforeAll` stall.
 */
const TOKEN_FETCH_TIMEOUT_MS = 15000;

let cachedTokens: AuthTokens | null = null;
let cacheTimestamp = 0;

/**
 * Fetch auth tokens via GraphQL Login mutation.
 * Returns cached tokens if still valid (< 10 min old).
 */
/**
 * `fetch` with the abort turned into a message that says what happened.
 *
 * Kept separate so the call site stays a flat object literal — wrapping the
 * call in a try/catch inline meant re-indenting the GraphQL template literal,
 * which is easy to get subtly wrong.
 */
/**
 * The API is not accepting connections at all.
 *
 * Distinguished from every other token-fetch failure because it is the one
 * kind the UI-login fallback cannot rescue: UI login posts to this same
 * endpoint. Falling back anyway turns "the API is down" into "login-screen was
 * not visible after 5s" ~50s later, which points at the app instead of at the
 * server that is actually missing.
 */
export class ApiUnreachableError extends Error {
  constructor(endpoint: string, cause: unknown) {
    super(
      `The API at ${endpoint} is not reachable (${cause}).\n` +
        `  Start it before running e2e, and re-check with:\n` +
        `    curl -sS -X POST ${endpoint} -H 'content-type: application/json' ` +
        `-d '{"query":"{ __typename }"}'\n` +
        `  Not falling back to UI login — it posts to this same endpoint, so it ` +
        `would fail too, as a misleading "login-screen not visible" timeout.`,
    );
    this.name = 'ApiUnreachableError';
  }
}

/** Node's undici reports a refused/absent host as `TypeError: fetch failed`. */
function isConnectionFailure(error: unknown): boolean {
  const code = (error as { cause?: { code?: string } })?.cause?.code;
  return (
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'ECONNRESET' ||
    code === 'EHOSTUNREACH' ||
    code === 'UND_ERR_SOCKET'
  );
}

async function fetchWithAbortMessage(
  controller: AbortController,
  abortTimer: ReturnType<typeof setTimeout>,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetch(GRAPHQL_ENDPOINT, init);
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      throw new Error(
        `Token fetch did not respond within ${TOKEN_FETCH_TIMEOUT_MS}ms ` +
          `(${GRAPHQL_ENDPOINT}). The API may be down, or fetch may be stalled ` +
          `inside the Detox runner — the same request usually succeeds from curl.`,
      );
    }
    if (isConnectionFailure(error)) {
      throw new ApiUnreachableError(GRAPHQL_ENDPOINT, error);
    }
    throw error;
  } finally {
    clearTimeout(abortTimer);
  }
}

export async function getAuthTokens(): Promise<AuthTokens> {
  const now = Date.now();

  if (cachedTokens && now - cacheTimestamp < TOKEN_CACHE_TTL_MS) {
    console.log('🔑 Using cached auth tokens');
    return cachedTokens;
  }

  console.log('🔑 Fetching fresh auth tokens via API...');

  // Bounded, because an unbounded request does not fail — it hangs. `fetch`
  // inside Detox's jest runner does not always behave as it does in plain Node
  // (the same query succeeds from curl, and `scripts/verify-comma-decimal.sh`
  // asserts outside the runner for exactly this reason). With no timeout a
  // stalled request runs out jest's 120s HOOK timeout instead, and every test
  // in the file reports as "Exceeded timeout of 120000 ms for a hook" pointing
  // at `beforeAll` — naming the symptom and hiding the cause.
  const controller = new AbortController();
  const abortTimer = setTimeout(
    () => controller.abort(),
    TOKEN_FETCH_TIMEOUT_MS,
  );

  const response = await fetchWithAbortMessage(controller, abortTimer, {
    method: 'POST',
    signal: controller.signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // `login` returns the `LoginResult` union, so the payload fields are only
      // reachable through an inline fragment. Selecting them directly fails
      // validation ("Cannot query field \"accessToken\" on type
      // \"LoginResult\""), token injection throws, and the caller falls back to
      // a slow UI login — which then needs `login-screen` to exist and fails
      // with a misleading timeout.
      query: `
        mutation Login($input: LoginInput!) {
          login(input: $input) {
            __typename
            ... on AuthPayload {
              accessToken
              refreshToken
              user {
                id
                email
                emailVerified
                role
                onBoarded
                createdAt
                updatedAt
                timezone
                # \`setAuth\` flattens these onto the store user. Without them an
                # injected session has no name, so the header greets with the
                # no-name fallback while a real login shows the person's name —
                # a test session that differs from a real one hides exactly the
                # kind of thing e2e exists to catch.
                profile {
                  id
                  displayName
                  avatar
                  firstName
                  lastName
                }
              }
            }
          }
        }
      `,
      variables: {
        input: {
          email: TEST_USER.email,
          password: TEST_USER.password,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Token fetch failed: ${response.status} ${response.statusText}`,
    );
  }

  const json = await response.json();

  if (json.errors) {
    throw new Error(
      `GraphQL login error: ${json.errors.map((e: any) => e.message).join(', ')}`,
    );
  }

  // A refusal (bad credentials, locked account) resolves as a different union
  // member with no `accessToken`, which would otherwise cache `undefined` and
  // fail later as an unauthenticated request rather than a login problem.
  const { __typename, accessToken, refreshToken, user } = json.data.login;
  if (!accessToken) {
    throw new Error(
      `Login returned ${__typename} rather than AuthPayload — no access token. Check the test account (${TEST_USER.email}) exists and is not locked.`,
    );
  }
  cachedTokens = { accessToken, refreshToken, user };
  cacheTimestamp = now;

  console.log('✅ Auth tokens fetched successfully');
  return cachedTokens;
}

/**
 * Clear the token cache. Use when fresh tokens are needed.
 */
export function clearTokenCache(): void {
  cachedTokens = null;
  cacheTimestamp = 0;
}
