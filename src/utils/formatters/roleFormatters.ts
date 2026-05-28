import { t } from '#/i18n/t';

/**
 * Format a role string from API format to display format
 * @param role - Role in API format (OWNER, ADMIN, MEMBER, GUEST)
 * @returns Translated role label
 */
export function formatRole(role: string): string {
  switch (role) {
    case 'OWNER':
      return t('roles.owner');
    case 'ADMIN':
      return t('roles.admin');
    case 'MEMBER':
      return t('roles.member');
    case 'GUEST':
      return t('roles.guest');
    default:
      return role;
  }
}

/**
 * Get description for a role
 * @param role - Role in API format (OWNER, ADMIN, MEMBER, GUEST)
 * @returns Description of role permissions
 */
export function getRoleDescription(role: string): string {
  switch (role) {
    case 'OWNER':
      return 'Full control over home and all members';
    case 'ADMIN':
      return 'Can manage members and settings';
    case 'MEMBER':
      return 'Can add and edit items in pantry';
    case 'GUEST':
      return 'View-only access to home';
    default:
      return '';
  }
}

/**
 * Get icon emoji for a role
 * @param role - Role in API format (OWNER, ADMIN, MEMBER, GUEST)
 * @returns Icon emoji for role
 */
export function getRoleIcon(role: string): string {
  switch (role) {
    case 'OWNER':
      return '👑';
    case 'ADMIN':
      return '⚙️';
    case 'MEMBER':
      return '👤';
    case 'GUEST':
      return '👁️';
    default:
      return '👤';
  }
}

/**
 * Get the theme color for a role
 * @param role - Role in API format (OWNER, ADMIN, MEMBER, GUEST)
 * @param theme - Unistyles theme object
 * @returns Color string from theme
 */
export function getRoleColor(role: string, theme: any): string {
  switch (role) {
    case 'OWNER':
      return theme.colors.roles.owner;
    case 'ADMIN':
      return theme.colors.roles.admin;
    case 'MEMBER':
      return theme.colors.roles.member;
    case 'GUEST':
      return theme.colors.roles.guest;
    default:
      return theme.colors.roles.guest;
  }
}

/**
 * Get badge style object for a role
 * @param role - Role in API format (OWNER, ADMIN, MEMBER, GUEST)
 * @param theme - Unistyles theme object
 * @returns Object with backgroundColor and color for badge
 */
export function getRoleBadgeStyle(role: string, theme: any) {
  const color = getRoleColor(role, theme);
  return {
    backgroundColor: `${color}20`, // 20 = 12.5% opacity in hex
    color,
  };
}
