import { appConfig } from '../appConfig';

describe('appConfig', () => {
  it('matches app.json identity', () => {
    const appJson = require('../../../app.json');
    expect(appConfig.identity.name).toBe(appJson.name);
    expect(appConfig.identity.displayName).toBe(appJson.displayName);
  });

  it('exposes a deep-link scheme without trailing separators', () => {
    expect(appConfig.identity.deepLink.scheme).not.toContain(':');
    expect(appConfig.identity.deepLink.scheme).not.toContain('/');
  });

  it('exposes deep-link hosts without protocol', () => {
    for (const host of appConfig.identity.deepLink.hosts) {
      expect(host).not.toMatch(/^https?:\/\//);
    }
  });

  it('webAppUrl uses https', () => {
    expect(appConfig.identity.webAppUrl).toMatch(/^https:\/\//);
  });

  it('primaryColor is a hex value', () => {
    expect(appConfig.branding.primaryColor).toMatch(/^#[0-9a-fA-F]{3,8}$/);
  });

  it('logo is a require()-able asset', () => {
    expect(appConfig.assets.logo).toBeTruthy();
  });
});
