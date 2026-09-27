import { object, string, type ObjectSchema } from 'yup';
import { t, type TranslationKey } from '#/i18n';
import { isEmailAddress } from '#utils/validation/common';

// Messages resolve LAZILY: the schema is built once at module scope, so an
// eagerly resolved one freezes whichever language was active at import time.
const msg = (key: TranslationKey) => (): string => t(key);

export interface InviteEmailFormValues {
  email: string;
}

export interface InviteEmailContext {
  /** Addresses already staged on the screen. */
  existing: string[];
  /** The signed-in account, which cannot invite itself. */
  ownEmail: string | null | undefined;
}

export const normalizeInviteEmail = (raw: string): string =>
  raw.trim().toLowerCase();

/**
 * Every refusal lands on `email`, which is the only field: a bad address, one
 * already on the list, and the person's own address each get their own
 * sentence under the input rather than three differently-titled alerts.
 */
export const inviteEmailSchema = (
  context: InviteEmailContext,
): ObjectSchema<InviteEmailFormValues> =>
  object({
    email: string()
      .transform(normalizeInviteEmail)
      .required(msg('commonValidation.emailInvalid'))
      .test('email', msg('commonValidation.emailInvalid'), isEmailAddress)
      .notOneOf(context.existing, msg('inviteMembers.duplicateEmailMessage'))
      .test(
        'not-self',
        msg('inviteMembers.cantInviteSelf'),
        value =>
          !context.ownEmail || value !== normalizeInviteEmail(context.ownEmail),
      ),
  });
