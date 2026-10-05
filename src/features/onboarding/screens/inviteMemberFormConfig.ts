import { object, string, type ObjectSchema } from 'yup';
import { isEmailAddress, lazyMessage } from '#utils/validation/common';

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
      .required(lazyMessage('commonValidation.emailInvalid'))
      .test(
        'email',
        lazyMessage('commonValidation.emailInvalid'),
        isEmailAddress,
      )
      .notOneOf(
        context.existing,
        lazyMessage('inviteMembers.duplicateEmailMessage'),
      )
      .test(
        'not-self',
        lazyMessage('inviteMembers.cantInviteSelf'),
        value =>
          !context.ownEmail || value !== normalizeInviteEmail(context.ownEmail),
      ),
  });
