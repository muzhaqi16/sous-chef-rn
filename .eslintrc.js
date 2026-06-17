module.exports = {
  root: true,
  extends: ['@react-native', 'plugin:react-hooks/recommended-latest'],
  plugins: ['no-barrel-files', 'react-compiler', 'import'],
  ignorePatterns: [
    'e2e/**/*',
    'src/graphql/generated/**/*',
    'src/**/*.generated.ts',
    'coverage/**/*',
  ],
  env: {
    jest: true,
  },
  // Resolve TypeScript path aliases (e.g. #features/*) so that
  // import/no-restricted-paths can match aliased imports against zone paths.
  settings: {
    'import/resolver': {
      typescript: {
        project: './tsconfig.json',
      },
    },
  },
  // TypeScript-specific overrides with type-checked rules
  overrides: [
    {
      // Test files legitimately use `as any` for mocks/fixtures, so the
      // production-oriented no-restricted-syntax selectors (the `as any`/
      // `as unknown` cast ban, scheduleOnRN/shadow/style hygiene, etc.) are
      // relaxed here. The jest.mock(@apollo/client/react) ban is kept because
      // it targets a test-specific anti-pattern. Full production enforcement
      // lives in the global `rules` block below.
      files: [
        '**/__tests__/**/*.ts',
        '**/__tests__/**/*.tsx',
        '**/*.test.ts',
        '**/*.test.tsx',
      ],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector:
              'CallExpression[callee.object.name="jest"][callee.property.name="mock"][arguments.0.value="@apollo/client/react"]',
            message:
              'Use renderHookWithApollo / renderWithApollo from __tests__/helpers/apolloMockProvider.tsx instead. Direct jest.mock of @apollo/client/react couples tests to operation names, bypasses the real cache, and breaks under refactors. See CLAUDE.md "Apollo Test Patterns" for the migration recipe + 7 gotchas.',
          },
        ],
        // Tests reach into private class members via bracket notation
        // (e.g. `manager['privateMethod']`), which is the only type-safe way
        // to exercise them — dot access on a private member is a TS2341 error.
        // `dot-notation` would otherwise force the broken dot form, so it is
        // off for tests.
        'dot-notation': 'off',
      },
    },
    {
      // Apply to TypeScript source files only (not test files or config files)
      // These files must be included in tsconfig.json for type-checked rules.
      // Tests are intentionally INCLUDED so deprecation warnings catch e.g.
      // `MockedResponse from @apollo/client/testing` (deprecated; use
      // `MockedResponse` re-exported from `__tests__/helpers/apolloMockProvider`).
      files: ['src/**/*.ts', 'src/**/*.tsx', 'App.tsx'],
      parserOptions: {
        project: './tsconfig.json',
      },
      rules: {
        '@typescript-eslint/no-deprecated': 'warn',
      },
    },
    {
      // Tests live outside the production tsconfig (Metro bundles them
      // separately). __tests__/tsconfig.json includes them so ESLint's
      // type-checked rules (no-deprecated, etc.) can still run.
      files: ['__tests__/**/*.ts', '__tests__/**/*.tsx'],
      parserOptions: {
        project: './__tests__/tsconfig.json',
      },
      rules: {
        '@typescript-eslint/no-deprecated': 'warn',
      },
    },
    {
      // jest.setup.js and test setup files run in Node/Jest — declare globals via config
      files: ['jest.setup.js', '__tests__/setup/**/*.js'],
      env: { node: true },
      globals: { __DEV__: 'readonly', globalThis: 'readonly' },
    },
    {
      // App code — business-logic hooks (feature + shared) and the UI layer
      // (screens, shared + feature components). Caught errors here must be
      // observable in production: `console.error` only writes to the device
      // console (never the telemetry pipeline), and `console.log` is stripped
      // from release builds entirely — so neither belongs in this layer. Route
      // actionable errors through `errorService.reportError(error, { operation })`
      // so they reach Loki/Grafana; use `logger.warn` / `logger.debug` for benign
      // or dev-only diagnostics. `console.warn` stays allowed for the few existing
      // cache-miss guards. Infra (telemetry transports, perf monitors, the
      // Apollo console link, `src/hooks/performance/**`) is intentionally NOT
      // covered — console output is its purpose there.
      files: [
        'src/features/**/hooks/**/*.ts',
        'src/features/**/hooks/**/*.tsx',
        'src/features/**/screens/**/*.ts',
        'src/features/**/screens/**/*.tsx',
        'src/features/**/components/**/*.ts',
        'src/features/**/components/**/*.tsx',
        'src/components/**/*.ts',
        'src/components/**/*.tsx',
        'src/screens/**/*.ts',
        'src/screens/**/*.tsx',
        'src/hooks/**/*.ts',
        'src/hooks/**/*.tsx',
      ],
      excludedFiles: [
        '**/__tests__/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        // Perf monitors — console output is their purpose (see comment above).
        'src/hooks/performance/**',
      ],
      rules: {
        'no-console': ['error', { allow: ['warn', 'info', 'debug'] }],
      },
    },
    {
      // Justified exceptions to the BottomSheetModal-import restriction:
      // - useStandardBottomSheet.tsx is the canonical re-export site
      //   (aliases gorhom's component as GorhomBottomSheetModal and wraps
      //    it with `withUnistyles` for theme reactivity).
      // - useBottomSheetBackHandler.ts is imported BY the hook, so it
      //   can't import from the hook (circular). Type-only usage.
      // - ActionTray.tsx is intentionally a different-shape sheet that
      //   doesn't use useStandardBottomSheet. It renders gorhom's
      //   BottomSheetModal directly and claims the global backdrop declaratively
      //   via `useBackdropClaim` with an animatedIndex-driven opacity SV (the
      //   slot lifecycle is tied to React state so it can't leak on navigation).
      files: [
        'src/hooks/useStandardBottomSheet.tsx',
        'src/hooks/useBottomSheetBackHandler.ts',
        'src/components/templates/ActionTray/ActionTray.tsx',
      ],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: 'react-native',
                importNames: ['StyleSheet'],
                message:
                  'Import StyleSheet from "react-native-unistyles" instead.',
              },
              {
                name: 'react',
                importNames: ['useMemo', 'useCallback'],
                message:
                  'useMemo/useCallback are unnecessary — the React Compiler handles memoization automatically.',
              },
            ],
            patterns: [
              {
                group: ['**/*Fragments.generated'],
                importNames: [
                  'UnitBasicFragment',
                  'UnitBasicFragmentDoc',
                  'UnitFullFragment',
                  'UnitFullFragmentDoc',
                  'StoreFieldsFragment',
                  'StoreFieldsFragmentDoc',
                  'BrandFieldsFragment',
                  'BrandFieldsFragmentDoc',
                  'UserProfileFieldsFragment',
                  'UserProfileFieldsFragmentDoc',
                  'UserProfileFullFragment',
                  'UserProfileFullFragmentDoc',
                  'UserSummaryFragment',
                  'UserSummaryFragmentDoc',
                  'PantryItemFragment',
                  'PantryItemFragmentDoc',
                  'PantryItemDisplay',
                  'PantryItemDisplayFragment',
                  'PantryItemDisplayFragmentDoc',
                  'ShoppingListItemFragment',
                  'ShoppingListItemFragmentDoc',
                  'MealPlanFullFragment',
                  'MealPlanFullFragmentDoc',
                  'RecipeFragment',
                  'RecipeFragmentDoc',
                  'ItemFragment',
                  'ItemFragmentDoc',
                  'ItemDisplayFragment',
                  'ItemDisplayFragmentDoc',
                  'ItemCoreFragment',
                  'ItemCoreFragmentDoc',
                  'HomeFragment',
                  'HomeFragmentDoc',
                ],
                message:
                  'This fragment was deleted or decomposed. Use a colocated `<Consumer>_<entity>` fragment instead (sibling .graphql file next to the consumer). See CLAUDE.md "Apollo: Fragment composition + `useFragment` convention".',
              },
            ],
          },
        ],
      },
    },
    {
      // The canonical re-export / wrapper atoms MUST import the RN primitives
      // they re-export (themedComponents → Pressable; Text → RN Text). They
      // contain no other restricted imports, so the rule is off for just these
      // two files. The exemption lives in config — no inline eslint-disable.
      files: [
        'src/components/atoms/themedComponents.tsx',
        'src/components/atoms/Text.tsx',
      ],
      rules: {
        'no-restricted-imports': 'off',
      },
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
    // Block re-introducing deleted "god" / dead-scalar fragments. See CLAUDE.md
    // "Apollo: Fragment composition" — the codebase converged on per-component
    // colocated fragments + a small documented set of shared fragments. The
    // names listed below were either deleted (inlined into consumers) or
    // decomposed into per-consumer fragments and should not return.
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'react-native',
            importNames: [
              'StyleSheet',
              'Text',
              'Pressable',
              'TouchableOpacity',
              'TouchableHighlight',
              'TouchableNativeFeedback',
              'TouchableWithoutFeedback',
            ],
            message:
              'Use the project re-exports/atoms for app-wide consistency: StyleSheet → "react-native-unistyles"; Text → "#components/atoms/Text" (variant/tone/weight typography with consistent line-heights); Pressable → "#components/atoms/themedComponents" (or AppPressable/PressableScale for press feedback, or react-native-gesture-handler\'s Pressable for gesture composition). Touchables are deprecated — use Pressable. For RN Text/Pressable *types*, import `type { TextProps, TextStyle, PressableProps }` (type-only imports are fine).',
          },
          {
            name: 'react',
            importNames: ['useMemo', 'useCallback'],
            message:
              'useMemo/useCallback are unnecessary — the React Compiler handles memoization automatically.',
          },
          {
            name: '@gorhom/bottom-sheet',
            importNames: ['BottomSheetModal'],
            message:
              "Import BottomSheetModal from '#hooks/useStandardBottomSheet' instead. That re-export is theme-wrapped and composes the global backdrop claim via modalProps.onChange — importing from @gorhom/bottom-sheet directly bypasses both. For type-only usage, import { BottomSheetModalRef } from '#hooks/useStandardBottomSheet'.",
          },
          {
            name: '#hooks/useBottomSheetBackdropClaim',
            message:
              'useBottomSheetBackdropClaim is an internal helper for useStandardBottomSheet. Consumers should use useStandardBottomSheet instead — it wires animatedIndex, onChange, the back handler, focus-aware dismiss-on-blur, and theme styles all together. Importing the lower-level hook directly bypasses every other affordance.',
          },
        ],
        patterns: [
          {
            group: ['**/*Fragments.generated'],
            importNames: [
              // Deleted dead scalar/leaf fragments — fields are inlined where used.
              'UnitBasicFragment',
              'UnitBasicFragmentDoc',
              'UnitFullFragment',
              'UnitFullFragmentDoc',
              'StoreFieldsFragment',
              'StoreFieldsFragmentDoc',
              'BrandFieldsFragment',
              'BrandFieldsFragmentDoc',
              'UserProfileFieldsFragment',
              'UserProfileFieldsFragmentDoc',
              'UserProfileFullFragment',
              'UserProfileFullFragmentDoc',
              'UserSummaryFragment',
              'UserSummaryFragmentDoc',
              // Deleted "god" fragments — decomposed into colocated component
              // fragments (PantryItemDetail_pantryItem, PantryItemForm_pantryItem,
              // useUpdatePantryItem_pantryItem, etc.).
              'PantryItemFragment',
              'PantryItemFragmentDoc',
              'PantryItemDisplay',
              'PantryItemDisplayFragment',
              'PantryItemDisplayFragmentDoc',
              'ShoppingListItemFragment',
              'ShoppingListItemFragmentDoc',
              'MealPlanFullFragment',
              'MealPlanFullFragmentDoc',
              'RecipeFragment',
              'RecipeFragmentDoc',
              'ItemFragment',
              'ItemFragmentDoc',
              'ItemDisplayFragment',
              'ItemDisplayFragmentDoc',
              'ItemCoreFragment',
              'ItemCoreFragmentDoc',
              'HomeFragment',
              'HomeFragmentDoc',
            ],
            message:
              'This fragment was deleted or decomposed. Use a colocated `<Consumer>_<entity>` fragment instead (sibling .graphql file next to the consumer). See CLAUDE.md "Apollo: Fragment composition + `useFragment` convention".',
          },
        ],
      },
    ],

    // Enforce the Feature API Boundary Convention (CLAUDE.md).
    //
    // Each feature under src/features/<name>/ exposes a public surface
    // (screens/, manifest.ts, top-level hooks/) and keeps everything else
    // private. Reaching across features into another feature's internals
    // (context/, hooks/mutations/, utils/, graphql/) is blocked here.
    //
    // Allowed cross-feature reach: screens, manifest, top-level hooks, and
    // <feature>Fragments.generated.ts type imports (via the `except` clause).
    //
    // One zone is needed per feature because "same feature" cannot be
    // expressed as a glob — each zone enumerates what's PRIVATE in that
    // feature and what's allowed to import from it.
    'import/no-restricted-paths': [
      'error',
      {
        zones: [
          // pantry
          {
            target: './src/features/!(pantry)/**',
            from: './src/features/pantry/graphql',
            except: ['./pantryFragments.generated.ts'],
            message:
              'Cross-feature import into pantry/graphql/ is not allowed. Use a public hook from src/features/pantry/hooks/, or compose your own GraphQL operation. Type imports from pantryFragments.generated.ts are allowed.',
          },
          {
            target: './src/features/!(pantry)/**',
            from: [
              './src/features/pantry/context',
              './src/features/pantry/hooks/mutations',
              './src/features/pantry/utils',
            ],
            message:
              'Cross-feature import into pantry internals (context/, hooks/mutations/, utils/) is not allowed. Use a public hook from src/features/pantry/hooks/.',
          },
          // shoppingList
          {
            target: './src/features/!(shoppingList)/**',
            from: './src/features/shoppingList/graphql',
            except: ['./shoppingListFragments.generated.ts'],
            message:
              'Cross-feature import into shoppingList/graphql/ is not allowed. Use a public hook from src/features/shoppingList/hooks/, or compose your own GraphQL operation. Type imports from shoppingListFragments.generated.ts are allowed.',
          },
          {
            target: './src/features/!(shoppingList)/**',
            from: [
              './src/features/shoppingList/context',
              './src/features/shoppingList/hooks/mutations',
              './src/features/shoppingList/utils',
            ],
            message:
              'Cross-feature import into shoppingList internals (context/, hooks/mutations/, utils/) is not allowed. Use a public hook from src/features/shoppingList/hooks/.',
          },
          // recipes
          {
            target: './src/features/!(recipes)/**',
            from: './src/features/recipes/graphql',
            except: ['./recipeFragments.generated.ts'],
            message:
              'Cross-feature import into recipes/graphql/ is not allowed. Use a public hook from src/features/recipes/hooks/, or compose your own GraphQL operation. Type imports from recipeFragments.generated.ts are allowed.',
          },
          {
            target: './src/features/!(recipes)/**',
            from: [
              './src/features/recipes/context',
              './src/features/recipes/hooks/mutations',
              './src/features/recipes/utils',
            ],
            message:
              'Cross-feature import into recipes internals (context/, hooks/mutations/, utils/) is not allowed. Use a public hook from src/features/recipes/hooks/.',
          },
          // mealPlan
          {
            target: './src/features/!(mealPlan)/**',
            from: './src/features/mealPlan/graphql',
            except: ['./mealPlanFragments.generated.ts'],
            message:
              'Cross-feature import into mealPlan/graphql/ is not allowed. Use a public hook from src/features/mealPlan/hooks/, or compose your own GraphQL operation. Type imports from mealPlanFragments.generated.ts are allowed.',
          },
          {
            target: './src/features/!(mealPlan)/**',
            from: [
              './src/features/mealPlan/context',
              './src/features/mealPlan/hooks/mutations',
              './src/features/mealPlan/utils',
            ],
            message:
              'Cross-feature import into mealPlan internals (context/, hooks/mutations/, utils/) is not allowed. Use a public hook from src/features/mealPlan/hooks/.',
          },
          // barcode
          {
            target: './src/features/!(barcode)/**',
            from: [
              './src/features/barcode/context',
              './src/features/barcode/hooks/mutations',
              './src/features/barcode/utils',
              './src/features/barcode/graphql',
            ],
            message:
              'Cross-feature import into barcode internals (context/, hooks/mutations/, utils/, graphql/) is not allowed. Use a public hook from src/features/barcode/hooks/, or compose your own GraphQL operation.',
          },
          // notifications
          {
            target: './src/features/!(notifications)/**',
            from: [
              './src/features/notifications/context',
              './src/features/notifications/hooks/mutations',
              './src/features/notifications/utils',
              './src/features/notifications/graphql',
            ],
            message:
              'Cross-feature import into notifications internals (context/, hooks/mutations/, utils/, graphql/) is not allowed. Use a public hook from src/features/notifications/hooks/, or compose your own GraphQL operation.',
          },
          // profile
          {
            target: './src/features/!(profile)/**',
            from: [
              './src/features/profile/context',
              './src/features/profile/hooks/mutations',
              './src/features/profile/utils',
              './src/features/profile/graphql',
            ],
            message:
              'Cross-feature import into profile internals (context/, hooks/mutations/, utils/, graphql/) is not allowed. Use a public hook from src/features/profile/hooks/, or compose your own GraphQL operation.',
          },
        ],
      },
    ],

    'react-hooks/rules-of-hooks': 'error',
    // Disabled — React Compiler memoizes render-scope functions automatically,
    // so they're stable across renders when their closure deps don't change.
    // The exhaustive-deps rule is a static analyzer that doesn't know about
    // the Compiler and produces false positives ("function changes every render")
    // for Compiler-stable closures. Per React's official guidance, when using
    // `babel-plugin-react-compiler`, only `rules-of-hooks` is required — the
    // others "don't apply" because the Compiler handles them.
    // https://react.dev/learn/react-compiler#installing-eslint-plugin-react-hooks
    'react-hooks/exhaustive-deps': 'off',

    // Warn on unused variables (underscore prefix indicates intentionally unused)
    '@typescript-eslint/no-unused-vars': ['warn', { ignoreRestSiblings: true }],

    // Surface `any` usage for gradual cleanup. Kept at 'warn' (not 'error')
    // because a chunk of the existing ~395 sites are legitimate (e.g.
    // `catch (e: any)`, loosely-typed third-party callbacks) and a hard error
    // would break the build repo-wide. Prefer type inference / generics over
    // `any`; the codebase already bans `as unknown as X` outright.
    '@typescript-eslint/no-explicit-any': 'warn',

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
      {
        selector:
          "JSXSpreadAttribute[argument.name='modalProps'] ~ JSXAttribute[name.name=/^(onChange|animatedIndex)$/]",
        message:
          "Do not override `onChange` or `animatedIndex` after `{...modalProps}` — useStandardBottomSheet supplies both: a composed onChange (drives the global backdrop claim) and the animatedIndex SharedValue (drives backdrop opacity in lockstep with the sheet). Overriding either silently breaks the dim layer. Forward via the hook's options API: `useStandardBottomSheet({ ..., onChange: handler })`. (Other props like `snapPoints`, `keyboardBlurBehavior`, `onDismiss` can be overridden safely.)",
      },
      {
        selector:
          'CallExpression[callee.object.name="jest"][callee.property.name="mock"][arguments.0.value="@apollo/client/react"]',
        message:
          'Use renderHookWithApollo / renderWithApollo from __tests__/helpers/apolloMockProvider.tsx instead. Direct jest.mock of @apollo/client/react couples tests to operation names, bypasses the real cache, and breaks under refactors. See CLAUDE.md "Apollo Test Patterns" for the migration recipe + 7 gotchas.',
      },
      {
        // Catches the hand-rolled optimisticResponse anti-pattern:
        //   pantryItem: { __typename: 'PantryItem', id } as DeleteFooMutation['...']
        // With dataMasking enabled, casting a partial `{ __typename, id }` literal
        // hides that the real mutation return type expects more fields, and the
        // partial entity gets written to cache — useFragment Pattern A consumers
        // then resolve `complete: false` and render null, producing phantom rows
        // until the real network response arrives. Build optimistic responses
        // from cache (cache.readFragment + spread) and annotate the callback
        // return type as `Unmasked<TData>` instead. See CLAUDE.md "Apollo
        // Mutation Patterns" + "Apollo: Fragment composition + useFragment".
        selector:
          'Property[key.name="optimisticResponse"] TSAsExpression > ObjectExpression:has(Property[key.name="__typename"])',
        message:
          "Hand-rolled `{ __typename, id, ... } as TData['field']` shapes inside `optimisticResponse` write partial entities to the cache and break data-masking watchers (useFragment returns `complete: false` → phantom rows in lists). Read the current entity via `client.cache.readFragment(...)` (returning IGNORE when absent) and annotate the callback's return type as `Unmasked<TData>` so no cast is needed. See CLAUDE.md \"Apollo Mutation Patterns\" + `usePantryItemMutations.ts:updateItemMutation` for the pattern.",
      },
      {
        selector: 'TSAsExpression[typeAnnotation.type="TSAnyKeyword"]',
        message:
          'Do not cast with `as any` — it hides real type errors. Type the value properly: generics (`readFragment<T>`, `extractNodes<T>`), narrow with `instanceof`, or assert a specific shape (`as { id?: string }`). `: any` annotations are tolerated where a value is genuinely untypeable, but `as any` casts are not. For library/platform boundaries with no clean type, use a narrow typed cast or a justified `// eslint-disable-next-line no-restricted-syntax -- <reason>`.',
      },
      {
        selector:
          'TSAsExpression[typeAnnotation.type="TSArrayType"][typeAnnotation.elementType.type="TSAnyKeyword"]',
        message:
          'Do not cast with `as any[]` — it hides real type errors. Supply the element type via a generic (`extractNodes<T>(...)`) or assert the concrete element shape.',
      },
      {
        selector: 'TSAsExpression[typeAnnotation.type="TSUnknownKeyword"]',
        message:
          'Do not use `as unknown` (typically the `x as unknown as T` double-cast) — it fully defeats type checking and hides real errors. Fix the data flow or use a single honest assertion.',
      },
    ],
  },
};
