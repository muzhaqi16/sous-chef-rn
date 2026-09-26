import { mixed, object, string, type ObjectSchema } from 'yup';
import { t, type TranslationKey } from '#/i18n';
import { CollaboratorRole } from '#/graphql/generated/schemaTypes';
import { isEmailAddress } from '#utils/validation/common';

// Messages resolve LAZILY: the schema is built once at module scope, so an
// eagerly resolved one freezes whichever language was active at import time.
const msg = (key: TranslationKey) => (): string => t(key);

export interface ShareInviteFormValues {
  email: string;
  role: CollaboratorRole;
}

export const shareInviteSchema: ObjectSchema<ShareInviteFormValues> = object({
  email: string()
    .trim()
    .required(msg('labels.pleaseEnterAnEmailAddress'))
    // Shape, not just presence: a typo caught here costs no round trip, and the
    // server's refusal for one is unlocalizable English.
    .test('email', msg('commonValidation.emailInvalid'), isEmailAddress),
  role: mixed<CollaboratorRole>()
    .oneOf(Object.values(CollaboratorRole))
    .required(),
});

export const shareInviteDefaults = (): ShareInviteFormValues => ({
  email: '',
  role: CollaboratorRole.Contributor,
});
