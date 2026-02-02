import { string } from 'yup';

// --- shared rules ------------------------------------------------------------

// "standard" email rule
export const emailRule = string()
  .email('Please enter a valid email address')
  .required('Email is required');

// "strong-ish" password rule: 8+ chars, at least one letter and one number
export const passwordRule = string()
  .required('Password is required')
  .min(8, 'Password must be at least 8 characters')
  .matches(/[A-Za-z]/, 'At least one letter required')
  .matches(/[0-9]/, 'At least one number required');

// name rules (for firstName, lastName)
export const nameRule = string()
  .min(2, 'Name must be at least 2 characters')
  .max(50, 'Name must be less than 50 characters')
  .matches(
    /^[a-zA-Z\s'-]+$/,
    'Name can only contain letters, spaces, hyphens, and apostrophes',
  );
