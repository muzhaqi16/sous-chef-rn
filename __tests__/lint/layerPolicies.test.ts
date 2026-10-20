/**
 * The layer boundary, exercised through the config that ships: a core
 * file imports only core and the allowed packages, type imports included, and
 * names no host-only global. Each case lints synthetic text at a real file's
 * path, so the type-aware parser has it in the program; a case that fails to
 * parse would pass vacuously.
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
const CORE_FILE = 'src/i18n/featureLocales.ts';

const CASES: Case[] = [
  {
    label: 'react-native, from core',
    filePath: CORE_FILE,
    code: `import { Platform as x } from 'react-native';\n${VALUE_USE}`,
    blocked: true,
  },
  {
    label: 'a mobile file, imported as a TYPE, from core',
    filePath: CORE_FILE,
    code: "import type { ToastPresenter as X } from '#components/molecules/Toast';\nexport type Y = X;\n",
    blocked: true,
  },
  {
    label: 'a package outside the core allow-list, from core',
    filePath: CORE_FILE,
    code: `import { createMMKV as x } from 'react-native-mmkv';\n${VALUE_USE}`,
    blocked: true,
  },
  {
    label: 'a host-only global, in core',
    filePath: CORE_FILE,
    code: 'export const y: unknown = window;\n',
    blocked: true,
  },
  {
    label: 'an allowed package, from core',
    filePath: CORE_FILE,
    code: `import x from 'i18next';\n${VALUE_USE}`,
    blocked: false,
  },
  {
    label: 'a core file, from core',
    filePath: CORE_FILE,
    code: `import { requirePlatform as x } from '#platform/install';\n${VALUE_USE}`,
    blocked: false,
  },
  {
    label: 'globalThis, in core',
    filePath: CORE_FILE,
    code: 'export const y: unknown = globalThis;\n',
    blocked: false,
  },
];

const LAYER_RULES = ['boundaries/dependencies', 'no-restricted-globals'];

/**
 * The composed config loads ESM-only graphql-eslint dependencies Jest cannot
 * transform, so it runs in a plain Node process.
 */
const lint = (cases: Case[]) => {
  const script = `
    const { ESLint } = require('eslint');
    const eslint = new ESLint();
    const cases = ${JSON.stringify(cases)};
    const rules = ${JSON.stringify(LAYER_RULES)};
    (async () => {
      const out = [];
      for (const c of cases) {
        const [result] = await eslint.lintText(c.code, { filePath: c.filePath });
        out.push({
          label: c.label,
          parseError: result.messages.some(m => !m.ruleId),
          blocked: result.messages.some(m => rules.includes(m.ruleId)),
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

describe('layer boundary', () => {
  const results = lint(CASES);

  it('parses every case, so none passes vacuously', () => {
    expect(results.filter(r => r.parseError).map(r => r.label)).toEqual([]);
    expect(results).toHaveLength(CASES.length);
  });

  it('blocks and allows exactly what the layer policy says', () => {
    expect(results.map(r => ({ label: r.label, blocked: r.blocked }))).toEqual(
      CASES.map(c => ({ label: c.label, blocked: c.blocked })),
    );
  });
});
