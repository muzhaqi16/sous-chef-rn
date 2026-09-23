export const attemptTokenRefresh = jest.fn();
export const getRefreshState = jest.fn(() => ({
  isRefreshing: false,
  refreshPromise: null,
  retryCount: 0,
  lastRefreshTime: 0,
}));
export const clearRefreshState = jest.fn();
export const proactiveTokenRefresh = jest.fn(() => Promise.resolve(null));
export const registerApolloClient = jest.fn();
