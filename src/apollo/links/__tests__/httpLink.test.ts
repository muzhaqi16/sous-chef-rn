import { ApolloClient, ApolloLink, InMemoryCache, gql } from '@apollo/client';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { NetworkRequestError } from '#/utils/errors/networkRequestError';
import { isNetworkError } from '#/utils/isNetworkError';
import { httpLink } from '../httpLink';

const client = new ApolloClient({
  cache: new InMemoryCache(),
  link: ApolloLink.empty(),
  defaultOptions: APOLLO_DEFAULT_OPTIONS,
});

const errorFrom = (rejection: unknown) => {
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(rejection);
  return new Promise<unknown>(resolve => {
    ApolloLink.execute(
      httpLink,
      {
        query: gql`
          query Probe {
            probe
          }
        `,
      },
      { client },
    ).subscribe({ error: resolve });
  });
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('httpLink fetch boundary', () => {
  // whatwg-fetch's contract for a request that got no response.
  it('turns a fetch TypeError into a network failure', async () => {
    const error = await errorFrom(new TypeError('Network request failed'));

    expect(error).toBeInstanceOf(NetworkRequestError);
    expect(isNetworkError(error)).toBe(true);
  });

  it('leaves any other rejection as it was', async () => {
    const rejection = new RangeError('not a network failure');
    const error = await errorFrom(rejection);

    expect(error).toBe(rejection);
    expect(isNetworkError(error)).toBe(false);
  });
});
