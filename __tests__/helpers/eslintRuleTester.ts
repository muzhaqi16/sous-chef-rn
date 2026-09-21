import { RuleTester } from 'eslint';
import type { Rule } from 'eslint';
import * as typescriptParser from '@typescript-eslint/parser';
import path from 'node:path';

const tester = new RuleTester({
  languageOptions: {
    parser: typescriptParser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

type RuleOptions = unknown[];

interface RuleCases {
  /** A bare string runs with the rule's default options. */
  valid: Array<string | { code: string; options: RuleOptions }>;
  invalid: Array<{ code: string; errors: string[]; options?: RuleOptions }>;
}

const casesFor = (cases: RuleCases, filename: string) => ({
  valid: cases.valid.map(entry =>
    typeof entry === 'string'
      ? { code: entry, filename }
      : { code: entry.code, options: entry.options, filename },
  ),
  invalid: cases.invalid.map(({ code, errors, options }) => ({
    code,
    filename,
    ...(options ? { options } : {}),
    errors: errors.map(messageId => ({ messageId })),
  })),
});

/** Runs a `sous-chef/*` rule from eslint/plugin/rules; every case parses as `.tsx`. */
export function testRule(name: string, cases: RuleCases) {
  const rule = require(`../../eslint/plugin/rules/${name}`) as Rule.RuleModule;
  tester.run(name, rule, casesFor(cases, 'case.tsx'));
}

const ROOT = path.join(__dirname, '..', '..');

const typedTester = new RuleTester({
  languageOptions: {
    parser: typescriptParser,
    parserOptions: {
      ecmaFeatures: { jsx: true },
      projectService: { allowDefaultProject: ['*.ts', '*.tsx'] },
      tsconfigRootDir: ROOT,
    },
  },
});

/** Like {@link testRule}, for a rule that reads types; cases parse as `.ts` unless given `tsx`. */
export function testTypedRule(
  name: string,
  cases: RuleCases,
  extension: 'ts' | 'tsx' = 'ts',
) {
  const rule = require(`../../eslint/plugin/rules/${name}`) as Rule.RuleModule;
  typedTester.run(
    name,
    rule,
    casesFor(cases, path.join(ROOT, `typed-rule-case.${extension}`)),
  );
}
