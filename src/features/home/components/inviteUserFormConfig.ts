import { object, mixed } from 'yup';
import { emailRule } from '#utils/validation/common';
import { MembershipRole } from '#/graphql/generated/schemaTypes';

export interface InviteUserFormValues {
  email: string;
  role: MembershipRole;
}

/**
 * The invite form's rules. `emailRule` rather than a local regex: it carries the
 * same messages every other email field shows, resolved lazily so a language
 * change reaches them.
 */
export const inviteUserSchema = object({
  email: emailRule,
  role: mixed<MembershipRole>().oneOf(Object.values(MembershipRole)).required(),
});
