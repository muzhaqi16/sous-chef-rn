// utils/validation.ts
import * as yup from 'yup';

// --- shared rules ------------------------------------------------------------

// “standard” email rule
const emailRule = yup
  .string()
  .email('Please enter a valid email address')
  .required('Email is required');

// “strong-ish” password rule: 8+ chars, at least one letter and one number
const passwordRule = yup
  .string()
  .required('Password is required')
  .min(8, 'Password must be at least 8 characters')
  .matches(/[A-Za-z]/, 'At least one letter required')
  .matches(/[0-9]/, 'At least one number required');

// ----------------------------------------------------------------------------

// 1) login (email + password)
export const loginSchema = yup.object({
  email: emailRule,
  password: passwordRule,
});

// usage in your LoginForm:
// const { control, handleSubmit, formState } = useForm<FormValues>({
//   resolver: yupResolver(loginSchema),
//   defaultValues: { email: '', password: '' },
// })

export const getLoginValidationSchema = () => loginSchema;

// ----------------------------------------------------------------------------

// 2) sign-up (email + password + confirmPassword)
export const signUpSchema = yup.object({
  name: yup
    .string()
    .required('Full name is required')
    .min(2, 'Full name must be at least 2 characters'),
  email: emailRule,
  password: passwordRule,
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password')], 'Passwords must match')
    .required('Please confirm your password'),
});

// usage in SignUpForm:
// const { control, handleSubmit, formState } = useForm<FormValues>({
//   resolver: yupResolver(signUpSchema),
//   defaultValues: { email: '', password: '', confirmPassword: '' },
// })

export const getSignUpValidationSchema = () => signUpSchema;

// ----------------------------------------------------------------------------

// 3) forgot-password (email only)
export const forgotPasswordSchema = yup.object({
  email: emailRule,
});

// usage in ForgotPasswordScreen:
// const { control, handleSubmit, formState } = useForm<{email:string}>({
//   resolver: yupResolver(forgotPasswordSchema),
//   defaultValues: { email: '' },
// })

export const getForgotPasswordValidationSchema = () => forgotPasswordSchema;

// ----------------------------------------------------------------------------

// 4) email-verification (6-digit code)
export const emailVerificationSchema = yup.object({
  code: yup
    .string()
    .required('Verification code is required')
    .matches(/^\d{6}$/, 'Code must be 6 digits'),
});

// usage in EmailVerificationScreen:
// const { control, handleSubmit, formState } = useForm<{code:string}>({
//   resolver: yupResolver(emailVerificationSchema),
//   defaultValues: { code: '' },
// })

export const getEmailVerificationValidationSchema = () =>
  emailVerificationSchema;

// ----------------------------------------------------------------------------

// 5) reset-password (new password + confirm)
export const resetPasswordSchema = yup.object({
  password: passwordRule,
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password')], 'Passwords must match')
    .required('Please confirm your new password'),
});

// usage in ResetPasswordScreen:
// const { control, handleSubmit, formState } = useForm<{password:string;confirmPassword:string}>({
//   resolver: yupResolver(resetPasswordSchema),
//   defaultValues: { password: '', confirmPassword: '' },
// })

export const getResetPasswordValidationSchema = () => resetPasswordSchema;

// Add these to your existing utils/validation.ts file

// --- profile field rules ----------------------------------------------------

// name rules (for firstName, lastName)
const nameRule = yup
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(50, 'Name must be less than 50 characters')
  .matches(
    /^[a-zA-Z\s'-]+$/,
    'Name can only contain letters, spaces, hyphens, and apostrophes',
  );

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
  .matches(/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number');

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
  firstName: yup.object({firstName: nameRule}),
  lastName: yup.object({lastName: nameRule}),
  displayName: yup.object({displayName: displayNameRule}),
  bio: yup.object({bio: bioRule}),
  phone: yup.object({phone: phoneRule}),
  website: yup.object({website: urlRule}),
  dateOfBirth: yup.object({dateOfBirth: dateOfBirthRule}),
  avatar: yup.object({avatar: urlRule}),
  coverImage: yup.object({coverImage: urlRule}),
  gender: yup.object({gender: genderRule}),
  profileVisibility: yup.object({profileVisibility: profileVisibilityRule}),
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
