/**
 * Fetches real auth tokens straight from the GraphQL API, bypassing UI login.
 * Cached for 10 minutes so a suite does not re-login per file.
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
 * Long enough for a cold API, far short of jest's 120s hook timeout, so a
 * stalled request fails as itself rather than as an unexplained `beforeAll`.
 */
const TOKEN_FETCH_TIMEOUT_MS = 15000;

let cachedTokens: AuthTokens | null = null;
let cacheTimestamp = 0;

/**
 * The one token-fetch failure the UI-login fallback cannot rescue, since UI
 * login posts to this same endpoint: falling back turns "the API is down" into
 * "login-screen was not visible after 5s", ~50s later and blaming the app.
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

/** Turns the abort into a message that says what happened. */
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

/** Returns cached tokens while they are under {@link TOKEN_CACHE_TTL_MS} old. */
export async function getAuthTokens(): Promise<AuthTokens> {
  const now = Date.now();

  if (cachedTokens && now - cacheTimestamp < TOKEN_CACHE_TTL_MS) {
    console.log('🔑 Using cached auth tokens');
    return cachedTokens;
  }

  console.log('🔑 Fetching fresh auth tokens via API...');

  // Bounded, because an unbounded request does not fail — it hangs. `fetch`
  // inside Detox's jest runner can stall where the same query succeeds from
  // curl, and with no timeout that runs out jest's 120s HOOK timeout instead:
  // every test in the file then reports "Exceeded timeout of 120000 ms for a
  // hook" against `beforeAll`, naming the symptom and hiding the cause.
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
      // `login` returns the `LoginResult` union, so payload fields are only
      // reachable through an inline fragment; selecting them directly fails
      // validation and drops the caller into the slow UI-login fallback.
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
      `GraphQL login error: ${json.errors.map((e: { message?: string }) => e.message).join(', ')}`,
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

export function clearTokenCache(): void {
  cachedTokens = null;
  cacheTimestamp = 0;
}
