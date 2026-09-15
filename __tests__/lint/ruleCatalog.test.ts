import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Rule } from 'eslint';

/**
 * Every `sous-chef/*` rule has a doc page, a RuleTester spec and an `error`
 * somewhere in the config, and no rule in the composed config is a `warn`.
 */
const ROOT = path.join(__dirname, '..', '..');

const plugin = require('../../eslint/plugin/index.js') as {
  rules: Record<string, Rule.RuleModule>;
};
const project = require('../../eslint/project.js') as {
  base: { rules: Record<string, unknown> };
  overrides: Array<{ rules?: Record<string, unknown> }>;
};

const levelOf = (entry: unknown) => (Array.isArray(entry) ? entry[0] : entry);
const isError = (entry: unknown) => {
  const level = levelOf(entry);
  return level === 2 || level === 'error';
};

const ruleSets = [
  project.base.rules,
  ...project.overrides.map(o => o.rules ?? {}),
];
const names = Object.keys(plugin.rules);

describe('sous-chef rule catalog', () => {
  it('registers the rules', () => {
    expect(names.length).toBeGreaterThan(15);
  });

  it.each(names)('%s has a doc page, a spec and an error severity', name => {
    expect(plugin.rules[name]?.meta?.docs?.url).toBe(`docs/rules/${name}.md`);
    expect(fs.existsSync(path.join(ROOT, 'docs/rules', `${name}.md`))).toBe(
      true,
    );
    expect(
      fs.existsSync(path.join(ROOT, '__tests__/lint/rules', `${name}.test.ts`)),
    ).toBe(true);
    expect(ruleSets.some(rules => isError(rules[`sous-chef/${name}`]))).toBe(
      true,
    );
  });

  it('indexes every rule, and no page or spec outlives its rule', () => {
    const readme = fs.readFileSync(
      path.join(ROOT, 'docs/rules/README.md'),
      'utf8',
    );
    expect(names.filter(name => !readme.includes(`(${name}.md)`))).toEqual([]);

    const pages = fs
      .readdirSync(path.join(ROOT, 'docs/rules'))
      .filter(file => file !== 'README.md')
      .map(file => file.replace(/\.md$/, ''));
    const specs = fs
      .readdirSync(path.join(ROOT, '__tests__/lint/rules'))
      .map(file => file.replace(/\.test\.ts$/, ''));
    expect([...pages, ...specs].filter(n => !names.includes(n))).toEqual([]);
  });

  it('configures no rule as a warning, the preset included', () => {
    // The composed config loads ESM-only graphql-eslint dependencies Jest cannot
    // transform, so it is read in a plain Node process.
    const script = `
      const warnings = [];
      for (const config of require('./eslint.config.js'))
        for (const [id, entry] of Object.entries(config.rules ?? {})) {
          const level = Array.isArray(entry) ? entry[0] : entry;
          if (level === 1 || level === 'warn') warnings.push(id);
        }
      process.stdout.write(JSON.stringify(warnings));
    `;
    const output = execFileSync('node', ['-e', script], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(JSON.parse(output)).toEqual([]);
    expect(
      ruleSets.flatMap(rules =>
        Object.entries(rules).filter(([, entry]) => {
          const level = levelOf(entry);
          return level === 1 || level === 'warn';
        }),
      ),
    ).toEqual([]);
  });
});
