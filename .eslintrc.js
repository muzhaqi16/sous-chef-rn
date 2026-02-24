module.exports = {
  root: true,
  extends: '@react-native',
  plugins: ['no-barrel-files'],
  ignorePatterns: ['e2e/**/*'],
  env: {
    jest: true,
  },
  // TypeScript-specific overrides with type-checked rules
  overrides: [
    {
      // Apply to TypeScript source files only (not test files or config files)
      // These files must be included in tsconfig.json for type-checked rules
      files: ['src/**/*.ts', 'src/**/*.tsx', 'App.tsx'],
      excludedFiles: ['**/*.test.ts', '**/*.test.tsx'],
      parserOptions: {
        project: './tsconfig.json',
      },
      rules: {
        // Warn on deprecated API usage (runOnJS, etc.)
        // Requires type information - only works on TS files in tsconfig
        '@typescript-eslint/no-deprecated': 'warn',
      },
    },
  ],
  rules: {
    // Prevent barrel file imports for better tree shaking
    'no-barrel-files/no-barrel-files': 'error',

    // Enforce StyleSheet from react-native-unistyles instead of react-native
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'react-native',
            importNames: ['StyleSheet'],
            message: 'Import StyleSheet from "react-native-unistyles" instead.',
          },
        ],
      },
    ],

    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // Warn on unused variables (underscore prefix indicates intentionally unused)
    '@typescript-eslint/no-unused-vars': 'warn',

    // Disable rules not relevant for React Native
    'no-bitwise': 'off', // Allow bitwise operations for hash functions
    'no-catch-shadow': 'off', // IE 8 compatibility not needed
    'react-native/no-inline-styles': 'off', // Allow inline styles for simple one-offs

    // Reduce noise from common patterns
    '@typescript-eslint/no-shadow': [
      'warn',
      {
        ignoreTypeValueShadow: true,
        ignoreFunctionTypeParameterNameValueShadow: true,
        allow: [
          'error',
          'data',
          'state',
          'user',
          'accessToken',
          'refreshToken',
          'item',
          'email',
          'props',
        ], // Common GraphQL/state variable names
      },
    ],

    // Allow unlimited eslint-disable for generated files
    'eslint-comments/no-unlimited-disable': 'off',
    'eslint-comments/no-unused-disable': 'off',

    // Allow missing radix for parseInt in specific contexts
    radix: ['warn', 'as-needed'],

    // Allow unnecessary escapes in regex (sometimes needed for clarity)
    'no-useless-escape': 'warn',

    // Allow unstable nested components in forms (common pattern in React Native)
    'react/no-unstable-nested-components': ['warn', { allowAsProps: true }],

    // Prevent falsy values (0, "", NaN) from leaking into JSX rendering
    'react/jsx-no-leaked-render': ['error', { validStrategies: ['ternary', 'coerce'] }],

    // Prevent inline import() types — use top-level imports instead
    'no-restricted-syntax': [
      'error',
      {
        selector: 'TSImportType',
        message: 'Avoid inline import() types. Import the type at the top of the file instead.',
      },
    ],
  },
};
