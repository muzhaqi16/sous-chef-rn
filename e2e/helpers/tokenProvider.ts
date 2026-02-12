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

let cachedTokens: AuthTokens | null = null;
let cacheTimestamp = 0;

/**
 * Fetch auth tokens via GraphQL Login mutation.
 * Returns cached tokens if still valid (< 10 min old).
 */
export async function getAuthTokens(): Promise<AuthTokens> {
  const now = Date.now();

  if (cachedTokens && now - cacheTimestamp < TOKEN_CACHE_TTL_MS) {
    console.log('🔑 Using cached auth tokens');
    return cachedTokens;
  }

  console.log('🔑 Fetching fresh auth tokens via API...');

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        mutation Login($input: LoginInput!) {
          login(input: $input) {
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

  const { accessToken, refreshToken, user } = json.data.login;
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
