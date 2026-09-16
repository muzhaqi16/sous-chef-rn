jest.mock('../env.generated', () => ({
  RAW_ENV: {
    API_URL: '',
    WEB_SOCKET_URL: 'ws://localhost:4000/graphql',
    BUILD_ID: undefined,
  },
}));

import { env } from '../env';

describe('env', () => {
  it('reads a blank `KEY=` line as unset, so a consumer falls back', () => {
    expect(env.API_URL).toBeUndefined();
    expect('API_URL' in env).toBe(false);
  });

  it('keeps every value that has text', () => {
    expect(env.WEB_SOCKET_URL).toBe('ws://localhost:4000/graphql');
  });
});
