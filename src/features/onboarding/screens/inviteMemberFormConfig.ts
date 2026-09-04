import { object, string, type ObjectSchema } from 'yup';
import { t } from '#/i18n';

// Messages resolve LAZILY: the schema is built once at module scope, so an
// eagerly resolved one freezes whichever language was active at import time.
const msg = (key: string) => (): string => t(key);

export interface InviteEmailFormValues {
  email: string;
}

export interface InviteEmailContext {
  /** Addresses already staged on the screen. */
  existing: string[];
  /** The signed-in account, which cannot invite itself. */
  ownEmail: string | null | undefined;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
      .matches(EMAIL, msg('commonValidation.emailInvalid'))
      .notOneOf(context.existing, msg('inviteMembers.duplicateEmailMessage'))
      .test(
        'not-self',
        msg('inviteMembers.cantInviteSelf'),
        value =>
          !context.ownEmail || value !== normalizeInviteEmail(context.ownEmail),
      ),
  });
