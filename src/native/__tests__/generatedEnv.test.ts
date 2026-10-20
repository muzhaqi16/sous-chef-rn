jest.mock('#/config/env.generated', () => ({
  RAW_ENV: {
    API_URL: '',
    WEB_SOCKET_URL: 'ws://localhost:4000/graphql',
    BUILD_ID: undefined,
  },
}));

import { generatedEnv } from '../generatedEnv';

describe('generatedEnv', () => {
  it('reads a blank `KEY=` line as unset, so a consumer falls back', () => {
    expect(generatedEnv.API_URL).toBeUndefined();
    expect('API_URL' in generatedEnv).toBe(false);
  });

  it('keeps every value that has text', () => {
    expect(generatedEnv.WEB_SOCKET_URL).toBe('ws://localhost:4000/graphql');
  });
});
