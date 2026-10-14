import { MembershipRole } from '#/graphql/generated/schemaTypes';
import { formatRole } from '../roleFormatters';
import { t } from '#/i18n';

describe('roleFormatters', () => {
  describe('formatRole', () => {
    it.each([
      [MembershipRole.Owner, 'Owner'],
      [MembershipRole.Admin, 'Admin'],
      [MembershipRole.Member, 'Member'],
      [MembershipRole.Guest, 'Guest'],
    ])('formats %s as %s', (input, expected) => {
      expect(formatRole(input, t)).toBe(expected);
    });
  });
});
