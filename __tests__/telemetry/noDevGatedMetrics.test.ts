/**
 * Guard against metrics that can never report from a release build.
 *
 * A metric emitted inside `if (__DEV__) { … }` is dead-code-eliminated in
 * production, so the series exists in Mimir and is permanently empty. That is
 * worse than having no metric at all: an empty panel reads as "no problem"
 * rather than "not measured".
 *
 * This bit the repo three times before it was noticed — `useRenderTime`'s whole
 * reporting effect, the three `cache_persist_*` metrics, `apollo_cache_edge_count`
 * and `resort_edges_duration_ms` were all dev-only while their dashboards and
 * config implied production coverage (`slowRenderThreshold: __DEV__ ? 500 : 16`
 * is meaningless if the hook never runs in release).
 *
 * The rule: human-readable breadcrumbs (`logger.debug`, `console.*`) belong
 * inside `__DEV__`; `Telemetry.*` metric calls do not. Gate reporting volume
 * with `enabled` / `sampleRate` instead.
 */
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..', '..', 'src');
const METRIC_CALL = /Telemetry\.(?:histogram|increment|gauge|counter)\(\s*\n?\s*['"]([a-z0-9_]+)['"]/g;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === '__mocks__') continue;
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** Body of every `if (__DEV__) { … }` block, matched by brace depth. */
function devBlocks(src: string): string[] {
  const blocks: string[] = [];
  const opener = /if \(__DEV__\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(src)) !== null) {
    const start = m.index + m[0].length;
    let depth = 0;
    for (let i = start - 1; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') {
        depth--;
        if (depth === 0) {
          blocks.push(src.slice(start, i));
          break;
        }
      }
    }
  }
  return blocks;
}

describe('telemetry metrics are not __DEV__-gated', () => {
  it('emits no Telemetry metric from inside an if (__DEV__) block', () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC)) {
      const src = fs.readFileSync(file, 'utf8');
      if (!src.includes('__DEV__') || !src.includes('Telemetry.')) continue;

      for (const block of devBlocks(src)) {
        METRIC_CALL.lastIndex = 0;
        let call: RegExpExecArray | null;
        while ((call = METRIC_CALL.exec(block)) !== null) {
          offenders.push(`${path.relative(SRC, file)} → ${call[1]}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
