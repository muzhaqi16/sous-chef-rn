import { buildJoinHomeUrl, buildJoinListUrl } from '../deepLinkUrls';

// appConfig host: app.souschef.dev (src/config/appConfig.ts)
const BASE = 'https://app.souschef.dev';

describe('deep-link URL builders', () => {
  it('builds a join-home URL', () => {
    expect(buildJoinHomeUrl('ABC123')).toBe(`${BASE}/join-home/ABC123`);
  });

  it('builds a join-list URL', () => {
    expect(buildJoinListUrl('XYZ789')).toBe(`${BASE}/join-list/XYZ789`);
  });

  it('percent-encodes codes that contain URL-unsafe characters', () => {
    expect(buildJoinHomeUrl('a b/c')).toBe(`${BASE}/join-home/a%20b%2Fc`);
  });
});
