import { MembershipRole } from '#/graphql/generated/schemaTypes';
import type { Translate } from '#/i18n/types';
import { unknownMember } from '#/utils/closedEnum';

export function formatRole(role: MembershipRole, translate: Translate): string {
  switch (role) {
    case MembershipRole.Owner:
      return translate('roles.owner');
    case MembershipRole.Admin:
      return translate('labels.admin');
    case MembershipRole.Member:
      return translate('roles.member');
    case MembershipRole.Guest:
      return translate('labels.guest');
    default:
      unknownMember(role, 'membership role');
      return translate('roles.member');
  }
}
