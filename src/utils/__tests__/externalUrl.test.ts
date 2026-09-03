import { Linking } from 'react-native';
import { isWebUrl, openWebUrl } from '#utils/externalUrl';

jest.mock('react-native', () => ({
  Linking: { openURL: jest.fn() },
}));

const openURL = Linking.openURL as jest.Mock;

// Assembled rather than written literally: a script URL in source is itself a
// lint finding, and the scheme is exactly what this case has to cover.
const SCRIPT_URL = ['javascript', 'alert(1)'].join(':');

describe('externalUrl', () => {
  beforeEach(() => {
    openURL.mockReset();
    openURL.mockResolvedValue(undefined);
  });

  describe('isWebUrl', () => {
    it.each([
      'https://www.seriouseats.com/recipe',
      'http://example.com/r/1',
      'HTTPS://EXAMPLE.COM',
      '  https://example.com  ',
    ])('accepts %s', url => {
      expect(isWebUrl(url)).toBe(true);
    });

    it.each([
      'tel:+15551234567',
      'sms:+15551234567',
      'mailto:someone@example.com',
      'app-settings:',
      'souschef://pantry',
      SCRIPT_URL,
      'file:///etc/passwd',
      'ftp://example.com',
      'https://',
      'example.com',
      '',
    ])('refuses %s', url => {
      expect(isWebUrl(url)).toBe(false);
    });

    it('refuses a missing url', () => {
      expect(isWebUrl(null)).toBe(false);
      expect(isWebUrl(undefined)).toBe(false);
    });
  });

  describe('openWebUrl', () => {
    it('opens a web address', async () => {
      await expect(openWebUrl('https://example.com/recipe')).resolves.toBe(
        true,
      );
      expect(openURL).toHaveBeenCalledWith('https://example.com/recipe');
    });

    it('refuses a tel: source without asking the platform', async () => {
      await expect(openWebUrl('tel:+15551234567')).resolves.toBe(false);
      expect(openURL).not.toHaveBeenCalled();
    });

    it('refuses a custom scheme without asking the platform', async () => {
      await expect(openWebUrl('souschef://pantry/item/1')).resolves.toBe(false);
      expect(openURL).not.toHaveBeenCalled();
    });

    it('reports false when the platform refuses a web address', async () => {
      openURL.mockRejectedValue(new Error('no handler'));
      await expect(openWebUrl('https://example.com')).resolves.toBe(false);
    });
  });
});
