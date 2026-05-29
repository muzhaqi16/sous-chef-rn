import { Schema, ValidationError } from 'yup';
import {
  profileFieldSchemas,
  getValidationSchemaForField,
  profileSchema,
  getProfileValidationSchema,
} from '../profile';

const validate = async (schema: Schema, data: Record<string, unknown>) => {
  try {
    await schema.validate(data);
    return null;
  } catch (err) {
    return err instanceof ValidationError ? err.message : String(err);
  }
};

describe('profile validation', () => {
  describe('displayName', () => {
    const schema = profileFieldSchemas.displayName;

    it('accepts valid display names', async () => {
      expect(await validate(schema, { displayName: 'john_doe' })).toBeNull();
      expect(await validate(schema, { displayName: 'User.123' })).toBeNull();
      expect(await validate(schema, { displayName: 'test-user' })).toBeNull();
    });

    it('rejects display name under 3 chars', async () => {
      const msg = await validate(schema, { displayName: 'ab' });
      expect(msg).toContain('at least 3');
    });

    it('rejects display name over 30 chars', async () => {
      const msg = await validate(schema, { displayName: 'a'.repeat(31) });
      expect(msg).toContain('less than 30');
    });

    it('rejects display names with spaces', async () => {
      const msg = await validate(schema, { displayName: 'john doe' });
      expect(msg).toBeTruthy();
    });

    it('rejects display names with special chars', async () => {
      const msg = await validate(schema, { displayName: 'user@name' });
      expect(msg).toBeTruthy();
    });
  });

  describe('bio', () => {
    const schema = profileFieldSchemas.bio;

    it('accepts valid bio', async () => {
      expect(await validate(schema, { bio: 'I love cooking!' })).toBeNull();
    });

    it('rejects bio over 500 chars', async () => {
      const msg = await validate(schema, { bio: 'x'.repeat(501) });
      expect(msg).toContain('500');
    });
  });

  describe('phone', () => {
    const schema = profileFieldSchemas.phone;

    it('accepts valid phone numbers', async () => {
      expect(await validate(schema, { phone: '+1 (555) 123-4567' })).toBeNull();
      expect(await validate(schema, { phone: '5551234567' })).toBeNull();
      expect(await validate(schema, { phone: '+442071234567' })).toBeNull();
    });

    it('allows empty phone (optional)', async () => {
      expect(await validate(schema, { phone: '' })).toBeNull();
    });

    it('rejects phone with too few digits', async () => {
      const msg = await validate(schema, { phone: '123456' });
      expect(msg).toBeTruthy();
    });

    it('rejects phone with too many digits', async () => {
      const msg = await validate(schema, { phone: '1234567890123456' });
      expect(msg).toBeTruthy();
    });

    it('rejects phone with invalid characters', async () => {
      const msg = await validate(schema, { phone: '555-ABC-1234' });
      expect(msg).toBeTruthy();
    });

    it('rejects plus sign not at start', async () => {
      const msg = await validate(schema, { phone: '555+1234567' });
      expect(msg).toBeTruthy();
    });
  });

  describe('dateOfBirth', () => {
    const schema = profileFieldSchemas.dateOfBirth;

    it('accepts valid date', async () => {
      expect(await validate(schema, { dateOfBirth: '1990-06-15' })).toBeNull();
    });

    it('rejects empty string (matches format check runs first)', async () => {
      const msg = await validate(schema, { dateOfBirth: '' });
      expect(msg).toBeTruthy();
    });

    it('allows undefined (optional via profileSchema)', async () => {
      expect(await validate(profileSchema, {})).toBeNull();
    });

    it('rejects invalid format', async () => {
      const msg = await validate(schema, { dateOfBirth: '06-15-1990' });
      expect(msg).toBeTruthy();
    });

    it('rejects invalid date values', async () => {
      const msg = await validate(schema, { dateOfBirth: '1990-13-01' });
      expect(msg).toBeTruthy();
    });

    it('rejects Feb 30', async () => {
      const msg = await validate(schema, { dateOfBirth: '1990-02-30' });
      expect(msg).toBeTruthy();
    });

    it('rejects unreasonable age (too young)', async () => {
      const msg = await validate(schema, { dateOfBirth: '2020-01-01' });
      expect(msg).toBeTruthy();
    });

    it('rejects unreasonable age (too old)', async () => {
      const msg = await validate(schema, { dateOfBirth: '1800-01-01' });
      expect(msg).toBeTruthy();
    });
  });

  describe('gender', () => {
    const schema = profileFieldSchemas.gender;

    it.each(['male', 'female', 'non-binary', 'other', 'prefer-not-to-say'])(
      'accepts "%s"',
      async gender => {
        expect(await validate(schema, { gender })).toBeNull();
      },
    );

    it('rejects invalid gender', async () => {
      const msg = await validate(schema, { gender: 'invalid' });
      expect(msg).toBeTruthy();
    });
  });

  describe('profileVisibility', () => {
    const schema = profileFieldSchemas.profileVisibility;

    it.each(['PUBLIC', 'FRIENDS_ONLY', 'PRIVATE'])(
      'accepts "%s"',
      async visibility => {
        expect(
          await validate(schema, { profileVisibility: visibility }),
        ).toBeNull();
      },
    );

    it('rejects invalid visibility', async () => {
      const msg = await validate(schema, { profileVisibility: 'HIDDEN' });
      expect(msg).toBeTruthy();
    });
  });

  describe('getValidationSchemaForField', () => {
    it('returns schema for known field', () => {
      const schema = getValidationSchemaForField('firstName');
      expect(schema).toBeDefined();
    });

    it('returns generic schema for unknown field', () => {
      const schema = getValidationSchemaForField('unknownField');
      expect(schema).toBeDefined();
    });
  });

  describe('profileSchema', () => {
    it('validates a complete profile', async () => {
      const data = {
        firstName: 'John',
        lastName: 'Doe',
        displayName: 'johndoe',
        bio: 'Hi there',
        gender: 'male',
        profileVisibility: 'PUBLIC',
      };
      expect(await validate(profileSchema, data)).toBeNull();
    });

    it('allows all optional fields to be absent', async () => {
      expect(await validate(profileSchema, {})).toBeNull();
    });
  });

  describe('getProfileValidationSchema', () => {
    it('returns the profile schema', () => {
      expect(getProfileValidationSchema()).toBe(profileSchema);
    });
  });
});
