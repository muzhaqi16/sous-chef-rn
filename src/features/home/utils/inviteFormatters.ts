import { InviteStatus } from '#/graphql/generated/schemaTypes';
import type { Translate } from '#/i18n/types';

/** The `theme.colors.status` tone an invite status is drawn in. */
export type InviteStatusKey = 'pending' | 'accepted' | 'declined' | 'expired';

export function getInviteStatusKey(status: InviteStatus): InviteStatusKey {
  switch (status) {
    case InviteStatus.Pending:
      return 'pending';
    case InviteStatus.Accepted:
      return 'accepted';
    case InviteStatus.Declined:
      return 'declined';
    case InviteStatus.Expired:
    case InviteStatus.Revoked:
    case InviteStatus.Used:
      return 'expired';
  }
}

export function formatInviteStatus(status: InviteStatus, t: Translate): string {
  return t(`inviteStatus.${status}`);
}

/** The recipient's name, else the email's local part, else the whole email. */
export function getInviteDisplayName(
  invite: {
    recipientName?: string | null;
    email?: string | null;
  },
  t: Translate,
): string {
  if (invite.recipientName) return invite.recipientName;
  if (invite.email) {
    const emailParts = invite.email.split('@');
    return emailParts[0] || invite.email;
  }
  return t('labels.unknown');
}
