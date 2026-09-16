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

// A feature's public surface is `screens/`, `manifest.ts`, `testIDs.ts` and its
// top-level `hooks/`; the catalog also publishes `ui/`. Everything below is not.
// Each internal group is its own TYPE rather than one type with a captured
// directory: an `anyOf` inside a selector's `captured` throws inside the plugin
// (`template.replaceAll is not a function`), and it swallows that as a warning
// and ALLOWS the dependency.
const BOUNDARY_ELEMENTS = [
  {
    type: 'feature-private',
    pattern: 'src/features/*/(context|utils|components)/**',
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
      'src/(components|hooks|screens|apollo|utils|store|services|navigation)/**',
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
    from: { element: { type: 'shared' } },
    disallow: {
      to: { element: { type: 'feature-private' } },
      dependency: { kind: 'value' },
    },
    message:
      "Shared code must not import {{ to.element.captured.featureName }}'s internals (context/, hooks/mutations/, utils/, components/). A hook or component two features want belongs in src/hooks/ or src/components/; one feature's belongs in that feature. The catalog's PUBLIC UI is src/features/catalog/ui/.",
  },
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

  // ── The data layer stays out of what renders ──
  {
    target: [
      './src/features/*/screens/**',
      './src/features/*/components/**',
      './src/features/*/ui/**',
      './src/screens/**',
      './src/components/**',
    ],
    from: './src/apollo',
    message:
      "A screen, sheet or list cell must not import the data layer. Move the cache read/write into a hook in the feature's hooks/ directory and return plain values and callbacks. See CLAUDE.md and openspec data-layer-boundary.",
  },
];

module.exports = { BOUNDARY_ZONES, BOUNDARY_ELEMENTS, BOUNDARY_POLICIES };
