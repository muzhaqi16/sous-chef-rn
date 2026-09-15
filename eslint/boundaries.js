/**
 * `import/no-restricted-paths` zones: the feature API boundary, the composition
 * direction inside the kit, the shared layer reaching into a feature, and the
 * data layer staying out of what renders. `docs/architecture.md` § The public
 * API boundary carries the reasoning.
 *
 * One zone per feature, because "same feature" cannot be expressed as a glob.
 * A `from` path may name a directory that does not exist yet: the boundary is
 * declared before anyone creates it, so the first import is blocked rather
 * than grandfathered. Do not prune them.
 */
const SHARED_LAYER = [
  './src/components/**',
  './src/hooks/**',
  './src/screens/**',
  './src/apollo/**',
  './src/utils/**',
  './src/store/**',
  './src/services/**',
  './src/navigation/**',
];

const BOUNDARY_ZONES = [
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
      './src/features/pantry/components',
      './src/features/pantry/offline',
    ],
    message:
      "Cross-feature import into pantry internals (context/, hooks/mutations/, utils/, components/, offline/) is not allowed. Use a public hook from src/features/pantry/hooks/. offline/ is the offline queue's surface, not another feature's.",
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
      './src/features/shoppingList/components',
      './src/features/shoppingList/offline',
    ],
    message:
      "Cross-feature import into shoppingList internals (context/, hooks/mutations/, utils/, components/, offline/) is not allowed. Use a public hook from src/features/shoppingList/hooks/. offline/ is the offline queue's surface, not another feature's.",
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
      './src/features/recipes/components',
    ],
    message:
      'Cross-feature import into recipes internals (context/, hooks/mutations/, utils/, components/) is not allowed. Use a public hook from src/features/recipes/hooks/.',
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
      './src/features/mealPlan/components',
    ],
    message:
      'Cross-feature import into mealPlan internals (context/, hooks/mutations/, utils/, components/) is not allowed. Use a public hook from src/features/mealPlan/hooks/.',
  },
  // barcode
  {
    target: './src/features/!(barcode)/**',
    from: [
      './src/features/barcode/context',
      './src/features/barcode/hooks/mutations',
      './src/features/barcode/utils',
      './src/features/barcode/graphql',
      './src/features/barcode/components',
    ],
    message:
      'Cross-feature import into barcode internals (context/, hooks/mutations/, utils/, graphql/, components/) is not allowed. Use a public hook from src/features/barcode/hooks/, or compose your own GraphQL operation.',
  },
  // catalog — `ui/` is its PUBLIC component directory, so it is absent here.
  {
    target: './src/features/!(catalog)/**',
    from: [
      './src/features/catalog/context',
      './src/features/catalog/hooks/mutations',
      './src/features/catalog/utils',
      './src/features/catalog/components',
    ],
    message:
      'Cross-feature import into catalog internals (context/, hooks/mutations/, utils/, components/) is not allowed. The catalog exposes UI through src/features/catalog/ui/ and behaviour through its top-level hooks/ — see src/features/catalog/README.md.',
  },
  // notifications
  {
    target: './src/features/!(notifications)/**',
    from: [
      './src/features/notifications/context',
      './src/features/notifications/hooks/mutations',
      './src/features/notifications/utils',
      './src/features/notifications/graphql',
      './src/features/notifications/components',
    ],
    message:
      'Cross-feature import into notifications internals (context/, hooks/mutations/, utils/, graphql/, components/) is not allowed. Use a public hook from src/features/notifications/hooks/, or compose your own GraphQL operation.',
  },
  // profile
  {
    target: './src/features/!(profile)/**',
    from: [
      './src/features/profile/context',
      './src/features/profile/hooks/mutations',
      './src/features/profile/utils',
      './src/features/profile/graphql',
      './src/features/profile/components',
    ],
    message:
      'Cross-feature import into profile internals (context/, hooks/mutations/, utils/, graphql/, components/) is not allowed. Use a public hook from src/features/profile/hooks/, or compose your own GraphQL operation.',
  },
  // home
  {
    target: './src/features/!(home)/**',
    from: [
      './src/features/home/context',
      './src/features/home/hooks/mutations',
      './src/features/home/utils',
      './src/features/home/graphql',
      './src/features/home/components',
    ],
    message:
      'Cross-feature import into home internals (context/, hooks/mutations/, utils/, graphql/, components/) is not allowed. Use a public hook from src/features/home/hooks/, or compose your own GraphQL operation.',
  },

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

  // ── The SHARED layer reaching into a feature ──
  //
  // `graphql/` is deliberately not listed: the offline queue replays every
  // feature's Sync mutations and the subscription layer mounts every feature's
  // event subscription, so generated documents are a feature's data contract.
  // `offline/` exists only for the queue, which imports it.
  {
    target: SHARED_LAYER,
    from: [
      './src/features/pantry/context',
      './src/features/pantry/hooks/mutations',
      './src/features/pantry/utils',
      './src/features/recipes/context',
      './src/features/recipes/hooks/mutations',
      './src/features/recipes/utils',
      './src/features/mealPlan/context',
      './src/features/mealPlan/hooks/mutations',
      './src/features/mealPlan/utils',
      './src/features/barcode/context',
      './src/features/barcode/hooks/mutations',
      './src/features/barcode/utils',
      './src/features/notifications/context',
      './src/features/notifications/hooks/mutations',
      './src/features/notifications/utils',
      './src/features/profile/context',
      './src/features/profile/hooks/mutations',
      './src/features/profile/utils',
      './src/features/home/context',
      './src/features/home/hooks/mutations',
      './src/features/home/utils',
      './src/features/shoppingList/context',
      './src/features/shoppingList/utils',
    ],
    message:
      "Shared code must not import a feature's internals (context/, hooks/mutations/, utils/). A hook owned by one feature belongs in that feature; src/hooks/ and src/components/ hold only what more than one feature uses. Either move the consumer into the feature, or move the thing it needs up to src/hooks/ or src/utils/.",
  },
  {
    target: SHARED_LAYER,
    from: './src/features/pantry/components',
    // A type-only import in a pantry-specific validator that is itself on the
    // worklist to move into the feature.
    except: ['./modals/PantryActionModal.tsx'],
    message:
      "Shared code must not import a feature's components/. A component two features want belongs in src/components/; one feature's belongs in that feature.",
  },
  {
    target: SHARED_LAYER,
    from: [
      './src/features/shoppingList/components',
      './src/features/recipes/components',
      './src/features/mealPlan/components',
      './src/features/barcode/components',
      './src/features/notifications/components',
      './src/features/profile/components',
      './src/features/home/components',
      './src/features/catalog/components',
    ],
    message:
      "Shared code must not import a feature's components/. A component two features want belongs in src/components/; one feature's belongs in that feature. The catalog's PUBLIC UI is src/features/catalog/ui/, not components/.",
  },
  {
    target: SHARED_LAYER,
    from: './src/features/shoppingList/hooks/mutations',
    message:
      'Shared code must not import shoppingList/hooks/mutations/. Move the consumer into the feature, or the dependency up to src/hooks/.',
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

module.exports = { BOUNDARY_ZONES };
