import { ValidationError } from 'yup';
import {
  shareInviteDefaults,
  shareInviteSchema,
} from '../shareInviteFormConfig';
import { CollaboratorRole } from '#/graphql/generated/schemaTypes';

/**
 * The address is a field the person can fix, so its refusal renders under the
 * input rather than in an alert covering the section.
 */
describe('the share-invite schema', () => {
  const filled = { ...shareInviteDefaults(), email: 'friend@test.com' };

  it('accepts an address and a role', async () => {
    await expect(shareInviteSchema.validate(filled)).resolves.toBeTruthy();
  });

  it.each([[''], ['   '], ['not-an-email'], ['no@domain']])(
    'reports %p on the email field',
    async email => {
      const error = await shareInviteSchema
        .validate({ ...filled, email })
        .catch((e: ValidationError) => e);

      expect((error as ValidationError).path).toBe('email');
    },
  );

  it('distinguishes a blank address from a malformed one', async () => {
    const blank = await shareInviteSchema
      .validate({ ...filled, email: '' })
      .catch((e: ValidationError) => e);
    const malformed = await shareInviteSchema
      .validate({ ...filled, email: 'not-an-email' })
      .catch((e: ValidationError) => e);

    expect((blank as ValidationError).message).toBe(
      'Please enter an email address',
    );
    expect((malformed as ValidationError).message).toBe(
      'Please enter a valid email address',
    );
  });

  it('takes every invitable role', async () => {
    for (const role of Object.values(CollaboratorRole)) {
      await expect(
        shareInviteSchema.validate({ ...filled, role }),
      ).resolves.toBeTruthy();
    }
  });
});
