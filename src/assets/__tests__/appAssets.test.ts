import { appAssets } from '../appAssets';

describe('appAssets', () => {
  it('logo is a require()-able asset', () => {
    expect(appAssets.logo).toBeTruthy();
  });
});
