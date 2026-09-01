/**
 * An `overrides` block REPLACES a rule's config rather than merging it, so an
 * override that retypes a shorter `no-restricted-imports` list silently un-bans
 * everything it left out. Three bans were off in the bottom-sheet trio that way.
 * Overrides go through `restrictedImports({ allow })` so a drop is deliberate
 * and named; this asserts none reappears by omission.
 */
type PathEntry = { name: string; importNames?: string[] };
type RuleConfig = ['error', { paths: PathEntry[]; patterns: unknown[] }];
type Override = {
  files: string | string[];
  rules?: Record<string, RuleConfig | 'off' | undefined>;
};

const config = require('../../.eslintrc.js') as {
  rules: Record<string, RuleConfig>;
  overrides: Override[];
};

const RULE = 'no-restricted-imports';

/** Every module+name pair the config bans, as `<module>#<importName>`. */
const bannedPairs = (rule: RuleConfig) =>
  rule[1].paths.flatMap(entry =>
    entry.importNames
      ? entry.importNames.map(name => `${entry.name}#${name}`)
      : [`${entry.name}#*`],
  );

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
  '**/__tests__/**/*.{ts,tsx}': ['react-native#TextInput'],
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
