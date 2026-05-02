// Predefined validation rules for common use cases
export const ValidationRules = {
  email: {
    test: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message: 'Please enter a valid email address',
  },
  minLength: (min: number) => ({
    test: (value: string) => value.trim().length >= min,
    message: `Must be at least ${min} characters long`,
  }),
  maxLength: (max: number) => ({
    test: (value: string) => value.trim().length <= max,
    message: `Must be no more than ${max} characters long`,
  }),
  noSpecialChars: {
    test: (value: string) => /^[a-zA-Z0-9\s]*$/.test(value),
    message: 'Only letters, numbers, and spaces are allowed',
  },
  required: {
    test: (value: string) => value.trim().length > 0,
    message: 'This field is required',
  },
};
