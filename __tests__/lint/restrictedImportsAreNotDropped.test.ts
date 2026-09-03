/**
 * An `overrides` block REPLACES a rule's config rather than merging it, so an
 * override that retypes a shorter `no-restricted-imports` list silently un-bans
 * everything it left out. Three bans were off in the bottom-sheet trio that way.
 * Overrides go through `restrictedImports({ allow })` so a drop is deliberate
 * and named; this asserts none reappears by omission.
 */
type PathEntry = { name: string; importNames?: string[] };
type PatternEntry = { group: string[]; importNames?: string[] };
type RuleConfig = ['error', { paths: PathEntry[]; patterns: PatternEntry[] }];
type Override = {
  files: string | string[];
  rules?: Record<string, RuleConfig | 'off' | undefined>;
};

const config = require('../../.eslintrc.js') as {
  rules: Record<string, RuleConfig>;
  overrides: Override[];
};

const RULE = 'no-restricted-imports';

/**
 * Every module+name pair the config bans, as `<module>#<importName>`.
 *
 * `patterns` counts alongside `paths`: an override replaces the whole rule
 * config, so a redeclared rule that omits the patterns array un-bans every
 * generated fragment for those files exactly as omitting a path un-bans a
 * module. Reading only `paths` makes this check blind to the half the
 * docblock above names as its motivation.
 */
const bannedPairs = (rule: RuleConfig) => [
  ...rule[1].paths.flatMap(entry =>
    entry.importNames
      ? entry.importNames.map(name => `${entry.name}#${name}`)
      : [`${entry.name}#*`],
  ),
  ...(rule[1].patterns ?? []).flatMap(entry =>
    entry.importNames
      ? entry.importNames.map(name => `${entry.group.join(',')}#${name}`)
      : [`${entry.group.join(',')}#*`],
  ),
];

/**
 * An override may legitimately allow a ban — a re-export site, or a test
 * standing in for an input. Each entry states which file set allows what.
 */
const ALLOWED_DROPS: Record<string, string[]> = {
  'src/hooks/useStandardBottomSheet.tsx': [
    '@gorhom/bottom-sheet#BottomSheetModal',
    '@gorhom/bottom-sheet#BottomSheetTextInput',
    '#hooks/useBottomSheetBackdropClaim#*',
  ],
  '**/__tests__/**/*.{ts,tsx}': [
    'react-native#TextInput',
    'react-native#ActivityIndicator',
    '#/i18n/config#getI18n',
    'react-native-permissions#*',
    'react-native-turbo-image#*',
  ],
  'src/utils/dateLocale.ts': ['#/i18n/config#getI18n'],
  'src/hooks/navigation/useAppNavigation.ts': [
    '@react-navigation/native#useNavigation',
  ],
  'src/components/atoms/Loading.tsx': ['react-native#ActivityIndicator'],
  // This file IS the wrapper: it composes the raw scroller with the input
  // context, which is the whole reason every other sheet is banned from it.
  'src/components/atoms/BottomSheetFormScrollView.tsx': [
    '#components/atoms/BottomSheetKeyboardAwareScrollView#*',
  ],
  'src/services/permissions/PermissionService.ts': [
    'react-native-permissions#*',
    'react-native-turbo-image#*',
    '@react-native-vector-icons/ionicons#*',
  ],
};

const base = config.rules[RULE];

const activeOverrides = config.overrides.filter(
  (o): o is Override & { rules: Record<string, RuleConfig> } => {
    const rule = o.rules?.[RULE];
    return Array.isArray(rule);
  },
);

describe('no-restricted-imports overrides', () => {
  it('finds the rule and the overrides that redeclare it', () => {
    // A config that stopped declaring the rule would pass every check below.
    expect(bannedPairs(base).length).toBeGreaterThan(10);
    expect(activeOverrides.length).toBeGreaterThan(1);
  });

  it('reads both halves of the rule, so neither can be dropped unseen', () => {
    // Each half alone is a scan that passes identically whether its contract
    // holds or its array was emptied.
    expect(base[1].paths.length).toBeGreaterThan(0);
    expect(base[1].patterns.length).toBeGreaterThan(0);
    expect(bannedPairs(base).some(p => p.includes('*Fragments.generated'))).toBe(
      true,
    );
  });

  it('bans a raw TextInput, which is what makes an input themed by default', () => {
    expect(bannedPairs(base)).toEqual(
      expect.arrayContaining([
        'react-native#TextInput',
        '@gorhom/bottom-sheet#BottomSheetTextInput',
      ]),
    );
  });

  it('keeps every base ban in every override that redeclares the rule', () => {
    const baseBans = bannedPairs(base);

    const dropped = activeOverrides.flatMap(override => {
      const files = [override.files].flat();
      const allowed = files.flatMap(f => ALLOWED_DROPS[f] ?? []);
      const kept = new Set(bannedPairs(override.rules[RULE]));

      return baseBans
        .filter(ban => !kept.has(ban) && !allowed.includes(ban))
        .map(ban => `${files[0]} drops ${ban}`);
    });

    expect(dropped).toEqual([]);
  });

  it('keeps the allowed-drop list honest', () => {
    const globs = activeOverrides.flatMap(o => [o.files].flat());
    const stale = Object.keys(ALLOWED_DROPS).filter(f => !globs.includes(f));

    expect(stale).toEqual([]);
  });
});
