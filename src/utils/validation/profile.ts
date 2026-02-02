import { object, string } from 'yup';
import { nameRule } from './common';

// display name rule
const displayNameRule = string()
  .min(3, 'Display name must be at least 3 characters')
  .max(30, 'Display name must be less than 30 characters')
  .matches(
    /^[a-zA-Z0-9_.-]+$/,
    'Display name can only contain letters, numbers, underscores, periods, and hyphens',
  );

// bio rule
const bioRule = string().max(500, 'Bio must be less than 500 characters');

// phone rule - flexible format allowing spaces, dashes, parentheses
const phoneRule = string()
  .test('valid-phone', 'Please enter a valid phone number', value => {
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
  .url('Please enter a valid URL')
  .matches(/^https?:\/\/.+/, 'URL must start with http:// or https://');

// date of birth rule - simplified
const dateOfBirthRule = string()
  .matches(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .test('valid-date', 'Please enter a valid date', value => {
    if (!value) return true;

    const [year, month, day] = value.split('-').map(Number);

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
  .test('reasonable-age', 'Please enter a reasonable birth date', value => {
    if (!value) return true;

    const birthYear = parseInt(value.split('-')[0]);
    const currentYear = new Date().getFullYear();
    const age = currentYear - birthYear;

    return age >= 13 && age <= 120;
  });

// gender rule
const genderRule = string()
  .oneOf(
    ['male', 'female', 'non-binary', 'other', 'prefer-not-to-say'],
    'Please select a valid gender',
  );

// profile visibility rule
const profileVisibilityRule = string()
  .oneOf(
    ['PUBLIC', 'FRIENDS_ONLY', 'PRIVATE'],
    'Please select a valid visibility option',
  );

// ----------------------------------------------------------------------------

// Individual field schemas for profile editing
export const profileFieldSchemas = {
  firstName: object({ firstName: nameRule }),
  lastName: object({ lastName: nameRule }),
  displayName: object({ displayName: displayNameRule }),
  bio: object({ bio: bioRule }),
  phone: object({ phone: phoneRule }),
  website: object({ website: urlRule }),
  dateOfBirth: object({ dateOfBirth: dateOfBirthRule }),
  avatar: object({ avatar: urlRule }),
  coverImage: object({ coverImage: urlRule }),
  gender: object({ gender: genderRule }),
  profileVisibility: object({ profileVisibility: profileVisibilityRule }),
};

// Function to get validation schema for a specific field (matches your pattern)
export const getValidationSchemaForField = (fieldKey: string) => {
  const schema =
    profileFieldSchemas[fieldKey as keyof typeof profileFieldSchemas];

  if (!schema) {
    return object({
      [fieldKey]: string(),
    });
  }

  return schema;
};

// Complete profile validation schema (for full form validation if needed)
export const profileSchema = object({
  firstName: nameRule.optional(),
  lastName: nameRule.optional(),
  displayName: displayNameRule.optional(),
  bio: bioRule.optional(),
  phone: phoneRule.optional(),
  website: urlRule.optional(),
  dateOfBirth: dateOfBirthRule.optional(),
  avatar: urlRule.optional(),
  coverImage: urlRule.optional(),
  gender: genderRule.optional(),
  profileVisibility: profileVisibilityRule.optional(),
});

// usage in profile editing:
// const { control, handleSubmit, formState } = useForm<{firstName: string}>({
//   resolver: yupResolver(getValidationSchemaForField('firstName')),
//   defaultValues: { firstName: profile?.firstName || '' },
// })

export const getProfileValidationSchema = () => profileSchema;
