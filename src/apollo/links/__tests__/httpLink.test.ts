import { ApolloClient, ApolloLink, InMemoryCache, gql } from '@apollo/client';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { NetworkRequestError } from '#/utils/errors/networkRequestError';
import { isNetworkError } from '#/utils/isNetworkError';
import { requirePlatform } from '#platform/install';
import { DeviceType } from '#/graphql/generated/schemaTypes';
import { createHttpLink } from '../httpLink';

const httpLink = createHttpLink();

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

// The API records each sign-in's source and device type from these, and a
// device it has not seen takes its type from them.
describe('what every request says about the device', () => {
  const sentHeaders = async (link: ApolloLink) => {
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new TypeError('offline'));
    await new Promise<unknown>(resolve => {
      ApolloLink.execute(
        link,
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
    return fetch.mock.calls[0]?.[1]?.headers;
  };

  it.each([
    { device: 'a phone', isTablet: false, type: DeviceType.Mobile },
    { device: 'a tablet', isTablet: true, type: DeviceType.Tablet },
  ])('names the mobile app, on $device', async ({ isTablet, type }) => {
    jest.replaceProperty(requirePlatform('platformInfo'), 'isTablet', isTablet);

    expect(await sentHeaders(createHttpLink())).toMatchObject({
      'x-client-source': 'mobile',
      'x-device-type': type,
    });
  });

  // A web host knows no phone or tablet: the API records the type as unknown.
  it('names the web app, and no device type, from a browser', async () => {
    jest.replaceProperty(requirePlatform('platformInfo'), 'os', 'web');

    const headers = await sentHeaders(createHttpLink());

    expect(headers).toMatchObject({ 'x-client-source': 'web' });
    expect(headers).not.toHaveProperty('x-device-type');
  });
});
