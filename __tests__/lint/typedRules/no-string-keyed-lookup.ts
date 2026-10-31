import { RuleTester } from 'eslint';
import type { Rule } from 'eslint';
import * as typescriptParser from '@typescript-eslint/parser';
import path from 'node:path';
import { testTypedRule } from '#/test-utils/eslintRuleTester';

const TONE = "type Tone = 'info' | 'warn';\n";
const STATUS = "enum Status { On = 'ON', Off = 'OFF' }\n";

testTypedRule('no-string-keyed-lookup', {
  valid: [
    // Keyed by the enum: a missing member is a compile error.
    `${STATUS}const LABEL: Record<Status, string> = { [Status.On]: 'on', [Status.Off]: 'off' };\nexport const label = (s: Status) => LABEL[s];`,
    // An inferred literal type keeps its keys, so reads are checked.
    `${TONE}const ICON = { info: 'i', warn: 'w' };\nexport const icon = (t: Tone) => ICON[t];`,
    // An object guard and a JSON blob: no closed key set exists.
    'export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;',
    'const blob: Record<string, unknown> = { a: 1 };\nexport const read = (k: string) => blob[k];',
    'export const EMPTY: Record<string, never> = {};',
    // Populated at runtime.
    'export function count(xs: string[]) {\n  const counts: Record<string, number> = {};\n  for (const x of xs) counts[x] = (counts[x] ?? 0) + 1;\n  return counts;\n}',
    "export function header(token: string, name: string) {\n  const headers: Record<string, string> = { accept: 'json' };\n  headers.authorization = token;\n  return headers[name];\n}",
    "const seen: Map<string, number> = new Map([['a', 1]]);\nexport const mark = (k: string) => { seen.set(k, 2); return seen.get(k); };",
    'export const cache = new Map<string, number>();',
    'declare const rows: Array<[string, number]>;\nexport const byRow = new Map<string, number>(rows);',
    // A bag handed over whole is not a lookup.
    "declare function send(h: Record<string, string>): void;\nexport function go() {\n  const headers: Record<string, string> = { accept: 'json' };\n  send(headers);\n}",
    // Spread or a runtime computed key: the key set is not closed.
    "declare const base: Record<string, string>;\nexport const merged: Record<string, string> = { ...base, a: 'b' };",
    'declare const id: string;\nexport const byId: Record<string, number> = { [id]: 1 };',
    // An index signature describing external JSON.
    "export interface Payload { [key: string]: string }\ndeclare const payload: Payload;\nexport const field = (k: 'a') => payload[k];",
    // A named preset read by property: `satisfies` keeps its keys.
    'export const PRESETS = { full: { ms: 1 }, subtle: { ms: 2 } } satisfies Record<string, { ms: number }>;\nexport const ms = PRESETS.full.ms;',
    // A contract declared elsewhere (a library's index-signature type) is filled, not chosen.
    "import type { TypePolicies } from '@apollo/client';\nexport const policies: TypePolicies = { Item: { merge: true } };",
    // A properly keyed table widened for a read with a runtime string.
    `${TONE}const ICON: Record<Tone, string> = { info: 'i', warn: 'w' };\nexport const icon = (t: string) => { const open: Partial<Record<string, string>> = ICON; return open[t]; };`,
  ],
  invalid: [
    {
      code: `${TONE}const ICON: Record<string, string> = { info: 'i', warn: 'w' };\nexport const icon = (t: Tone) => ICON[t];`,
      errors: ['closedTable', 'finiteKeyRead'],
    },
    {
      code: `${STATUS}const LABEL: Partial<Record<string, string>> = { [Status.On]: 'on', [Status.Off]: 'off' };\nexport const label = (s: Status) => LABEL[s];`,
      errors: ['closedTable', 'finiteKeyRead'],
    },
    {
      code: 'const UNIT: { [unit: string]: number } = { g: 1, kg: 1000 };\nexport const factor = (unit: string) => UNIT[unit];',
      errors: ['closedTable'],
    },
    {
      code: "const CURRENCY: Record<string, string> & { fallback: string } = { US: 'USD', fallback: 'EUR' };\nexport const currency = (region: string) => (region in CURRENCY ? CURRENCY[region] : CURRENCY.fallback);",
      errors: ['closedTable'],
    },
    {
      code: "export const REGION: Readonly<Record<string, string>> = { US: 'USD', GB: 'GBP' };",
      errors: ['closedTable'],
    },
    {
      code: `${TONE}const ICON = { info: 'i', warn: 'w' } satisfies Record<string, string>;\nexport const icon = (t: Tone) => ICON[t];`,
      errors: ['closedTable', 'finiteKeyRead'],
    },
    {
      code: `${TONE}const ICON: ReadonlyMap<string, string> = new Map([['info', 'i'], ['warn', 'w']]);\nexport const icon = (t: Tone) => ICON.get(t);`,
      errors: ['closedTable', 'finiteKeyRead'],
    },
    {
      code: "const SIZE = new Map([['sm', 1], ['lg', 2]]);\nexport const size = (k: string) => SIZE.get(k);",
      errors: ['closedTable'],
    },
    {
      code: `export function label(t: 'x' | 'y') {\n  const LABEL: Record<string, string> = { x: '1', y: '2' };\n  return LABEL[t];\n}`,
      errors: ['closedTable', 'finiteKeyRead'],
    },
  ],
});

const ROOT = path.join(__dirname, '..', '..', '..');

describe('no-string-keyed-lookup exempt files', () => {
  const fixtures = ['typed-rule-case.test.ts', 'typed-rule-case.generated.ts'];
  const tester = new RuleTester({
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        projectService: { allowDefaultProject: ['*.ts'] },
        tsconfigRootDir: ROOT,
      },
    },
  });
  const rule =
    require('../../../eslint/plugin/rules/no-string-keyed-lookup') as Rule.RuleModule;

  tester.run('no-string-keyed-lookup', rule, {
    valid: fixtures.map(fixture => ({
      code: "export const REGION: Record<string, string> = { US: 'USD', GB: 'GBP' };",
      filename: path.join(ROOT, fixture),
    })),
    invalid: [],
  });
});
