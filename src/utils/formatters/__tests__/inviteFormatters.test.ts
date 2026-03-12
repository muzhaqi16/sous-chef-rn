import {
  formatInviteStatus,
  getInviteStatusColor,
  getInviteDisplayName,
  getInviteStatusBadgeStyle,
} from '../inviteFormatters';

const mockTheme = {
  colors: {
    status: {
      pending: '#FFA500',
      accepted: '#4CAF50',
      declined: '#F44336',
      expired: '#9E9E9E',
    },
  },
};

describe('inviteFormatters', () => {
  describe('formatInviteStatus', () => {
    it.each([
      ['PENDING', 'Invited'],
      ['ACCEPTED', 'Accepted'],
      ['DECLINED', 'Declined'],
      ['EXPIRED', 'Expired'],
      ['REVOKED', 'Revoked'],
    ])('formats %s as %s', (input, expected) => {
      expect(formatInviteStatus(input)).toBe(expected);
    });

    it('returns raw status for unknown values', () => {
      expect(formatInviteStatus('CUSTOM')).toBe('CUSTOM');
    });
  });

  describe('getInviteStatusColor', () => {
    it('returns pending color', () => {
      expect(getInviteStatusColor('PENDING', mockTheme)).toBe('#FFA500');
    });

    it('returns accepted color', () => {
      expect(getInviteStatusColor('ACCEPTED', mockTheme)).toBe('#4CAF50');
    });

    it('returns declined color', () => {
      expect(getInviteStatusColor('DECLINED', mockTheme)).toBe('#F44336');
    });

    it('returns expired color for EXPIRED', () => {
      expect(getInviteStatusColor('EXPIRED', mockTheme)).toBe('#9E9E9E');
    });

    it('returns expired color for REVOKED', () => {
      expect(getInviteStatusColor('REVOKED', mockTheme)).toBe('#9E9E9E');
    });

    it('returns expired color for unknown status', () => {
      expect(getInviteStatusColor('UNKNOWN', mockTheme)).toBe('#9E9E9E');
    });
  });

  describe('getInviteDisplayName', () => {
    it('prefers recipientName', () => {
      expect(getInviteDisplayName({ recipientName: 'Alice', email: 'a@b.com' })).toBe('Alice');
    });

    it('falls back to email username', () => {
      expect(getInviteDisplayName({ email: 'alice@example.com' })).toBe('alice');
    });

    it('falls back to full email when username is empty', () => {
      expect(getInviteDisplayName({ email: '@bad' })).toBe('@bad');
    });

    it('returns Unknown when no data available', () => {
      expect(getInviteDisplayName({})).toBe('Unknown');
    });

    it('returns Unknown for null values', () => {
      expect(getInviteDisplayName({ recipientName: null, email: null })).toBe('Unknown');
    });
  });

  describe('getInviteStatusBadgeStyle', () => {
    it('returns color and transparent background', () => {
      const style = getInviteStatusBadgeStyle('PENDING', mockTheme);
      expect(style.color).toBe('#FFA500');
      expect(style.backgroundColor).toBe('#FFA50020');
    });

    it('applies 20 hex suffix for background', () => {
      const style = getInviteStatusBadgeStyle('ACCEPTED', mockTheme);
      expect(style.backgroundColor).toBe('#4CAF5020');
    });
  });
});
