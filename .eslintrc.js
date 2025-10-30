module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: ['e2e/**/*'],
  env: {
    jest: true,
  },
  rules: {
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // Disable rules not relevant for React Native
    'no-bitwise': 'off', // Allow bitwise operations for hash functions
    'no-catch-shadow': 'off', // IE 8 compatibility not needed
    'react-native/no-inline-styles': 'off', // Allow inline styles for simple one-offs

    // Reduce noise from common patterns
    '@typescript-eslint/no-shadow': ['warn', {
      ignoreTypeValueShadow: true,
      ignoreFunctionTypeParameterNameValueShadow: true,
      allow: ['error', 'data', 'state', 'user', 'accessToken', 'refreshToken', 'item', 'email', 'props'] // Common GraphQL/state variable names
    }],

    // Allow unlimited eslint-disable for generated files
    'eslint-comments/no-unlimited-disable': 'off',
    'eslint-comments/no-unused-disable': 'off',

    // Allow missing radix for parseInt in specific contexts
    'radix': ['warn', 'as-needed'],

    // Allow unnecessary escapes in regex (sometimes needed for clarity)
    'no-useless-escape': 'warn',

    // Allow unstable nested components in forms (common pattern in React Native)
    'react/no-unstable-nested-components': ['warn', { allowAsProps: true }],
  },
};