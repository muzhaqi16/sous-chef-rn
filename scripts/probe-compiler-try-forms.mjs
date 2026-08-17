/**
 * Prints which `try` forms the INSTALLED React Compiler bails out on.
 *
 *   node scripts/probe-compiler-try-forms.mjs
 *
 * This exists so the corresponding CLAUDE.md rule stays falsifiable. The rule
 * used to ban `try/catch` in hooks; on babel-plugin-react-compiler 1.0.0 that
 * is not what bails out. Rather than asking a future reader to trust either
 * version of the claim, this re-derives it in one command against whatever is
 * in node_modules.
 *
 * Each fixture is a hook holding a derived value the compiler would memoize. If
 * the compiler bails, it emits no CompileSuccess for that function — so
 * `compiled: no` is the bailout, and the reason comes straight from the
 * compiler's own diagnostic.
 *
 * Result on babel-plugin-react-compiler 1.0.0 (2026-08):
 *
 *   try/catch, plain statements in the try ... compiles
 *   try/catch (binding-less `catch {}`) ...... compiles
 *   try/catch nested in a non-hook function .. compiles
 *   try/catch in a component body ............ compiles
 *   value block AFTER the try/catch .......... compiles
 *   try/finally (no catch) ................... BAILS OUT
 *   try/catch/finally ........................ BAILS OUT
 *   `?.` inside the try body ................. BAILS OUT
 *   `??` / `&&` / `||` inside the try body ... BAILS OUT
 *   ternary inside the try body .............. BAILS OUT
 *
 * So there are two independent triggers: the finalizer, and a "value block"
 * (conditional / logical / optional-chaining expression) inside the TRY block.
 * A try body limited to plain statements compiles; move anything conditional
 * to after the try and it compiles again.
 */
import babel from '@babel/core';
import { readFileSync } from 'fs';

const FIXTURES = {
  'baseline (no try at all)': `
    import { useState } from 'react';
    export function useThing(items) {
      const [n] = useState(0);
      const derived = items.map(i => i * n);
      return derived;
    }
  `,
  'optional chaining inside the try body': `
    import { useState } from 'react';
    export function useThing(items) {
      const [n] = useState(0);
      let d;
      try { d = items?.data?.map(i => i * n); } catch (e) { d = []; }
      return d;
    }
  `,
  'nullish coalescing inside the try body': `
    import { useState } from 'react';
    export function useThing(items) {
      const [n] = useState(0);
      let d;
      try { d = items.map(i => i * n) ?? []; } catch (e) { d = []; }
      return d;
    }
  `,
  'ternary inside the try body': `
    import { useState } from 'react';
    export function useThing(items) {
      const [n] = useState(0);
      let d;
      try { d = n > 0 ? items : []; } catch (e) { d = []; }
      return d;
    }
  `,
  'the same value block moved AFTER the try': `
    import { useState } from 'react';
    export function useThing(items) {
      const [n] = useState(0);
      let r;
      try { r = items.map(i => i * n); } catch (e) {}
      return r?.length ?? 0;
    }
  `,
  'try/catch': `
    import { useState } from 'react';
    export function useThing(items) {
      const [n] = useState(0);
      let derived;
      try {
        derived = items.map(i => i * n);
      } catch (e) {
        derived = [];
      }
      return derived;
    }
  `,
  'try/catch with a binding-less catch': `
    import { useState } from 'react';
    export function useThing(items) {
      const [n] = useState(0);
      let derived;
      try {
        derived = items.map(i => i * n);
      } catch {
        derived = [];
      }
      return derived;
    }
  `,
  'try/finally (no catch)': `
    import { useState } from 'react';
    export function useThing(items) {
      const [n] = useState(0);
      let derived;
      try {
        derived = items.map(i => i * n);
      } finally {
        derived = derived ?? [];
      }
      return derived;
    }
  `,
  'try/catch/finally': `
    import { useState } from 'react';
    export function useThing(items) {
      const [n] = useState(0);
      let derived;
      try {
        derived = items.map(i => i * n);
      } catch (e) {
        derived = [];
      } finally {
        derived = derived ?? [];
      }
      return derived;
    }
  `,
  'try/catch inside a nested non-hook function': `
    import { useState } from 'react';
    export function useThing(items) {
      const [n] = useState(0);
      const parse = raw => {
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      };
      const derived = items.map(i => parse(i) ?? i * n);
      return derived;
    }
  `,
  'try/catch in a component body': `
    import { useState } from 'react';
    export function Thing({ items }) {
      const [n] = useState(0);
      let derived;
      try {
        derived = items.map(i => i * n);
      } catch (e) {
        derived = [];
      }
      return derived.length;
    }
  `,
};

const rows = [];

for (const [form, code] of Object.entries(FIXTURES)) {
  const events = [];
  await babel.transformAsync(code, {
    filename: 'probe.tsx',
    cwd: process.cwd(),
    configFile: false,
    babelrc: false,
    plugins: [
      [
        'babel-plugin-react-compiler',
        {
          logger: {
            logEvent(_filename, event) {
              events.push(event);
            },
          },
        },
      ],
    ],
  });

  const errors = events.filter(e => e.kind === 'CompileError');
  rows.push({
    form,
    compiled: events.some(e => e.kind === 'CompileSuccess') ? 'YES' : 'no',
    bailoutReason: [
      ...new Set(
        errors.map(e => e.detail?.reason ?? e.detail?.description ?? 'unknown'),
      ),
    ].join('; '),
  });
}

const version = JSON.parse(
  readFileSync('node_modules/babel-plugin-react-compiler/package.json', 'utf8'),
).version;

// A run where nothing compiled means the harness is broken, not that every form
// bails out — the same vacuity trap the other checks in this repo close.
if (!rows.some(r => r.compiled === 'YES')) {
  console.error(
    `✗ No fixture compiled, not even the baseline. The probe setup is broken; ` +
      `these results say nothing about ${version}.`,
  );
  process.exit(2);
}

console.log(`babel-plugin-react-compiler ${version}\n`);
console.table(rows);
