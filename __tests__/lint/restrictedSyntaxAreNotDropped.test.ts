/**
 * A config object that sets a rule REPLACES its options rather than merging
 * them, so an override that retypes a shorter `no-restricted-syntax` list
 * silently un-bans everything it left out. Overrides go through
 * `restrictedSyntax({ allow })` so a drop is deliberate and named; this asserts
 * none appears by omission.
 */
export {};

type Entry = { selector: string; message: string };
type RuleConfig = ['error', ...Entry[]];
type Override = {
  files: string | string[];
  rules?: Record<string, unknown>;
};

const project = require('../../eslint/project.js') as {
  base: { rules: Record<string, RuleConfig> };
  overrides: Override[];
};
const syntax = require('../../eslint/restrictedSyntax.js') as {
  PRODUCTION_SYNTAX: Array<{ id: string; selector: string }>;
  TEST_SYNTAX: Array<{ id: string; selector: string }>;
};

const RULE = 'no-restricted-syntax';

const selectorsOf = (rule: RuleConfig) =>
  (rule.slice(1) as Entry[]).map(e => e.selector);

const TEST_SELECTORS = syntax.TEST_SYNTAX.map(e => e.selector);

const selectorFor = (id: string) =>
  [...syntax.PRODUCTION_SYNTAX, ...syntax.TEST_SYNTAX].find(e => e.id === id)
    ?.selector;

/**
 * An override may legitimately allow a ban — the module that IS the mechanism
 * the entry points at. Each entry states which file set allows which id.
 */
const ALLOWED_DROPS: Record<string, string[]> = {
  'src/utils/parseDecimalInput.ts': ['parseFloat'],
  'src/hooks/useStandardBottomSheet.tsx': ['imperativeSheet'],
};

const base = project.base.rules[RULE];

const activeOverrides = project.overrides.filter(
  (o): o is Override & { rules: Record<string, RuleConfig> } =>
    Array.isArray(o.rules?.[RULE]),
);

// Test files swap the production list for the test-only one wholesale; every
// other override is narrowing the production list.
const isTestSwap = (rule: RuleConfig) =>
  selectorsOf(rule).every(s => TEST_SELECTORS.includes(s));

describe('no-restricted-syntax overrides', () => {
  it('finds the rule and the overrides that redeclare it', () => {
    // A config that stopped declaring the rule would pass every check below.
    expect(selectorsOf(base!).length).toBeGreaterThan(10);
    expect(activeOverrides.length).toBeGreaterThan(1);
    expect(
      activeOverrides.filter(o => isTestSwap(o.rules[RULE]!)),
    ).toHaveLength(1);
  });

  it('keeps every production entry in every override that narrows the list', () => {
    const baseSelectors = selectorsOf(base!);

    const dropped = activeOverrides
      .filter(o => !isTestSwap(o.rules[RULE]!))
      .flatMap(override => {
        const files = [override.files].flat();
        const allowed = files
          .flatMap(file => ALLOWED_DROPS[file] ?? [])
          .map(selectorFor);
        const kept = new Set(selectorsOf(override.rules[RULE]!));

        return baseSelectors
          .filter(s => !kept.has(s) && !allowed.includes(s))
          .map(s => `${files[0]} drops ${s}`);
      });

    expect(dropped).toEqual([]);
  });

  it('keeps the whole test-only list on test files', () => {
    const swap = activeOverrides.find(o => isTestSwap(o.rules[RULE]!));
    expect(selectorsOf(swap!.rules[RULE]!)).toEqual(TEST_SELECTORS);
  });

  it('keeps the allowed-drop list honest', () => {
    const globs = activeOverrides.flatMap(o => [o.files].flat());
    expect(Object.keys(ALLOWED_DROPS).filter(f => !globs.includes(f))).toEqual(
      [],
    );
    expect(
      Object.values(ALLOWED_DROPS)
        .flat()
        .filter(id => !selectorFor(id)),
    ).toEqual([]);
  });
});
