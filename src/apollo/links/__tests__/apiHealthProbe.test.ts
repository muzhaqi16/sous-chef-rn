import { Environment } from '#/utils/environment';
import { getHealthUrl } from '../apiHealthProbe';

const mockedGetApiConfig = Environment.getApiConfig as jest.Mock;

describe('getHealthUrl', () => {
  it.each([
    ['https://api.souschef.dev/graphql', 'https://api.souschef.dev/health'],
    ['https://api.souschef.dev/graphql/', 'https://api.souschef.dev/health'],
    ['http://localhost:4000/graphql', 'http://localhost:4000/health'],
    [
      'https://staging-api.souschef.dev/graphql',
      'https://staging-api.souschef.dev/health',
    ],
  ])('derives %s → %s', (baseUrl, expected) => {
    mockedGetApiConfig.mockReturnValue({ baseUrl });
    expect(getHealthUrl()).toBe(expected);
  });
});
