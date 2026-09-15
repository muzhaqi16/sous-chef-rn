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

interface RuleCases {
  valid: string[];
  invalid: Array<{ code: string; errors: string[] }>;
}

/** Runs a `sous-chef/*` rule from eslint/plugin/rules; every case parses as `.tsx`. */
export function testRule(name: string, cases: RuleCases) {
  const rule = require(`../../eslint/plugin/rules/${name}`) as Rule.RuleModule;
  tester.run(name, rule, {
    valid: cases.valid.map(code => ({ code, filename: 'case.tsx' })),
    invalid: cases.invalid.map(({ code, errors }) => ({
      code,
      filename: 'case.tsx',
      errors: errors.map(messageId => ({ messageId })),
    })),
  });
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
  const filename = path.join(ROOT, `typed-rule-case.${extension}`);
  typedTester.run(name, rule, {
    valid: cases.valid.map(code => ({ code, filename })),
    invalid: cases.invalid.map(({ code, errors }) => ({
      code,
      filename,
      errors: errors.map(messageId => ({ messageId })),
    })),
  });
}
