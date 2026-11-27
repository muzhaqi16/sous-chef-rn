/**
 * The feature API boundary, exercised through the config that ships.
 *
 * A policy that matches nothing reports nothing, which reads exactly like a
 * clean tree — so these assert what the boundary BLOCKS, not only what it
 * allows. Each case lints synthetic text at a real file's path: the type-aware
 * parser needs the file to be in the tsconfig program, and a path that is not
 * fails to parse, which would make every case pass vacuously.
 */
import { execFileSync } from 'node:child_process';
import * as path from 'node:path';

const ROOT = path.join(__dirname, '..', '..');

type Case = {
  label: string;
  filePath: string;
  code: string;
  blocked: boolean;
};

const VALUE_USE = 'export const y: unknown = x;\n';

const RECIPES_HOOK = 'src/features/recipes/hooks/useDeferredSearch.ts';

const CASES: Case[] = [
  {
    label: "another feature's utils, imported for a value",
    filePath: RECIPES_HOOK,
    code: `import { x } from '#features/pantry/utils/hybridSort';\n${VALUE_USE}`,
    blocked: true,
  },
  {
    label: "another feature's offline queue surface",
    filePath: RECIPES_HOOK,
    code: `import { x } from '#features/pantry/offline/replayPreparers';\n${VALUE_USE}`,
    blocked: true,
  },
  {
    label: "another feature's generated documents, imported for a value",
    filePath: RECIPES_HOOK,
    code: `import { x } from '#features/pantry/graphql/pantry.generated';\n${VALUE_USE}`,
    blocked: true,
  },
  {
    // The allowance that replaced a per-feature `except` list.
    label: "another feature's generated fragment, imported as a TYPE",
    filePath: RECIPES_HOOK,
    code: "import type { X } from '#entities/pantryItem/batches.generated';\nexport type Y = X;\n",
    blocked: false,
  },
  {
    label: "another feature's public hook",
    filePath: RECIPES_HOOK,
    code: `import { x } from '#features/pantry/hooks/pantryDataTypes';\n${VALUE_USE}`,
    blocked: false,
  },
  {
    // The capture negation: same feature, same directory, allowed.
    label: "the same feature's own internals",
    filePath: 'src/features/pantry/screens/FilteredPantryItems.tsx',
    code: `import { x } from '#features/pantry/utils/hybridSort';\n${VALUE_USE}`,
    blocked: false,
  },
  {
    label: "shared code reaching into a feature's utils",
    filePath: 'src/hooks/ui/useAppearance.ts',
    code: `import { x } from '#features/pantry/utils/hybridSort';\n${VALUE_USE}`,
    blocked: true,
  },
  {
    // `offline/` exists for the queue, and the queue IS shared code.
    label: 'the offline queue importing a feature’s replay preparers',
    filePath: 'src/apollo/offlineQueue/preparationRegistry.ts',
    code: `import { x } from '#features/pantry/offline/replayPreparers';\n${VALUE_USE}`,
    blocked: false,
  },
  {
    label: 'an entity reaching into a feature',
    filePath: 'src/entities/shoppingList/localMove.ts',
    code: `import { x } from '#features/pantry/utils/hybridSort';\n${VALUE_USE}`,
    blocked: true,
  },
  {
    label: 'a feature writing through an entity',
    filePath: 'src/features/receipts/hooks/useReceiptCheckIn.ts',
    code: `import { x } from '#entities/shoppingList/localMove';\n${VALUE_USE}`,
    blocked: false,
  },
  {
    // Matching by capture covers a feature nobody added to a list.
    label: 'a feature no zone ever enumerated',
    filePath: 'src/features/onboarding/hooks/useCompleteOnboarding.ts',
    code: `import { x } from '#features/pantry/utils/hybridSort';\n${VALUE_USE}`,
    blocked: true,
  },
  {
    label: 'a screen reaching into the data layer',
    filePath: 'src/features/profile/screens/MyReportsScreen.tsx',
    code: `import { x } from '#apollo/utils/settleMutation';\n${VALUE_USE}`,
    blocked: true,
  },
  {
    // A display query belongs to its UI, and so does the hook that runs it.
    label: 'a data hook beside the UI whose query it runs',
    filePath: 'src/features/profile/screens/useMyReports.ts',
    code: `import { x } from '#apollo/utils/settleMutation';\n${VALUE_USE}`,
    blocked: false,
  },
  {
    label: "another feature's cache writers",
    filePath: RECIPES_HOOK,
    code: `import { x } from '#features/pantry/cache/feedRows';\n${VALUE_USE}`,
    blocked: true,
  },
  {
    label: "shared code reaching into a feature's cache",
    filePath: 'src/i18n/localeTypes.ts',
    code: `import { x } from '#features/pantry/cache/feedRows';\n${VALUE_USE}`,
    blocked: true,
  },
  {
    // A type counts: the fragment ties the logic to the feature.
    label: "domain logic naming a feature's type",
    filePath: 'src/domain/items/createItemMapping.ts',
    code: "import type { X } from '#features/catalog/hooks/useItemForEdit.generated';\nexport type Y = X;\n",
    blocked: true,
  },

  // ── One door per internal ──
  {
    label: "React Native's TextInput outside the themed atom",
    filePath: 'src/components/molecules/SearchBar.tsx',
    code: `import { TextInput as x } from 'react-native';\n${VALUE_USE}`,
    blocked: true,
  },
  {
    label: "React Native's TextInput in the themed atom",
    filePath: 'src/components/atoms/themedComponents.tsx',
    code: `import { TextInput as x } from 'react-native';\n${VALUE_USE}`,
    blocked: false,
  },
  {
    label: "gorhom's text input in a sheet",
    filePath:
      'src/features/recipes/components/modals/IngredientMatchingSheet.tsx',
    code: `import { BottomSheetTextInput as x } from '@gorhom/bottom-sheet';\n${VALUE_USE}`,
    blocked: true,
  },
  {
    label: "gorhom's modal outside the wrapper",
    filePath: 'src/components/templates/Sheet.tsx',
    code: `import { BottomSheetModal as x } from '@gorhom/bottom-sheet';\n${VALUE_USE}`,
    blocked: true,
  },
  {
    label: 'a sheet rendering the wrapped modal itself',
    filePath:
      'src/features/recipes/components/modals/IngredientMatchingSheet.tsx',
    code: `import { useStandardBottomSheet as x } from '#hooks/ui/useStandardBottomSheet';\n${VALUE_USE}`,
    blocked: true,
  },
  {
    label: 'the shell rendering the wrapped modal',
    filePath: 'src/components/templates/Sheet.tsx',
    code: `import { useStandardBottomSheet as x } from '#hooks/ui/useStandardBottomSheet';\n${VALUE_USE}`,
    blocked: false,
  },
  {
    label: "the wrapper's types, beside the shell",
    filePath: 'src/components/templates/SheetCloseGuard.tsx',
    code: "import type { SheetDiscardGuard } from '#hooks/ui/useStandardBottomSheet';\nexport type Y = SheetDiscardGuard;\n",
    blocked: false,
  },
  {
    label: 'the raw keyboard scroller in a sheet',
    filePath:
      'src/features/recipes/components/modals/IngredientMatchingSheet.tsx',
    code: `import { x } from '#components/atoms/BottomSheetKeyboardAwareScrollView';\n${VALUE_USE}`,
    blocked: true,
  },
  {
    label: 'device storage from a screen',
    filePath: 'src/features/profile/screens/useMyReports.ts',
    code: `import { x } from '#store/deviceStorage';\n${VALUE_USE}`,
    blocked: true,
  },
  {
    label: 'device storage from a feature store',
    filePath: 'src/features/recipes/store/catalogFetchTimes.ts',
    code: `import { x } from '#store/deviceStorage';\n${VALUE_USE}`,
    blocked: false,
  },
  {
    label: 'the raw key-value store outside the composition root',
    filePath: 'src/store/resetManager.ts',
    code: `import { x } from '#native/storage/keyValueStore';\n${VALUE_USE}`,
    blocked: true,
  },
];

/**
 * The composed config loads ESM-only graphql-eslint dependencies Jest cannot
 * transform, so it runs in a plain Node process.
 */
const lint = (cases: Case[]) => {
  const script = `
    const { ESLint } = require('eslint');
    const eslint = new ESLint();
    const cases = ${JSON.stringify(cases)};
    (async () => {
      const out = [];
      for (const c of cases) {
        const [result] = await eslint.lintText(c.code, { filePath: c.filePath });
        out.push({
          label: c.label,
          parseError: result.messages.some(m => !m.ruleId),
          blocked: result.messages.some(
            m =>
              m.ruleId === 'boundaries/dependencies' ||
              m.ruleId === 'import/no-restricted-paths',
          ),
        });
      }
      process.stdout.write(JSON.stringify(out));
    })();
  `;
  const output = execFileSync('node', ['-e', script], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(output) as Array<{
    label: string;
    parseError: boolean;
    blocked: boolean;
  }>;
};

describe('feature API boundary', () => {
  const results = lint(CASES);

  it('parses every case, so none passes vacuously', () => {
    expect(results.filter(r => r.parseError).map(r => r.label)).toEqual([]);
    expect(results).toHaveLength(CASES.length);
  });

  it('blocks and allows exactly what the boundary says', () => {
    expect(results.map(r => ({ label: r.label, blocked: r.blocked }))).toEqual(
      CASES.map(c => ({ label: c.label, blocked: c.blocked })),
    );
  });
});
