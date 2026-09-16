/**
 * The project's own rules: `base` applies everywhere, then `overrides` in
 * order. Order is precedence — a later object that sets a rule REPLACES that
 * rule's options for the files it matches, it does not merge them.
 *
 * Pure data (no plugin objects) so a Jest guard can read it; plugins and
 * parsers are registered in `eslint.config.js`.
 */
const path = require('node:path');
const globals = require('globals');
const { restrictedImports } = require('./restrictedImports');
const {
  restrictedSyntax,
  restrictedSyntaxForTests,
} = require('./restrictedSyntax');
const {
  BOUNDARY_ZONES,
  BOUNDARY_ELEMENTS,
  BOUNDARY_POLICIES,
} = require('./boundaries');
const { NO_LITERAL_STRING } = require('./i18n');

const ROOT = path.join(__dirname, '..');

// `projectService` resolves each file against the tsconfig that owns it, so a
// file the named project happened to exclude no longer falls through to an
// inferred program — where a type-aware rule sees no program and returns
// nothing, which reads as a clean file. Pinned to the repo root: a runner
// started elsewhere would otherwise resolve against its own cwd.
const TYPED = { projectService: true, tsconfigRootDir: ROOT };

const TEST_FILES = ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'];

// The `sous-chef/*` bans on production code (docs/rules/). Test files and
// GraphQL documents switch them off together.
const PRODUCTION_RULES = [
  'no-schema-enum-cast',
  'testid-from-registry',
  'queueable-write-is-local-first',
  'recycling-list-host-is-bounded',
];

const productionRules = severity =>
  Object.fromEntries(
    PRODUCTION_RULES.map(name => [`sous-chef/${name}`, severity]),
  );

const base = {
  // Resolves the `#` aliases so import/no-restricted-paths can match them.
  settings: {
    'import/resolver': {
      typescript: {
        project: './tsconfig.json',
      },
    },
    'boundaries/elements': BOUNDARY_ELEMENTS,
  },
  rules: {
    'no-barrel-files/no-barrel-files': 'error',

    // Reports a `finally`; a value block inside a `try` bails the compiler too
    // and only `scripts/check-compiler-bailouts.mjs`, which compiles the file,
    // sees it.
    'react-hooks/todo': 'error',

    'no-restricted-imports': restrictedImports(),
    'no-restricted-syntax': restrictedSyntax(),

    'import/no-restricted-paths': ['error', { zones: BOUNDARY_ZONES }],
    'boundaries/dependencies': [
      'error',
      { default: 'allow', policies: BOUNDARY_POLICIES },
    ],
    // `import {} from 'x'` is what an autofix leaves after removing every unused
    // specifier; it still loads the module, so it reads as a side-effect import.
    'import/no-empty-named-blocks': 'error',

    // Type-aware: a no-op on files without type information (.js, .graphql).
    'sous-chef/no-operation-name-literal': 'error',
    'sous-chef/no-unchecked-domain-literal': 'error',

    // Every rule is 'error' or 'off' — `npm run lint` passes --max-warnings 0,
    // so a 'warn' blocks exactly like an error while reading as optional.
    'react-hooks/rules-of-hooks': 'error',
    // A missing dependency is a stale-closure bug under the compiler too: it
    // memoizes values, it does not re-run an effect nothing depends on.
    'react-hooks/exhaustive-deps': 'error',

    '@typescript-eslint/no-unused-vars': [
      'error',
      { ignoreRestSiblings: true },
    ],

    // `as any` and `as unknown` are additionally banned by sous-chef/no-unsafe-cast.
    '@typescript-eslint/no-explicit-any': 'error',

    'no-bitwise': 'off', // hash functions
    'no-void': ['error', { allowAsStatement: true }], // `void promise` marks deliberate fire-and-forget
    'no-catch-shadow': 'off',
    // An inline style object holds a literal where a theme token belongs, which
    // is how a colour ends up not following the colour scheme. Tests and perf
    // fixtures are exempt in an override.
    'react-native/no-inline-styles': 'error',

    '@typescript-eslint/no-shadow': [
      'error',
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
        ],
      },
    ],

    // Disable comments are banned outright; a rule comes off per glob here.
    'eslint-comments/no-use': 'error',

    radix: ['error', 'as-needed'],

    'no-useless-escape': 'error',

    // A component passed as a prop (a render slot) is allowed; one declared
    // inside another component's body remounts on every render.
    'react/no-unstable-nested-components': ['error', { allowAsProps: true }],

    // Falsy values (0, "", NaN) must not leak into JSX rendering.
    'react/jsx-no-leaked-render': [
      'error',
      { validStrategies: ['ternary', 'coerce'] },
    ],

    ...productionRules('error'),
  },
};

const overrides = [
  {
    // Repo-wide, Jest's globals let a stray `describe()` in `src/` pass
    // `no-undef`. The RN preset covers `*.test.*` and `__{mocks,tests}__/`.
    files: [
      '**/__perf__/**/*.{ts,tsx}',
      'e2e/**/*.ts',
      '**/jest.setup.js',
      '__tests__/setup/**/*.js',
    ],
    languageOptions: { globals: globals.jest },
  },
  {
    // The queue BUILDS and replays these writes; it is not one of their
    // callers, so the marker does not apply to it.
    files: ['src/apollo/offlineQueue/**/*.{ts,tsx}'],
    rules: { 'sous-chef/queueable-write-is-local-first': 'off' },
  },
  {
    // This module IS the parseFloat replacement.
    files: ['src/utils/parseDecimalInput.ts'],
    rules: {
      'no-restricted-syntax': restrictedSyntax({ allow: ['parseFloat'] }),
    },
  },
  {
    // Evaluating the installed package's own source IS this probe's method.
    files: ['scripts/probe-withunistyles-prop-passthrough.mjs'],
    rules: { 'no-new-func': 'off' },
  },
  {
    // Node tooling, not RN source (the parser is set in eslint.config.js). It
    // may only import packages package.json declares: a hoisted transitive
    // dependency resolves until a dedupe moves it, and never under pnpm.
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node, ...globals.es2024 },
    },
    rules: {
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: true,
          optionalDependencies: false,
          peerDependencies: false,
        },
      ],
    },
  },
  {
    // GraphQL documents against the schema codegen pulls from the live API,
    // so API drift surfaces at lint time. `graphQLConfig`, not `schema`:
    // graphql-eslint@4 errors at PARSE time on the removed flat option.
    files: ['**/*.graphql'],
    languageOptions: {
      parserOptions: {
        graphQLConfig: {
          schema: './src/graphql/generated/schema.graphql',
          // The cross-document rules (unused fragments, undefined variables,
          // fragment spreads) need the whole operation set, not one file.
          documents: ['src/**/*.graphql'],
        },
      },
    },
    rules: {
      // Fragments are `<consumer>_<entity>`, so the preset's PascalCase check
      // does not apply; operation names carry the `Get` prefix it forbids.
      '@graphql-eslint/naming-convention': [
        'error',
        {
          VariableDefinition: 'camelCase',
          OperationDefinition: { style: 'PascalCase' },
        },
      ],
      // Most fragments here are never spread: the cache writers pass the
      // generated document to `readFragment` / `writeFragment` from
      // TypeScript, which this rule cannot see, so it reports nearly all of
      // them. `__tests__/graphql/fragmentsAreReachable.test.ts` holds the
      // invariant instead, reading the generated exports.
      '@graphql-eslint/no-unused-fragments': 'off',
      // JS/TS rules that traverse the AST do not understand GraphQL's.
      'no-barrel-files/no-barrel-files': 'off',
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/todo': 'off',
      ...productionRules('off'),
      'no-restricted-imports': 'off',
      'no-restricted-syntax': 'off',
      'import/no-restricted-paths': 'off',
      'boundaries/dependencies': 'off',
    },
  },
  {
    // Tests keep only the test-specific selectors; the production ones (the
    // cast bans, worklet and style hygiene) do not apply to fixtures.
    files: [
      '**/__tests__/**/*.ts',
      '**/__tests__/**/*.tsx',
      '**/*.test.ts',
      '**/*.test.tsx',
    ],
    rules: {
      // Each is a deliberate pattern here, not a defect: a `done` callback in a
      // subscription test (65), a test whose assertion is a spy check the rule
      // cannot see (43), an assertion inside a catch (17), a hand-imported
      // `__mocks__` module (3), and a test file exporting a shared type (2).
      'jest/no-done-callback': 'off',
      'jest/expect-expect': 'off',
      'jest/no-conditional-expect': 'off',
      'jest/no-mocks-import': 'off',
      'jest/no-export': 'off',

      // Bug classes RNTL cannot report at runtime: an unawaited async query
      // asserts on a promise, a `waitFor` with several assertions retries the
      // ones that already passed, a side effect inside one runs on every retry.
      // `no-debugging-utils` is absent: it matches any `.debug(`, including the
      // app's own logger. The preference rules (`prefer-screen-queries`,
      // `render-result-naming-convention`, `prefer-find-by`) are absent too —
      // together they report ~700 findings and catch no defect.
      'testing-library/await-async-queries': 'error',
      'testing-library/await-async-utils': 'error',
      'testing-library/no-await-sync-queries': 'error',
      'testing-library/no-promise-in-fire-event': 'error',
      'testing-library/no-wait-for-multiple-assertions': 'error',
      'testing-library/no-wait-for-side-effects': 'error',
      'testing-library/no-node-access': 'error',
      'testing-library/no-container': 'error',
      'testing-library/no-global-regexp-flag-in-query': 'error',
      'testing-library/no-unnecessary-act': 'error',
      'testing-library/prefer-presence-queries': 'error',

      // The boundaries are about PRODUCTION dependency direction.
      'import/no-restricted-paths': 'off',
      'boundaries/dependencies': 'off',
      ...productionRules('off'),
      'no-restricted-syntax': restrictedSyntaxForTests(),
      // Bracket access is the only type-safe way to reach a private member.
      'dot-notation': 'off',
    },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx', 'App.tsx'],
    languageOptions: { parserOptions: TYPED },
    rules: {
      '@typescript-eslint/no-deprecated': 'error',
    },
  },
  {
    // A METHOD read without calling it is always truthy, and TS2774 cannot see
    // `!fn`. Runs over every source file with no exclusions; never delete a
    // guard to satisfy the rule — widen the over-promising type where it is
    // DECLARED. Nothing else may declare this rule.
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      '**/__tests__/**',
      '**/__mocks__/**',
      '**/__perf__/**',
      '**/*.test.{ts,tsx}',
    ],
    languageOptions: { parserOptions: TYPED },
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'error',
    },
  },
  {
    // A comment narrating what the code USED to do outlives the code and then
    // lies. `scripts/`, root configs and `.graphql` stay out: plain-substring
    // matching has a false positive in each.
    files: [
      'src/**/*.ts',
      'src/**/*.tsx',
      '__tests__/**/*.ts',
      '__tests__/**/*.tsx',
      '__tests__/**/*.js',
      'e2e/**/*.ts',
    ],
    rules: {
      'no-warning-comments': [
        'error',
        {
          terms: [
            'previously',
            'used to',
            'old behavior',
            'old behaviour',
            'was tried',
            'we tried',
            'regressed',
            'historically',
            'formerly',
            'no longer',
            'this replaces',
            'changed from',
            'until recently',
          ],
          location: 'anywhere',
        },
      ],
      'sous-chef/no-dated-comment': 'error',
    },
  },
  {
    files: ['e2e/**/*.ts'],
    languageOptions: { parserOptions: TYPED },
  },
  {
    files: ['__tests__/**/*.ts', '__tests__/**/*.tsx'],
    languageOptions: { parserOptions: TYPED },
    rules: {
      '@typescript-eslint/no-deprecated': 'error',
    },
  },
  {
    files: ['**/jest.setup.js', '__tests__/setup/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        __DEV__: 'readonly',
        globalThis: 'readonly',
      },
    },
  },
  {
    // `console.error` never reaches telemetry and `console.log` is stripped
    // from release builds, so app code reports through errorService / logger.
    // The exclusions are the modules whose OUTPUT is the console.
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: [
      ...TEST_FILES,
      '**/__mocks__/**',
      '**/__perf__/**',
      'src/utils/environment.ts',
      'src/apollo/links/consoleLink.ts',
      'src/services/telemetry/transports/**',
      'src/services/performance/FlashListDiagnostics.ts',
    ],
    rules: {
      'no-console': ['error', { allow: ['warn', 'info', 'debug'] }],
    },
  },
  {
    // Production `.tsx` only: JSX cannot exist in `.ts`, and test strings are
    // fixtures. Carve-outs belong in eslint/i18n.js, never inline.
    files: ['src/**/*.tsx'],
    ignores: [
      '**/__tests__/**',
      '**/__mocks__/**',
      '**/*.test.tsx',
      '**/__perf__/**',
      '**/*.perf-test.tsx',
    ],
    rules: {
      'sous-chef/no-module-level-t': 'error',
      'i18next/no-literal-string': NO_LITERAL_STRING,
    },
  },
  {
    // The gorhom re-export site, its circular-import helper, and ActionTray —
    // a different-shape sheet that claims the backdrop declaratively.
    files: [
      'src/hooks/useStandardBottomSheet.tsx',
      'src/hooks/useBottomSheetBackHandler.ts',
      'src/components/templates/ActionTray/ActionTray.tsx',
    ],
    rules: {
      'no-restricted-imports': restrictedImports({
        allow: {
          '@gorhom/bottom-sheet': true,
          '#hooks/useBottomSheetBackdropClaim': true,
        },
        add: [
          {
            // Not a dependency; the ban is the tripwire that keeps it out.
            name: '@react-native-picker/picker',
            message:
              'Use ModalPicker (#components/molecules/ModalPicker) instead. ' +
              'On Android the native picker opens an Activity-themed DIALOG: it ' +
              'follows the OS uiMode and ignores the in-app theme, and nothing ' +
              'reachable from RN retints it — so with the OS in dark mode and the ' +
              'app in light (or the reverse) the options are unreadable. Inside a ' +
              'bottom sheet, pass stackBehavior="push".',
          },
        ],
      }),
    },
  },
  {
    // The re-export atoms MUST import the RN primitives they re-export.
    files: [
      'src/components/atoms/themedComponents.tsx',
      'src/components/atoms/Text.tsx',
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    // A test ships nothing, so it may render the raw primitive or read the raw
    // library it asserts against; every other base ban still applies.
    files: TEST_FILES,
    rules: {
      'no-restricted-imports': restrictedImports({
        allow: {
          'react-native': ['TextInput', 'ActivityIndicator'],
          '#/i18n/config': ['getI18n'],
          'react-native-permissions': true,
          'react-native-turbo-image': true,
          '#storage/mmkv': true,
          '#/storage/mmkv': true,
          'date-fns': true,
          'fraction.js': true,
        },
      }),
    },
  },
  {
    // The two files that DEFINE the '#/i18n' entry point.
    files: ['src/i18n/index.ts', 'src/i18n/config.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    // The shared Swipeable surface uses ONLY RNGH's Pressable: every
    // RN-Pressable wrapper blocks the swipe pan or double-fires the row.
    files: ['src/components/organisms/SwipeableItem/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports({
        add: [
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
      }),
    },
  },
  {
    // Each IS the canonical wrapper, or the one case it cannot express:
    // RecipeHeroImage needs the library component inside
    // `createAnimatedComponent`; Toast's glyph colour is a runtime theme lookup.
    files: [
      'src/services/permissions/PermissionService.ts',
      'src/utils/iconUtils.tsx',
      'src/components/atoms/CachedImage.tsx',
      'src/features/recipes/components/recipeDetail/RecipeHeroImage.tsx',
      'src/components/molecules/Toast.tsx',
    ],
    rules: {
      'no-restricted-imports': restrictedImports({
        allow: {
          'react-native-permissions': true,
          'react-native-turbo-image': true,
          '@react-native-vector-icons/ionicons': true,
        },
      }),
    },
  },
  {
    // This file IS the wrapper that composes the raw scroller with the input
    // context.
    files: ['src/components/atoms/BottomSheetFormScrollView.tsx'],
    rules: {
      'no-restricted-imports': restrictedImports({
        allow: {
          '#components/atoms/BottomSheetKeyboardAwareScrollView': true,
        },
      }),
    },
  },
  {
    // A paged photo carousel: FlashList has no `pagingEnabled`.
    files: [
      'src/features/catalog/ui/ItemPhotoCarousel.tsx',
      'src/features/catalog/ui/ItemPhotoViewer/ItemPhotoViewer.tsx',
    ],
    rules: {
      'no-restricted-imports': restrictedImports({
        allow: { 'react-native': ['FlatList'] },
      }),
    },
  },
  {
    // The formatters ARE the mechanism the ban points at.
    files: [
      'src/utils/formatQuantity.ts',
      'src/utils/fractionUtils.ts',
      'src/utils/dateUtils.ts',
      'src/utils/formatters/date.ts',
    ],
    rules: {
      'no-restricted-imports': restrictedImports({
        allow: { 'fraction.js': true, 'date-fns': true },
      }),
    },
  },
  {
    // The Loading atom's `color` prop is the documented escape hatch.
    files: ['src/components/molecules/Loading.tsx'],
    rules: {
      'no-restricted-imports': restrictedImports({
        allow: { 'react-native': ['ActivityIndicator'] },
      }),
    },
  },
  {
    // The navigation wrappers are the one place that reaches the raw hook.
    files: [
      'src/hooks/navigation/useAppNavigation.ts',
      'src/features/onboarding/hooks/useOnboardingNavigation.ts',
    ],
    rules: {
      'no-restricted-imports': restrictedImports({
        allow: { '@react-navigation/native': ['useNavigation'] },
      }),
    },
  },
  {
    // The one read of the reduce-motion preference.
    files: ['src/hooks/animations/useMotionEnabled.ts'],
    rules: {
      'no-restricted-imports': restrictedImports({
        allow: { 'react-native-reanimated': ['useReducedMotion'] },
      }),
    },
  },
  {
    // An inline style in a fixture describes the input rather than shipping a
    // literal.
    files: ['**/__tests__/**/*.tsx', '**/*.test.tsx', '**/__perf__/**/*.tsx'],
    rules: {
      'react-native/no-inline-styles': 'off',
    },
  },
  {
    // An atom or a molecule reads no application state (src/components/atoms/
    // README.md). `ignores` names every file an earlier override speaks for:
    // this object replaces the rule's options, so without them it would re-ban
    // what those allow. The two store-reading files are on the reclassification
    // worklist.
    files: [
      'src/components/atoms/**/*.{ts,tsx}',
      'src/components/molecules/**/*.{ts,tsx}',
    ],
    ignores: [
      ...TEST_FILES,
      'src/components/atoms/themedComponents.tsx',
      'src/components/atoms/Text.tsx',
      'src/components/atoms/ThemedStatusBar.tsx',
      'src/components/molecules/Loading.tsx',
      'src/components/atoms/CachedImage.tsx',
      'src/components/molecules/Toast.tsx',
      'src/components/atoms/BottomSheetFormScrollView.tsx',
    ],
    rules: {
      'no-restricted-imports': restrictedImports({
        add: [
          {
            name: '#store/useAppStore',
            message:
              'An atom or molecule takes state as props; it does not read the store. If it genuinely needs application state it is an organism — move it to src/components/organisms/.',
          },
          {
            name: '#/store/useAppStore',
            message:
              'An atom or molecule takes state as props; it does not read the store. If it genuinely needs application state it is an organism — move it to src/components/organisms/.',
          },
        ],
      }),
    },
  },
  {
    // Device storage's writers: the kernel persisters, the reset manager and
    // the feature caches that register with it.
    files: [
      'src/apollo/**/*.{ts,tsx}',
      'src/storage/**/*.{ts,tsx}',
      'src/store/**/*.{ts,tsx}',
      'src/features/*/store/**/*.{ts,tsx}',
      'src/storage/__mocks__/**/*.{ts,tsx}',
    ],
    ignores: ['**/__tests__/**', '**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports({
        allow: { '#storage/mmkv': true, '#/storage/mmkv': true },
      }),
    },
  },
  {
    // The sheet machinery IS the guarded path the `present()` / `dismiss()` ban
    // points callers at. FolderPicker hands off between two STACKED sheets in
    // an order a `visible` boolean cannot express.
    files: [
      'src/hooks/useStandardBottomSheet.tsx',
      'src/hooks/useBottomSheetBackHandler.ts',
      'src/hooks/useBottomSheetBackdropClaim.ts',
      'src/components/templates/ActionTray/ActionTray.tsx',
      'src/features/recipes/components/FolderPicker.tsx',
    ],
    rules: {
      'no-restricted-syntax': restrictedSyntax({ allow: ['imperativeSheet'] }),
    },
  },
  {
    // Every TypeScript file that has a program (`TYPED`
    // above). A type-only import is `import type`, and an assertion the checker
    // already proves is dead weight that hides the next real type change.
    files: [
      'src/**/*.{ts,tsx}',
      'App.tsx',
      '__tests__/**/*.{ts,tsx}',
      'e2e/**/*.ts',
    ],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    },
  },
  {
    // `jest.requireActual<typeof import('…')>` and a mock factory's
    // `typeof import('…')` are how Jest types a module it replaces.
    files: [...TEST_FILES, 'e2e/**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { disallowTypeAnnotations: false },
      ],
    },
  },
  {
    // Type-checked safety for shipped code: no `any` flowing through, no
    // floating promises, no `!`, exhaustive switches. Every rule here was
    // brought to zero before it was enabled; docs/rules/README.md indexes them.
    files: ['src/**/*.{ts,tsx}', 'App.tsx'],
    ignores: [...TEST_FILES, '**/__mocks__/**', '**/__perf__/**'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      // Apollo hands back `ErrorLike` rather than `Error`; rethrowing it is the
      // library's contract, not a thrown literal.
      '@typescript-eslint/only-throw-error': [
        'error',
        {
          allow: [
            { from: 'package', package: '@apollo/client', name: 'ErrorLike' },
          ],
        },
      ],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/restrict-template-expressions': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description' },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      // A JSX handler returning a promise is how React Native components are
      // written; the attribute check would force a wrapper on every onPress.
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: false },
      ],
      '@typescript-eslint/no-unsafe-enum-comparison': 'error',
      '@typescript-eslint/no-base-to-string': 'error',
      // A blank string falls back through `firstNonBlank` (#/utils/firstNonBlank),
      // never `||`, which also swallows `0` and `false`.
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      'sous-chef/no-error-message-branching': 'error',
      'sous-chef/no-rendered-server-message': [
        'error',
        { followProjections: true },
      ],
      // Registered by the RN preset and never switched on. `no-color-literals`
      // reads style objects, where `sous-chef/no-raw-color` reads every literal
      // and `/colou?r$/i`-keyed prop, so they overlap rather than duplicate.
      'react-native/no-color-literals': 'error',
      'react-native/no-unused-styles': 'error',
      'sous-chef/no-raw-color': 'error',
      'sous-chef/no-raw-spacing': 'error',
      'sous-chef/text-needs-role': ['error', { readVariants: true }],
      'sous-chef/quantity-through-formatter': [
        'error',
        { followVariables: true },
      ],
      'sous-chef/no-rendered-enum': 'error',
      'sous-chef/no-t-default-value': 'error',
      'sous-chef/no-prose-literal': ['error', { followRendered: true }],
      'sous-chef/no-string-keyed-lookup': 'error',
      'sous-chef/no-number-noun-concat': 'error',
    },
  },
  {
    // Text no user reads: language endonyms, which ship untranslated by design,
    // and modules whose output is telemetry or a serialized error report.
    files: [
      'src/i18n/config.ts',
      'src/services/performance/**/*.{ts,tsx}',
      'src/services/telemetry/**/*.{ts,tsx}',
      'src/utils/errorSerialization.ts',
    ],
    rules: { 'sous-chef/no-prose-literal': 'off' },
  },
  {
    // The kit: `size` / `weight` / `lineHeight` are its escape hatches, and a
    // wrapper passes its caller's role through. Error copy still pairs there.
    // A later block decides the rule for every file it matches, exclusions included.
    files: ['src/components/**/*.{ts,tsx}'],
    ignores: [...TEST_FILES, '**/__mocks__/**', '**/__perf__/**'],
    rules: {
      'sous-chef/text-needs-role': [
        'error',
        { requireRole: false, readVariants: true },
      ],
    },
  },
  {
    // Where colours and the spacing scale are defined. `appConfig`'s
    // `branding.primaryColor` is the brand anchor the palette derives from.
    files: [
      'src/theme/**/*.ts',
      'src/theme/**/*.tsx',
      'src/config/appConfig.ts',
    ],
    rules: {
      'sous-chef/no-raw-color': 'off',
      'sous-chef/no-raw-spacing': 'off',
    },
  },
  {
    // The one module that reads message text: each predicate there is a library
    // whose signal exists nowhere else, pinned by a test driving that library.
    files: ['src/utils/errors/libraryErrorMessages.ts'],
    rules: { 'sous-chef/no-error-message-branching': 'off' },
  },
  {
    // Tests type their mocks loosely by design; what still bites there is an
    // un-awaited assertion and a comment that silences the checker.
    files: [...TEST_FILES, 'e2e/**/*.ts'],
    rules: {
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description' },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },
];

module.exports = { base, overrides };
