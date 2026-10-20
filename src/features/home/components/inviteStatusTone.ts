import { InviteStatus } from '#/graphql/generated/schemaTypes';
import type { TextTone } from '#components/atoms/Text';

export const INVITE_STATUS_TONE: Record<InviteStatus, TextTone> = {
  [InviteStatus.Pending]: 'warning',
  [InviteStatus.Accepted]: 'success',
  [InviteStatus.Declined]: 'danger',
  [InviteStatus.Expired]: 'tertiary',
  [InviteStatus.Revoked]: 'tertiary',
  [InviteStatus.Used]: 'tertiary',
};
