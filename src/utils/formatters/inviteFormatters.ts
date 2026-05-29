import type { Theme } from '#/theme/themes';

type StatusColorTheme = {
  colors: {
    status: Pick<
      Theme['colors']['status'],
      'pending' | 'accepted' | 'declined' | 'expired'
    >;
  };
};

/**
 * Format an invite status from API format to display format
 * @param status - Status in API format (PENDING, ACCEPTED, DECLINED, EXPIRED, REVOKED)
 * @returns Formatted status string (Invited, Accepted, Declined, Expired, Revoked)
 */
export function formatInviteStatus(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'Invited';
    case 'ACCEPTED':
      return 'Accepted';
    case 'DECLINED':
      return 'Declined';
    case 'EXPIRED':
      return 'Expired';
    case 'REVOKED':
      return 'Revoked';
    default:
      return status;
  }
}

/**
 * Get the theme color for an invite status
 * @param status - Status in API format (PENDING, ACCEPTED, DECLINED, EXPIRED, REVOKED)
 * @param theme - Unistyles theme object
 * @returns Color string from theme
 */
export function getInviteStatusColor(
  status: string,
  theme: StatusColorTheme,
): string {
  switch (status) {
    case 'PENDING':
      return theme.colors.status.pending;
    case 'ACCEPTED':
      return theme.colors.status.accepted;
    case 'DECLINED':
      return theme.colors.status.declined;
    case 'EXPIRED':
    case 'REVOKED':
      return theme.colors.status.expired;
    default:
      return theme.colors.status.expired;
  }
}

/**
 * Get display name for an invite
 * Prefers recipientName, falls back to email username, then full email
 * @param invite - Invite object with email and optional recipientName
 * @returns Display name string
 */
export function getInviteDisplayName(invite: {
  recipientName?: string | null;
  email?: string | null;
}): string {
  if (invite.recipientName) return invite.recipientName;
  if (invite.email) {
    const emailParts = invite.email.split('@');
    return emailParts[0] || invite.email;
  }
  return 'Unknown';
}

/**
 * Get badge style object for an invite status
 * @param status - Status in API format (PENDING, ACCEPTED, DECLINED, EXPIRED, REVOKED)
 * @param theme - Unistyles theme object
 * @returns Object with backgroundColor and color for badge
 */
export function getInviteStatusBadgeStyle(
  status: string,
  theme: StatusColorTheme,
) {
  const color = getInviteStatusColor(status, theme);
  return {
    backgroundColor: `${color}20`, // 20 = 12.5% opacity in hex
    color,
  };
}
