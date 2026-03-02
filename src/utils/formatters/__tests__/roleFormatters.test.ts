import {
  formatRole,
  getRoleDescription,
  getRoleIcon,
  getRoleColor,
  getRoleBadgeStyle,
} from '../roleFormatters';

const mockTheme = {
  colors: {
    roles: {
      owner: '#FFD700',
      admin: '#4169E1',
      member: '#32CD32',
      guest: '#808080',
    },
  },
};

describe('roleFormatters', () => {
  describe('formatRole', () => {
    it.each([
      ['OWNER', 'Owner'],
      ['ADMIN', 'Admin'],
      ['MEMBER', 'Member'],
      ['GUEST', 'Guest'],
    ] as const)('formats %s as %s', (input, expected) => {
      expect(formatRole(input)).toBe(expected);
    });

    it('returns raw role for unknown values', () => {
      expect(formatRole('MODERATOR')).toBe('MODERATOR');
    });
  });

  describe('getRoleDescription', () => {
    it('returns description for OWNER', () => {
      expect(getRoleDescription('OWNER')).toBe('Full control over home and all members');
    });

    it('returns description for ADMIN', () => {
      expect(getRoleDescription('ADMIN')).toBe('Can manage members and settings');
    });

    it('returns description for MEMBER', () => {
      expect(getRoleDescription('MEMBER')).toBe('Can add and edit items in pantry');
    });

    it('returns description for GUEST', () => {
      expect(getRoleDescription('GUEST')).toBe('View-only access to home');
    });

    it('returns empty string for unknown role', () => {
      expect(getRoleDescription('UNKNOWN')).toBe('');
    });
  });

  describe('getRoleIcon', () => {
    it.each([
      ['OWNER', '👑'],
      ['ADMIN', '⚙️'],
      ['MEMBER', '👤'],
      ['GUEST', '👁️'],
    ] as const)('returns %s emoji for %s', (role, icon) => {
      expect(getRoleIcon(role)).toBe(icon);
    });

    it('returns default icon for unknown role', () => {
      expect(getRoleIcon('UNKNOWN')).toBe('👤');
    });
  });

  describe('getRoleColor', () => {
    it('returns correct color for each role', () => {
      expect(getRoleColor('OWNER', mockTheme)).toBe('#FFD700');
      expect(getRoleColor('ADMIN', mockTheme)).toBe('#4169E1');
      expect(getRoleColor('MEMBER', mockTheme)).toBe('#32CD32');
      expect(getRoleColor('GUEST', mockTheme)).toBe('#808080');
    });

    it('returns guest color for unknown role', () => {
      expect(getRoleColor('UNKNOWN', mockTheme)).toBe('#808080');
    });
  });

  describe('getRoleBadgeStyle', () => {
    it('returns color and transparent background', () => {
      const style = getRoleBadgeStyle('OWNER', mockTheme);
      expect(style.color).toBe('#FFD700');
      expect(style.backgroundColor).toBe('#FFD70020');
    });

    it('works for all roles', () => {
      const style = getRoleBadgeStyle('GUEST', mockTheme);
      expect(style.backgroundColor).toBe('#80808020');
      expect(style.color).toBe('#808080');
    });
  });
});
