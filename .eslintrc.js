module.exports = {
  root: true,
  extends: ['@react-native', 'plugin:react-hooks/recommended-latest'],
  plugins: ['no-barrel-files', 'react-compiler'],
  ignorePatterns: [
    'e2e/**/*',
    'src/graphql/generated/**/*',
    '**/*.generated.ts',
  ],
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
    {
      // jest.setup.js and test setup files run in Node/Jest — declare globals via config
      files: ['jest.setup.js', '__tests__/setup/**/*.js'],
      env: { node: true },
      globals: { __DEV__: 'readonly', globalThis: 'readonly' },
    },
  ],
  rules: {
    // Prevent barrel file imports for better tree shaking
    'no-barrel-files/no-barrel-files': 'error',

    // Detect React Compiler bail-outs at lint time
    'react-compiler/react-compiler': 'warn',

    // Surface silent compiler bailouts (try/finally, unsupported syntax).
    // The react-compiler rule has a known bug where it silently stops reporting
    // ALL diagnostics when it encounters unsupported syntax, producing zero
    // warnings instead of flagging the bailout. This rule catches those cases.
    // See: https://github.com/facebook/react/issues/35644
    // Fix bailouts using helpers from src/utils/compilerSafeWrappers.ts
    'react-hooks/todo': 'warn',

    // Enforce StyleSheet from react-native-unistyles instead of react-native
    // Prevent useMemo/useCallback — React Compiler handles memoization automatically
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'react-native',
            importNames: ['StyleSheet'],
            message: 'Import StyleSheet from "react-native-unistyles" instead.',
          },
          {
            name: 'react',
            importNames: ['useMemo', 'useCallback'],
            message:
              'useMemo/useCallback are unnecessary — the React Compiler handles memoization automatically.',
          },
        ],
      },
    ],

    'react-hooks/rules-of-hooks': 'error',
    // Warn level — React Compiler handles memoization deps, but this catches stale closures in useEffect
    'react-hooks/exhaustive-deps': 'warn',

    // Warn on unused variables (underscore prefix indicates intentionally unused)
    '@typescript-eslint/no-unused-vars': ['warn', { ignoreRestSiblings: true }],

    // Disable rules not relevant for React Native
    'no-bitwise': 'off', // Allow bitwise operations for hash functions
    'no-void': ['error', { allowAsStatement: true }], // Allow void as statement (e.g. void expr to reference a value)
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

    // Ban all eslint-disable directives — fix the root cause instead of suppressing
    'eslint-comments/no-use': 'error',

    // Allow missing radix for parseInt in specific contexts
    radix: ['warn', 'as-needed'],

    // Allow unnecessary escapes in regex (sometimes needed for clarity)
    'no-useless-escape': 'warn',

    // Allow unstable nested components in forms (common pattern in React Native)
    'react/no-unstable-nested-components': ['warn', { allowAsProps: true }],

    // Prevent falsy values (0, "", NaN) from leaking into JSX rendering
    'react/jsx-no-leaked-render': [
      'error',
      { validStrategies: ['ternary', 'coerce'] },
    ],

    // Prevent inline import() types — use top-level imports instead
    // Prevent inline functions passed to scheduleOnRN — causes native crashes on Android
    'no-restricted-syntax': [
      'error',
      {
        selector: 'TSImportType',
        message:
          'Avoid inline import() types. Import the type at the top of the file instead.',
      },
      {
        selector:
          'CallExpression[callee.name="scheduleOnRN"] > :matches(ArrowFunctionExpression, FunctionExpression)',
        message:
          'Do not pass inline functions to scheduleOnRN — define the callback in RN runtime scope first. Inline functions inside worklets cause native crashes on Android.',
      },
      {
        selector: 'CallExpression[callee.name="scheduleOnRN"][arguments.2]',
        message:
          'scheduleOnRN should have at most 2 arguments (function + one primitive). Functions cannot be serialized across the worklet boundary — capture them via RN-scope closure instead.',
      },
      {
        selector:
          ':matches(Property[key.name="shadowColor"], Property[key.name="shadowOffset"], Property[key.name="shadowOpacity"], Property[key.name="shadowRadius"])',
        message:
          'Use CSS boxShadow syntax instead of individual shadow properties. See src/styles/listStyles.ts for the correct pattern.',
      },
      {
        selector:
          'AssignmentExpression[left.type="MemberExpression"][left.property.name="value"]',
        message:
          'Use .set() instead of .value assignment for SharedValues (React Compiler compatibility). If this is not a SharedValue, refactor to avoid .value mutation.',
      },
      {
        selector:
          'TSAsExpression[typeAnnotation.type="TSTypeReference"][typeAnnotation.typeName.name="const"]',
        message:
          'Avoid `as const` — let TypeScript infer literal types naturally. Use `as const` only for union type derivation or discriminated unions.',
      },
      {
        selector:
          'ExpressionStatement > CallExpression[callee.name="useUnistyles"]',
        message:
          'useUnistyles() called without using its return value has no effect. Destructure what you need: `const { theme } = useUnistyles()`.',
      },
      {
        selector:
          'ArrayExpression > MemberExpression[object.name="styles"] ~ MemberExpression[object.name="styles"]',
        message:
          "Avoid combining multiple `styles.*` on the same element — Unistyles v3 proxies break when spread by reanimated's StyleSheet.flatten(). Use `styles.useVariants()` instead.",
      },
    ],
  },
};
