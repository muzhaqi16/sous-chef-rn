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
      // Lint GraphQL operation documents against the schema pulled from the live
      // API (codegen writes it to src/graphql/generated/schema.graphql). This
      // surfaces a deprecated field/arg/enum value or a selection that no longer
      // exists on its type at `npm run lint` time — continuously, one at a time —
      // instead of as a surprise `npm run codegen` batch failure when the API
      // evolves. The generated SDL itself is excluded via top-level ignorePatterns.
      files: ['**/*.graphql'],
      parser: '@graphql-eslint/eslint-plugin',
      parserOptions: {
        schema: './src/graphql/generated/schema.graphql',
      },
      plugins: ['@graphql-eslint'],
      rules: {
        // Selecting a field/arg the schema doesn't have (e.g. after a result
        // type becomes a union, or a field is renamed/removed) — always a bug.
        '@graphql-eslint/fields-on-correct-type': 'error',
        // Using a field/arg/enum value the API marked @deprecated — forces the
        // switch to the replacement while the old one still exists, rather than
        // discovering it only once the API removes it. Lower to 'warn' if a
        // deprecation lands faster than the client can migrate.
        '@graphql-eslint/no-deprecated': 'error',
        // The base config's JS/TS rules don't understand the GraphQL AST; turn
        // off the ones that traverse it so they don't error on .graphql files.
        'no-barrel-files/no-barrel-files': 'off',
        'react-compiler/react-compiler': 'off',
        'react-hooks/rules-of-hooks': 'off',
        'react-hooks/todo': 'off',
        'no-restricted-syntax': 'off',
        'no-restricted-imports': 'off',
        'import/no-restricted-paths': 'off',
      },
    },
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
      // Hardcoded user-facing English in JSX text.
      //
      // This is the class of i18n miss that a regex scanner structurally
      // cannot see: JSX splits one sentence into several text nodes around
      // embedded expressions, so `Maximum {maxTags} tags reached` is three
      // AST nodes and never matches a "quoted English sentence" pattern. The
      // rule walks JSXText nodes instead, so a sentence is caught however it
      // is fragmented. Fix by adding a key to src/i18n/locales/en.json and
      // calling `t()` — not by suppressing (inline eslint-disable is banned
      // repo-wide by `eslint-comments/no-use`; carve-outs belong in `words`
      // below, where they are reviewable in one place).
      //
      // Scope: production `.tsx` under `src/` only.
      // - `.ts` is excluded because JSX text cannot exist there (TypeScript
      //   requires `.tsx` for JSX), so the rule would have nothing to check.
      // - Tests/mocks are excluded: their strings are fixtures, not shipped
      //   copy. Generated code is already dropped by the top-level
      //   ignorePatterns.
      //
      // What this does NOT cover: string props (`placeholder="…"`), object
      // literals, and template literals. `mode: 'jsx-only'` / `'all'` would
      // reach them, but every design-system prop on this codebase's `<Text>`
      // / `<Icon>` (`size`, `tone`, `weight`, `name`) is a string literal, so
      // those modes report thousands of non-copy hits and would need a
      // per-prop allowlist longer than the rule is worth. JSX text is where
      // untranslated copy actually accumulates.
      files: ['src/**/*.tsx'],
      excludedFiles: ['**/__tests__/**', '**/__mocks__/**', '**/*.test.tsx'],
      plugins: ['i18next'],
      rules: {
        'i18next/no-literal-string': [
          'error',
          {
            mode: 'jsx-only',
            // An INCLUDE list, not an exclude list. Measured: `jsx-only` with
            // the plugin's default attribute handling reports 1132 findings,
            // 75% of them from four design-system props (`tone`, `name`,
            // `testID`, `icon`) whose values are enum-ish identifiers, never
            // copy. Excluding those would mean maintaining ~50 entries that
            // grows with every new prop. Naming the handful of props that DO
            // carry copy is smaller, stable, and precise — it cut the same scan
            // to 60.
            //
            // `unit` is deliberately absent: `unit="g"` / `unit="kcal"` are
            // measurement symbols, not translatable copy.
            'jsx-attributes': {
              include: [
                'title',
                'label',
                'placeholder',
                'message',
                'description',
                'subtitle',
                'text',
                'emptyText',
                'emptyMessage',
                'emptyTitle',
                'header',
                'heading',
                'caption',
                'hint',
                'helperText',
                'errorText',
                'confirmText',
                'cancelText',
                'confirmLabel',
                'cancelLabel',
                'buttonText',
                'buttonLabel',
                'actionLabel',
                'accessibilityLabel',
                'accessibilityHint',
                'modalTitle',
                'modalSearchPlaceholder',
                'modalEmptyText',
                'searchPlaceholder',
              ],
            },
            // Swapped wholesale rather than merged (same as `words.exclude`
            // below), so the plugin's own defaults have to be repeated — drop
            // `t` and every translated call gets flagged for its key string.
            // The additions are machine vocabulary that happens to contain
            // letters: date-fns patterns ('MMM d', 'EEEE') and telemetry event
            // names.
            callees: {
              exclude: [
                'i18n(ext)?',
                't',
                'require',
                'addEventListener',
                'removeEventListener',
                'postMessage',
                'getElementById',
                'dispatch',
                'commit',
                'includes',
                'indexOf',
                'endsWith',
                'startsWith',
                'format',
                'formatISO',
                'parse',
                'trackEvent',
              ],
            },
            words: {
              // Replaces the plugin's default exclude list (the option is
              // swapped wholesale, not merged), so both entries below are
              // load-bearing.
              exclude: [
                // Any run with no letter in any script. One rule covers every
                // non-copy glyph this codebase renders as JSX text: emoji
                // including the variation selector the plugin's own
                // `/^\p{Emoji}+$/u` default misses (🍽️ = U+1F37D U+FE0F, and
                // U+FE0F is Emoji_Component, not Emoji), symbol glyphs used as
                // controls (✕, •, →), and currency/number/punctuation runs
                // ($, 1/4, 12.50). A translatable sentence always has letters,
                // so nothing real hides behind this.
                /^[^\p{L}]+$/u,
                // The product name ships untranslated in every locale.
                'Sous Chef',
              ],
            },
            message:
              'Hardcoded user-facing string. Add a key to src/i18n/locales/en.json (English only — translators fill es/it/sq) and render it via t(). For counts use i18next interpolation with {{count}} and _one/_other plural keys; give each plural form its own whole sentence rather than interpolating a word into one',
          },
        ],
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
    {
      // The shared Swipeable surface must use ONLY RNGH's Pressable. RN's
      // Pressable (the themedComponents re-export), AppPressable, and
      // PressableScale all wrap RN's Pressable, which lives in a separate
      // gesture system from RNGH — using them here blocks the swipe pan or
      // double-fires the row (the exact 2026-05 regression). This override
      // replaces the base no-restricted-imports for this leaf dir, so it
      // re-declares the relevant base bans (RN touchables/StyleSheet/Text,
      // useMemo/useCallback) and layers the RN-Pressable-wrapper bans on top.
      files: ['src/components/molecules/SwipeableItem/**/*.{ts,tsx}'],
      rules: {
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
                  "Use project re-exports/atoms: StyleSheet → 'react-native-unistyles'; Text → '#components/atoms/Text'. Inside a Swipeable, tappable surfaces MUST use RNGH's Pressable: import { Pressable } from 'react-native-gesture-handler'.",
              },
              {
                name: 'react',
                importNames: ['useMemo', 'useCallback'],
                message:
                  'useMemo/useCallback are unnecessary — the React Compiler handles memoization automatically.',
              },
              {
                name: '#components/atoms/themedComponents',
                importNames: ['Pressable'],
                message:
                  "themedComponents' Pressable is RN's Pressable — inside a Swipeable use RNGH's: import { Pressable } from 'react-native-gesture-handler'.",
              },
              {
                name: '#components/atoms/AppPressable',
                message:
                  "AppPressable wraps RN's Pressable — inside a Swipeable use RNGH's Pressable from 'react-native-gesture-handler'.",
              },
              {
                name: '#components/atoms/PressableScale',
                message:
                  "PressableScale wraps RN's Pressable — inside a Swipeable use RNGH's Pressable from 'react-native-gesture-handler'.",
              },
            ],
          },
        ],
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
      // --- Untranslated copy reaching a user-facing sink -------------------
      //
      // The i18next rule above covers the JSX surface (text + copy-carrying
      // attributes). It cannot see these, because a toast or alert is an
      // ordinary function call in a .ts hook or service.
      //
      // This is deliberately sink-shaped rather than shape-shaped. Scanning
      // for "English-looking literals" was tried repeatedly and each new
      // detector found a fresh batch the previous ones missed — the set of
      // SHAPES a string can take is open-ended, but the set of SINKS that put
      // text on screen is small and enumerable. Naming the sink is what makes
      // the check finite.
      //
      // The `{3}` guard skips single letters and symbol arguments (toast
      // positions, '✕') without needing a word allowlist.
      {
        selector:
          'CallExpression[callee.object.name=/^(toastService|alertService)$/] > Literal[value=/[A-Za-z]{3}/]',
        message:
          'Untranslated string passed to a user-facing toast/alert. Add a key to src/i18n/locales/en.json and pass t(...) — the module-level `t` from #/i18n/t works outside components.',
      },
      {
        selector:
          'CallExpression[callee.object.name=/^(toastService|alertService)$/] > TemplateLiteral',
        message:
          'Template literal passed to a user-facing toast/alert. Interpolate through i18next instead — t(key, { name }) — so the sentence stays reorderable, and use _one/_other keys for counts rather than appending an "s".',
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
        // Interactive controls rendered lexically inside an RNGH Swipeable must
        // use RNGH's Pressable, never AppPressable/PressableScale/Touchable* (all
        // RN-based). RN touchables live in a separate gesture system from RNGH,
        // so they block the swipe pan or double-fire the row's onPress. RN's own
        // `Pressable` is already banned app-wide (see no-restricted-imports); this
        // covers the RN-based atoms/touchables that name-alias around that ban.
        selector:
          'JSXElement[openingElement.name.name=/^(SwipeableItem|ReanimatedSwipeable)$/] JSXElement[openingElement.name.name=/^(AppPressable|PressableScale|TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback|TouchableNativeFeedback)$/]',
        message:
          "Interactive controls inside a Swipeable must use RNGH's Pressable (`import { Pressable } from 'react-native-gesture-handler'`), not AppPressable/PressableScale/Touchable*. RN touchables don't coordinate with RNGH's gesture arena — they block the swipe or double-fire the row's onPress. See CLAUDE.md \"Pressable & Modal Convention\".",
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
