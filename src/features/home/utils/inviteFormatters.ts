import { InviteStatus } from '#/graphql/generated/schemaTypes';
import type { Translate } from '#/i18n/types';
import type { TextTone } from '#components/atoms/Text';
import { firstNonBlank } from '#/utils/firstNonBlank';

/** The `theme.colors.status` key an invite's border and badge fill are drawn in. */
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

export const INVITE_STATUS_TONE: Record<InviteStatus, TextTone> = {
  [InviteStatus.Pending]: 'warning',
  [InviteStatus.Accepted]: 'success',
  [InviteStatus.Declined]: 'danger',
  [InviteStatus.Expired]: 'tertiary',
  [InviteStatus.Revoked]: 'tertiary',
  [InviteStatus.Used]: 'tertiary',
};

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
  return (
    firstNonBlank(
      invite.recipientName,
      invite.email?.split('@')[0],
      invite.email,
    ) ?? t('labels.unknown')
  );
}
