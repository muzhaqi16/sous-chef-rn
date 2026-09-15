import { InviteStatus } from '#/graphql/generated/schemaTypes';
import {
  formatInviteStatus,
  getInviteDisplayName,
  getInviteStatusKey,
} from '#features/home/utils/inviteFormatters';
import { getI18n } from '#/i18n/config';

// The real instance, so the assertions read the copy in en.json.
const t = getI18n().t;

describe('inviteFormatters', () => {
  describe('formatInviteStatus', () => {
    it.each([
      [InviteStatus.Pending, 'Invited'],
      [InviteStatus.Accepted, 'Accepted'],
      [InviteStatus.Declined, 'Declined'],
      [InviteStatus.Expired, 'Expired'],
      [InviteStatus.Revoked, 'Revoked'],
      [InviteStatus.Used, 'Used'],
    ])('formats %s as %s', (input, expected) => {
      expect(formatInviteStatus(input, t)).toBe(expected);
    });
  });

  describe('getInviteStatusKey', () => {
    it.each([
      [InviteStatus.Pending, 'pending'],
      [InviteStatus.Accepted, 'accepted'],
      [InviteStatus.Declined, 'declined'],
      [InviteStatus.Expired, 'expired'],
      [InviteStatus.Revoked, 'expired'],
      [InviteStatus.Used, 'expired'],
    ])('draws %s in the %s tone', (input, expected) => {
      expect(getInviteStatusKey(input)).toBe(expected);
    });
  });

  describe('getInviteDisplayName', () => {
    it('prefers recipientName', () => {
      expect(
        getInviteDisplayName({ recipientName: 'Alice', email: 'a@b.com' }, t),
      ).toBe('Alice');
    });

    it('falls back to email username', () => {
      expect(getInviteDisplayName({ email: 'alice@example.com' }, t)).toBe(
        'alice',
      );
    });

    it('falls back to full email when username is empty', () => {
      expect(getInviteDisplayName({ email: '@bad' }, t)).toBe('@bad');
    });

    it('returns Unknown when no data available', () => {
      expect(getInviteDisplayName({}, t)).toBe('Unknown');
    });

    it('returns Unknown for null values', () => {
      expect(
        getInviteDisplayName({ recipientName: null, email: null }, t),
      ).toBe('Unknown');
    });
  });
});
