import { MembershipRole } from '#/graphql/generated/schemaTypes';
import { t } from '#/i18n';

export function formatRole(role: MembershipRole): string {
  switch (role) {
    case MembershipRole.Owner:
      return t('roles.owner');
    case MembershipRole.Admin:
      return t('labels.admin');
    case MembershipRole.Member:
      return t('roles.member');
    case MembershipRole.Guest:
      return t('labels.guest');
  }
}
