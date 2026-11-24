import { object, string } from 'yup';
import {
  lazyMessage,
  nameRule,
  normalizeSmartPunctuation,
} from '#/utils/validation/common';
import { ProfileVisibility } from '#/graphql/generated/schemaTypes';
import type { KeyUnder } from '#/i18n';
import { isOwnKey } from '#utils/isOwnKey';

const msg = (
  key: KeyUnder<'profileValidation'>,
  options?: Record<string, unknown>,
) => lazyMessage(`profileValidation.${key}`, options);

// display name rule
const displayNameRule = string()
  .transform(normalizeSmartPunctuation)
  .min(3, msg('displayNameMin', { count: 3 }))
  .max(30, msg('displayNameMax', { count: 30 }))
  .matches(/^[a-zA-Z0-9_.-]+$/, msg('displayNameChars'));

// bio rule
const bioRule = string().max(500, msg('bioMax', { count: 500 }));

// phone rule - flexible format allowing spaces, dashes, parentheses
const phoneRule = string().test('valid-phone', msg('phoneInvalid'), value => {
  if (!value) return true; // Allow empty (optional field)
  // Strip all non-digit characters except leading +
  const hasPlus = value.startsWith('+');
  const digitsOnly = value.replace(/\D/g, '');
  // Must have 7-15 digits (international numbers vary in length)
  if (digitsOnly.length < 7 || digitsOnly.length > 15) return false;
  // Only allow valid characters: digits, spaces, dashes, parentheses, plus
  if (!/^[+]?[\d\s\-().]+$/.test(value)) return false;
  // Plus sign only allowed at the start
  if (!hasPlus && value.includes('+')) return false;
  return true;
});

// website/URL rule
const urlRule = string()
  .url(msg('urlInvalid'))
  .matches(/^https?:\/\/.+/, msg('urlScheme'));

// date of birth rule - simplified
const dateOfBirthRule = string()
  .transform(normalizeSmartPunctuation)
  .matches(/^\d{4}-\d{2}-\d{2}$/, msg('dateFormat'))
  .test('valid-date', msg('dateInvalid'), value => {
    if (!value) return true;

    const [year, month, day] = value.split('-').map(Number);
    // yup runs every test whatever `matches` decided, so a value that is not
    // yyyy-mm-dd still reaches here.
    if (year === undefined || month === undefined || day === undefined) {
      return false;
    }

    // Basic bounds checking
    if (year < 1900 || year > 2100) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;

    // Check if it's a real date
    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  })
  .test('reasonable-age', msg('dateUnreasonable'), value => {
    if (!value) return true;

    const birthYear = Number(value.split('-')[0]);
    const currentYear = new Date().getFullYear();
    const age = currentYear - birthYear;

    return age >= 13 && age <= 120;
  });

// gender rule
const genderRule = string().oneOf(
  ['male', 'female', 'non-binary', 'other', 'prefer-not-to-say'],
  msg('invalidGender'),
);

// profile visibility rule — derived from the schema so a hand-typed member can
// never drift out of the enum the server accepts.
const profileVisibilityRule = string().oneOf(
  Object.values(ProfileVisibility),
  msg('invalidVisibility'),
);

// ----------------------------------------------------------------------------

// The rule each editable profile field is checked against.
const profileFieldRules = {
  firstName: nameRule,
  lastName: nameRule,
  displayName: displayNameRule,
  bio: bioRule,
  phone: phoneRule,
  website: urlRule,
  dateOfBirth: dateOfBirthRule,
  avatar: urlRule,
  coverImage: urlRule,
  gender: genderRule,
  profileVisibility: profileVisibilityRule,
};

/** The one-field form a profile field is edited in; an unknown field is a plain string. */
export const getValidationSchemaForField = (fieldKey: string) =>
  object({
    [fieldKey]: isOwnKey(profileFieldRules, fieldKey)
      ? profileFieldRules[fieldKey]
      : string(),
  });
