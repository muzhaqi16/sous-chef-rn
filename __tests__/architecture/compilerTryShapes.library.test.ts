import { transformSync } from '@babel/core';
import reactCompiler, { type LoggerEvent } from 'babel-plugin-react-compiler';

/**
 * Pins which `try` shapes make the INSTALLED React Compiler skip a whole hook
 * or component: a finalizer (a catch-less `try` included), or a value block
 * (`?.` `??` `&&` `||` ternary) inside the `try` body. A `try/catch` over plain
 * statements compiles. CLAUDE.md's `try` rule, `src/utils/finallyHelpers.ts`
 * and `check-compiler-bailouts` rest on it; lint sees only the finalizer half.
 *
 * Verified: #react-compiler-try-shapes
 */

const VALUE_BLOCK_IN_TRY =
  'Support value blocks (conditional, logical, optional chaining, etc) within a try/catch statement';

/** A hook holding a derived value the compiler would memoize. */
const hookWith = (statement: string, returned = 'd') => `
  import { useState } from 'react';
  export function useThing(items) {
    const [n] = useState(0);
    let d;
    ${statement}
    return ${returned};
  }
`;

const componentWith = (statement: string) => `
  import { useState } from 'react';
  export function Thing({ items }) {
    const [n] = useState(0);
    let d;
    ${statement}
    return d.length;
  }
`;

/** The functions the compiler memoized, and why it skipped the others. */
const compile = (source: string) => {
  const events: LoggerEvent[] = [];
  transformSync(source, {
    filename: 'fixture.js',
    configFile: false,
    babelrc: false,
    plugins: [
      [
        reactCompiler,
        {
          logger: {
            logEvent: (_file: string | null, event: LoggerEvent) => {
              events.push(event);
            },
          },
        },
      ],
    ],
  });
  return {
    compiled: events.flatMap(event =>
      event.kind === 'CompileSuccess' ? [event.fnName] : [],
    ),
    bailouts: [
      ...new Set(
        events.flatMap(event =>
          event.kind === 'CompileError' ? [event.detail.reason] : [],
        ),
      ),
    ],
  };
};

describe('the installed React Compiler and `try`', () => {
  it.each([
    ['no try at all', hookWith('d = items.map(i => i * n);'), 'useThing'],
    [
      'try/catch over plain statements',
      hookWith('try { d = items.map(i => i * n); } catch (e) { d = []; }'),
      'useThing',
    ],
    [
      'a binding-less catch',
      hookWith('try { d = items.map(i => i * n); } catch { d = []; }'),
      'useThing',
    ],
    [
      'a value block moved after the try',
      hookWith(
        'try { d = items.map(i => i * n); } catch (e) {}',
        'd?.length ?? 0',
      ),
      'useThing',
    ],
    [
      'try/catch in a nested non-hook function',
      hookWith(`
        const parse = raw => {
          try { return JSON.parse(raw); } catch { return null; }
        };
        d = items.map(i => parse(i) ?? i * n);
      `),
      'useThing',
    ],
    [
      'try/catch in a component body',
      componentWith('try { d = items.map(i => i * n); } catch (e) { d = []; }'),
      'Thing',
    ],
  ])('compiles %s', (_shape, source, fnName) => {
    expect(compile(source)).toEqual({ compiled: [fnName], bailouts: [] });
  });

  it.each([
    [
      'try/finally',
      hookWith('try { d = items.map(i => i * n); } finally { d = d ?? []; }'),
      '(BuildHIR::lowerStatement) Handle TryStatement without a catch clause',
    ],
    [
      'try/catch/finally',
      hookWith(
        'try { d = items.map(i => i * n); } catch (e) { d = []; } finally { d = d ?? []; }',
      ),
      "(BuildHIR::lowerStatement) Handle TryStatement with a finalizer ('finally') clause",
    ],
    [
      '`?.` inside the try body',
      hookWith(
        'try { d = items?.data?.map(i => i * n); } catch (e) { d = []; }',
      ),
      'Unexpected terminal in optional',
    ],
    [
      '`??` inside the try body',
      hookWith(
        'try { d = items.map(i => i * n) ?? []; } catch (e) { d = []; }',
      ),
      VALUE_BLOCK_IN_TRY,
    ],
    [
      '`&&` inside the try body',
      hookWith('try { d = n && items.map(i => i * n); } catch (e) { d = []; }'),
      VALUE_BLOCK_IN_TRY,
    ],
    [
      '`||` inside the try body',
      hookWith(
        'try { d = items.map(i => i * n) || []; } catch (e) { d = []; }',
      ),
      VALUE_BLOCK_IN_TRY,
    ],
    [
      'a ternary inside the try body',
      hookWith('try { d = n > 0 ? items : []; } catch (e) { d = []; }'),
      VALUE_BLOCK_IN_TRY,
    ],
    [
      'a ternary inside a component’s try body',
      componentWith('try { d = n > 0 ? items : []; } catch (e) { d = []; }'),
      VALUE_BLOCK_IN_TRY,
    ],
  ])('bails out of the whole function on %s', (_shape, source, reason) => {
    expect(compile(source)).toEqual({ compiled: [], bailouts: [reason] });
  });
});
