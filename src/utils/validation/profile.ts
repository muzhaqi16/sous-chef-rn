import * as yup from 'yup';
import { nameRule } from './common';

// display name rule
const displayNameRule = yup
  .string()
  .min(3, 'Display name must be at least 3 characters')
  .max(30, 'Display name must be less than 30 characters')
  .matches(
    /^[a-zA-Z0-9_.-]+$/,
    'Display name can only contain letters, numbers, underscores, periods, and hyphens',
  );

// bio rule
const bioRule = yup.string().max(500, 'Bio must be less than 500 characters');

// phone rule
const phoneRule = yup
  .string()
  .matches(/^[+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number');

// website/URL rule
const urlRule = yup
  .string()
  .url('Please enter a valid URL')
  .matches(/^https?:\/\/.+/, 'URL must start with http:// or https://');

// date of birth rule - simplified
const dateOfBirthRule = yup
  .string()
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
const genderRule = yup
  .string()
  .oneOf(
    ['male', 'female', 'non-binary', 'other', 'prefer-not-to-say'],
    'Please select a valid gender',
  );

// profile visibility rule
const profileVisibilityRule = yup
  .string()
  .oneOf(
    ['PUBLIC', 'FRIENDS_ONLY', 'PRIVATE'],
    'Please select a valid visibility option',
  );

// ----------------------------------------------------------------------------

// Individual field schemas for profile editing
export const profileFieldSchemas = {
  firstName: yup.object({ firstName: nameRule }),
  lastName: yup.object({ lastName: nameRule }),
  displayName: yup.object({ displayName: displayNameRule }),
  bio: yup.object({ bio: bioRule }),
  phone: yup.object({ phone: phoneRule }),
  website: yup.object({ website: urlRule }),
  dateOfBirth: yup.object({ dateOfBirth: dateOfBirthRule }),
  avatar: yup.object({ avatar: urlRule }),
  coverImage: yup.object({ coverImage: urlRule }),
  gender: yup.object({ gender: genderRule }),
  profileVisibility: yup.object({ profileVisibility: profileVisibilityRule }),
};

// Function to get validation schema for a specific field (matches your pattern)
export const getValidationSchemaForField = (fieldKey: string) => {
  const schema =
    profileFieldSchemas[fieldKey as keyof typeof profileFieldSchemas];

  if (!schema) {
    return yup.object({
      [fieldKey]: yup.string(),
    });
  }

  return schema;
};

// Complete profile validation schema (for full form validation if needed)
export const profileSchema = yup.object({
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
