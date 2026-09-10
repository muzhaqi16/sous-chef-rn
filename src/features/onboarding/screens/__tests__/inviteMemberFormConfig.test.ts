import { ValidationError } from 'yup';
import {
  inviteEmailSchema,
  normalizeInviteEmail,
} from '../inviteMemberFormConfig';

/**
 * All three refusals land on `email`, the only field, so each message renders
 * under the input the person has to correct rather than in an alert whose title
 * is gone the moment it is dismissed.
 */
describe('the invite-email schema', () => {
  const schema = (existing: string[] = [], ownEmail: string | null = null) =>
    inviteEmailSchema({ existing, ownEmail });

  it('accepts a new address', async () => {
    await expect(
      schema().validate({ email: 'friend@test.com' }),
    ).resolves.toBeTruthy();
  });

  it.each([['not-an-email'], ['no@domain'], ['@test.com'], ['   '], ['']])(
    'refuses %p on the email field',
    async email => {
      const error = await schema()
        .validate({ email })
        .catch((e: ValidationError) => e);

      expect((error as ValidationError).path).toBe('email');
    },
  );

  it('refuses an address already on the list', async () => {
    const error = await schema(['friend@test.com'])
      .validate({ email: 'friend@test.com' })
      .catch((e: ValidationError) => e);

    expect((error as ValidationError).message).toBe(
      'This email has already been added',
    );
  });

  it('refuses the signed-in account', async () => {
    const error = await schema([], 'me@test.com')
      .validate({ email: 'me@test.com' })
      .catch((e: ValidationError) => e);

    expect((error as ValidationError).message).toBe(
      "You can't invite yourself",
    );
  });

  // The list holds normalized addresses, so the duplicate and self rules have to
  // compare against the same normalization the screen stores.
  it('normalizes case and surrounding space before comparing', async () => {
    expect(normalizeInviteEmail('  Friend@Test.com ')).toBe('friend@test.com');

    const error = await schema(['friend@test.com'])
      .validate({ email: '  Friend@Test.com ' })
      .catch((e: ValidationError) => e);

    expect((error as ValidationError).message).toBe(
      'This email has already been added',
    );
  });
});
