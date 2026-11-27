/**
 * Architectural boundaries. Two mechanisms, split by what they can express.
 *
 * `boundaries/dependencies` (BOUNDARY_ELEMENTS + BOUNDARY_POLICIES) carries the
 * feature API boundary. It matches a feature by CAPTURE, so "another feature's
 * internals" is one policy rather than a pair of zones per feature, and a new
 * feature is covered the day its directory exists. A type-only import of a
 * generated fragment is `dependency.kind`, not a per-feature `except` list.
 *
 * `import/no-restricted-paths` (BOUNDARY_ZONES) carries what has no
 * same-vs-other axis: the kit's composition direction and the data layer.
 *
 * `docs/architecture.md` § The public API boundary carries the reasoning.
 */

const { CORE_EXTERNALS, LAYERS } = require('../scripts/lib/layers');

// The one statement of a feature's surface: the internal groups below are
// private, `offline/` belongs to the shared queue, and everything else a feature
// holds is public. Each internal group is its own TYPE rather than one type with a captured
// directory: an `anyOf` inside a selector's `captured` throws inside the plugin
// (`template.replaceAll is not a function`), and it swallows that as a warning
// and ALLOWS the dependency.
const BOUNDARY_ELEMENTS = [
  {
    type: 'feature-private',
    pattern: 'src/features/*/(context|utils|components|cache)/**',
    capture: ['featureName'],
    partialMatch: false,
  },
  {
    type: 'feature-private',
    pattern: 'src/features/*/hooks/mutations/**',
    capture: ['featureName'],
    partialMatch: false,
  },
  // The offline queue's surface. Shared code may import it — the queue IS
  // shared code — but another feature may not.
  {
    type: 'feature-queue',
    pattern: 'src/features/*/offline/**',
    capture: ['featureName'],
    partialMatch: false,
  },
  {
    type: 'feature-graphql',
    pattern: 'src/features/*/graphql/**',
    capture: ['featureName'],
    partialMatch: false,
  },
  {
    type: 'feature',
    pattern: 'src/features/*/**',
    capture: ['featureName'],
    partialMatch: false,
  },
  {
    type: 'shared',
    pattern:
      'src/(components|hooks|screens|apollo|utils|store|services|navigation|config|constants|context|graphql|i18n|native|platform|styles|theme|types|assets)/**',
    partialMatch: false,
  },
  // An entity several features write: importable by every feature, below all
  // of them.
  {
    type: 'entity',
    pattern: 'src/entities/*/**',
    capture: ['entityName'],
    partialMatch: false,
  },
  // Logic two or more features share, below every one of them.
  {
    type: 'domain',
    pattern: 'src/domain/**',
    partialMatch: false,
  },
  // The composition root, the core's start-up and the feature registries,
  // which wire every feature in.
  {
    type: 'root',
    pattern: 'src/(app|bootstrap)/**',
    partialMatch: false,
  },
  {
    type: 'root',
    pattern: 'src/features/*.ts',
    partialMatch: false,
  },
];

const FEATURE_INTERNALS = [
  'feature-private',
  'feature-queue',
  'feature-graphql',
];

const BOUNDARY_POLICIES = [
  {
    from: {
      element: { types: { anyOf: ['feature', ...FEATURE_INTERNALS] } },
    },
    disallow: {
      to: {
        element: {
          types: { anyOf: FEATURE_INTERNALS },
          captured: { featureName: '!{{ from.element.captured.featureName }}' },
        },
      },
      // A type-only import of a generated fragment is a feature's data
      // contract, not a reach into its internals.
      dependency: { kind: 'value' },
    },
    message:
      "Cross-feature import into {{ to.element.captured.featureName }}'s internals is not allowed. Use a public hook from src/features/{{ to.element.captured.featureName }}/hooks/, or compose your own GraphQL operation. Type imports from its *Fragments.generated.ts are allowed.",
  },
  {
    from: { element: { types: { anyOf: ['shared', 'root'] } } },
    disallow: {
      to: { element: { type: 'feature-private' } },
      dependency: { kind: 'value' },
    },
    message:
      "Shared code must not import {{ to.element.captured.featureName }}'s internals (context/, cache/, hooks/mutations/, utils/, components/). A hook or component two features want belongs in src/hooks/ or src/components/; one feature's belongs in that feature. The catalog's PUBLIC UI is src/features/catalog/ui/.",
  },
  {
    from: { element: { type: 'entity' } },
    disallow: {
      to: { element: { types: { anyOf: ['feature', ...FEATURE_INTERNALS] } } },
    },
    message:
      "An entity imports no feature: every feature that writes it sits above it. Move what it needs into the entity, or into src/domain/ when it is not the entity's own.",
  },
  // A type counts: a feature's fragment type ties the logic to that feature.
  {
    from: { element: { type: 'domain' } },
    disallow: {
      to: { element: { types: { anyOf: ['feature', ...FEATURE_INTERNALS] } } },
    },
    message:
      'Domain logic sits below every feature that shares it, so it imports none of them, a type included. Take the shape it reads as its own type and map to it in the feature, or move the logic into the feature.',
  },
];

const MMKV_MESSAGE =
  'Device storage belongs to the kernel persisters and the reset manager. A key written elsewhere is one `SESSION_SCOPED_STATE` does not know about, so a sign-out leaves it behind — put the value in a store slice, or register a feature store with `registerSessionScopedStore`.';

/**
 * A module with one door: only the files listed may import it, or the names
 * listed from it. Every other source file is caught, the day it appears.
 */
const oneDoor = ({ doors, to, specifiers, message }) => ({
  // micromatch leaves a one-item brace unexpanded, matching nothing.
  from: {
    file: {
      path: doors.length > 1 ? `!{${doors.join(',')}}` : `!${doors[0]}`,
    },
  },
  disallow: { to, ...(specifiers && { dependency: { specifiers } }) },
  message,
});

const ONE_DOOR_POLICIES = [
  // ── One text input ──
  oneDoor({
    doors: ['src/components/atoms/themedComponents.tsx'],
    to: { module: { source: 'react-native' } },
    specifiers: 'TextInput',
    message:
      "Use ThemedTextInput from #components/atoms/themedComponents. It carries the theme and, inside a bottom sheet, renders gorhom's input, without which the sheet cannot see the keyboard. For a ref type, import `type { ThemedTextInputRef }` from the same atom.",
  }),
  oneDoor({
    doors: ['src/components/atoms/themedComponents.tsx'],
    to: { module: { source: '@gorhom/bottom-sheet' } },
    specifiers: 'BottomSheetTextInput',
    message:
      "Use ThemedTextInput from #components/atoms/themedComponents: inside a sheet it renders gorhom's input itself, and outside one gorhom's throws.",
  }),

  // The raw scroller gives a sheet the keyboard offset but not the input
  // context the form scroll view adds.
  oneDoor({
    doors: ['src/components/atoms/BottomSheetFormScrollView.tsx'],
    to: {
      file: {
        path: 'src/components/atoms/BottomSheetKeyboardAwareScrollView.tsx',
      },
    },
    message:
      'Use BottomSheetFormScrollView from #components/atoms/BottomSheetFormScrollView. The raw scroller supplies the keyboard offset but not the input context, so the sheet cannot see the keyboard. See CLAUDE.md § Bottom sheets.',
  }),

  // ── One sheet ──
  oneDoor({
    doors: ['src/hooks/ui/useStandardBottomSheet.tsx'],
    to: { module: { source: '@gorhom/bottom-sheet' } },
    specifiers: 'BottomSheetModal',
    message:
      "Render a sheet with Sheet from #components/templates/Sheet. gorhom's modal is wrapped once, themed and holding the global backdrop claim, in #hooks/ui/useStandardBottomSheet.",
  }),
  oneDoor({
    doors: [
      'src/components/templates/Sheet.tsx',
      'src/components/templates/ActionTray/ActionTray.tsx',
    ],
    to: { file: { path: 'src/hooks/ui/useStandardBottomSheet.tsx' } },
    specifiers: ['BottomSheetModal', 'useStandardBottomSheet'],
    message:
      'Render a sheet with Sheet from #components/templates/Sheet, driven by `visible` and `onDismiss`. It settles the backdrop, snap points, keyboard host and header; a sheet it does not fit grows it an option. See docs/ui-layer.md § Sheet.',
  }),
  oneDoor({
    doors: ['src/hooks/ui/useStandardBottomSheet.tsx'],
    to: { file: { path: 'src/hooks/ui/useBottomSheetBackdropClaim.ts' } },
    message:
      'useBottomSheetBackdropClaim is an internal helper for useStandardBottomSheet, which wires animatedIndex, onChange, the back handler, focus-aware dismiss-on-blur and theme styles together. Render the sheet with Sheet from #components/templates/Sheet.',
  }),

  // ── One device storage ──
  oneDoor({
    doors: [
      'src/apollo/**',
      'src/services/auth/deviceId.ts',
      'src/store/**',
      'src/features/*/store/**',
    ],
    to: { file: { path: 'src/store/deviceStorage.ts' } },
    message: MMKV_MESSAGE,
  }),
  // The raw MMKV instance and its adapter: only the composition root installs
  // them, as the key-value store port that `#store/deviceStorage` reads.
  oneDoor({
    doors: ['src/native/storage/keyValueStore.ts'],
    to: { file: { path: 'src/native/storage/mmkv.ts' } },
    message: MMKV_MESSAGE,
  }),
  oneDoor({
    doors: ['src/app/installNativePlatform.ts'],
    to: { file: { path: 'src/native/storage/keyValueStore.ts' } },
    message: MMKV_MESSAGE,
  }),
];

// ── The data layer stays out of what renders ──
const DATA_LAYER_ZONE = {
  target: [
    './src/features/*/screens/**',
    './src/features/*/components/**',
    './src/features/*/ui/**',
    './src/screens/**',
    './src/components/**',
  ],
  from: './src/apollo',
  message:
    "A screen, sheet or list cell must not import the data layer. Move the cache read/write into a hook in the feature's hooks/ directory, or one beside the UI that owns its query, and return plain values and callbacks. See CLAUDE.md and openspec data-layer-boundary.",
};

/**
 * A data hook beside the UI whose query it runs: a display query belongs to
 * that UI, so its hook does too. It is held to the feature-hook rules, and the
 * data-layer zone does not apply to it.
 */
const COLOCATED_DATA_HOOKS = [
  'src/features/*/{screens,components,ui}/**/use*.{ts,tsx}',
];

const BOUNDARY_ZONES = [
  // ── Composition direction inside the kit ──
  //
  // `src/components/atoms/README.md` states the levels; these zones enforce the
  // direction only. Each `except` is a named upward import that goes away when
  // the buckets are reclassified.
  {
    target: './src/components/atoms/**',
    from: './src/components/molecules',
    // QuantityDisplay is a bare View + Text that belongs at the atom level.
    except: ['./QuantityDisplay.tsx'],
    message:
      'An atom composes nothing but RN primitives, Text and other atoms. Importing a molecule makes this a molecule — move it to src/components/molecules/. See src/components/atoms/README.md.',
  },
  {
    target: './src/components/atoms/**',
    from: ['./src/components/organisms', './src/components/templates'],
    message:
      'An atom composes nothing but RN primitives, Text and other atoms. See src/components/atoms/README.md.',
  },
  {
    target: './src/components/molecules/**',
    from: './src/components/templates',
    // ModalPicker presents its list inside the ActionTray overlay, an organism
    // filed under templates.
    except: ['./ActionTray/ActionTray.tsx', './ActionTray/types.ts'],
    message:
      'A molecule composes atoms. Importing a template inverts the composition order — move the consumer up to organisms/, or the dependency down. See src/components/atoms/README.md.',
  },
  {
    target: './src/components/molecules/**',
    from: './src/components/organisms',
    message:
      'A molecule composes atoms. Importing an organism inverts the composition order — move the consumer up to organisms/. See src/components/atoms/README.md.',
  },

  DATA_LAYER_ZONE,
];

/** Every zone but the data layer's, for `COLOCATED_DATA_HOOKS`. */
const COLOCATED_DATA_HOOK_ZONES = BOUNDARY_ZONES.filter(
  zone => zone !== DATA_LAYER_ZONE,
);

// ── Layers ──
//
// File categories, independent of the elements above: `core` or `mobile` for
// every src file, from `scripts/lib/layers.js`. `docs/architecture.md` § Layers.
const LAYER_FILES = LAYERS.flatMap(entry =>
  entry.patterns.map(pattern => ({ category: entry.layer, pattern })),
);

// No `dependency.kind`: a type import ties core to mobile as surely as a value.
const LAYER_POLICIES = [
  {
    from: { file: { categories: 'core' } },
    disallow: { to: { file: { categories: 'mobile' } } },
    message:
      'Core code runs without React Native and imports only core. Reach the device through a port in src/platform/, or move this file to the mobile layer. See docs/architecture.md § Layers.',
  },
  {
    from: { file: { categories: 'core' } },
    disallow: {
      to: {
        module: {
          origin: 'external',
          source: `!{${CORE_EXTERNALS.join(',')}}`,
        },
      },
    },
    message:
      'Core code imports only external modules that run without React Native (CORE_EXTERNALS in scripts/lib/layers.js). Reach the device through a port in src/platform/.',
  },
  // `origin: 'core'` is the plugin's name for Node's built-ins, `node:` or not.
  {
    from: { file: { categories: 'core' } },
    disallow: { to: { module: { origin: 'core' } } },
    message:
      'Core code runs without Node, so it imports no Node built-in (fs, crypto, path, …). Reach the host through a port in src/platform/.',
  },
];

const restrictedGlobals = (names, message) =>
  names.map(name => ({ name, message }));

const CORE_RESTRICTED_GLOBALS = [
  // Globals one host has and another lacks; `globalThis` is the portable spelling.
  ...restrictedGlobals(
    [
      'window',
      'document',
      'navigator',
      'localStorage',
      'sessionStorage',
      'location',
      'alert',
      'confirm',
      'global',
    ],
    'Core code runs in every host. Use `globalThis`, or reach the host through a port in src/platform/.',
  ),
  // React Native and most browsers have them; Safari and node do not.
  ...restrictedGlobals(
    ['requestIdleCallback', 'cancelIdleCallback'],
    'Safari and node have no idle callbacks. Use `scheduleIdle` from #utils/scheduleIdle.',
  ),
  // Node's own globals, which React Native does not have.
  ...restrictedGlobals(
    ['process', 'Buffer', 'setImmediate', '__dirname', '__filename', 'require'],
    'Core code runs without Node. Read build values through the `environment` port, and import modules with `import`.',
  ),
];

const CORE_PATTERNS = LAYERS.filter(entry => entry.layer === 'core').flatMap(
  entry => entry.patterns,
);

module.exports = {
  BOUNDARY_ZONES,
  COLOCATED_DATA_HOOKS,
  COLOCATED_DATA_HOOK_ZONES,
  BOUNDARY_ELEMENTS,
  BOUNDARY_POLICIES,
  ONE_DOOR_POLICIES,
  LAYER_FILES,
  LAYER_POLICIES,
  CORE_RESTRICTED_GLOBALS,
  CORE_PATTERNS,
};
