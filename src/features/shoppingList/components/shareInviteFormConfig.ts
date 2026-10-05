import { mixed, object, string, type ObjectSchema } from 'yup';
import { CollaboratorRole } from '#/graphql/generated/schemaTypes';
import { isEmailAddress, lazyMessage } from '#utils/validation/common';

export interface ShareInviteFormValues {
  email: string;
  role: CollaboratorRole;
}

export const shareInviteSchema: ObjectSchema<ShareInviteFormValues> = object({
  email: string()
    .trim()
    .required(lazyMessage('labels.pleaseEnterAnEmailAddress'))
    // Shape, not just presence: a typo caught here costs no round trip, and the
    // server's refusal for one is unlocalizable English.
    .test(
      'email',
      lazyMessage('commonValidation.emailInvalid'),
      isEmailAddress,
    ),
  role: mixed<CollaboratorRole>()
    .oneOf(Object.values(CollaboratorRole))
    .required(),
});

export const shareInviteDefaults = (): ShareInviteFormValues => ({
  email: '',
  role: CollaboratorRole.Contributor,
});
