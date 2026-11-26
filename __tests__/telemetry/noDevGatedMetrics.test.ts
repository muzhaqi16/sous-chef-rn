/**
 * Guard against metrics that can never report from a release build.
 *
 * A metric emitted inside `if (__DEV__) { … }` is dead-code-eliminated in
 * production, so the series exists in Mimir and is permanently empty. That is
 * worse than having no metric at all: an empty panel reads as "no problem"
 * rather than "not measured".
 *
 * This bit the repo three times — `useRenderTime`'s whole reporting effect, the
 * three `cache_persist_*` metrics, `apollo_cache_edge_count` and
 * `resort_edges_duration_ms` were all dev-only while their dashboards implied
 * production coverage. A release-tuned sample rate means nothing when the hook
 * emitting the metric never runs in release.
 *
 * The rule: human-readable breadcrumbs (`logger.debug`, `console.*`) belong
 * inside `__DEV__`; `Telemetry.*` metric calls do not. Gate reporting volume
 * with `enabled` / `sampleRate` instead.
 */
import * as ts from 'typescript';
import {
  calleeName,
  nodesOf,
  parseSource,
  productionSources,
} from '#/test-utils/sourceAst';

const METRIC_CALLS = new Set([
  'Telemetry.histogram',
  'Telemetry.increment',
  'Telemetry.gauge',
  'Telemetry.counter',
]);

/** Whether a condition holds only in a dev build, only in release, or neither. */
function buildOf(condition: ts.Expression): 'dev' | 'release' | undefined {
  if (ts.isParenthesizedExpression(condition)) {
    return buildOf(condition.expression);
  }
  if (ts.isIdentifier(condition) && condition.text === '__DEV__') return 'dev';
  if (
    ts.isPrefixUnaryExpression(condition) &&
    condition.operator === ts.SyntaxKind.ExclamationToken
  ) {
    const inner = buildOf(condition.operand);
    return inner === 'dev'
      ? 'release'
      : inner === 'release'
      ? 'dev'
      : undefined;
  }
  if (
    ts.isBinaryExpression(condition) &&
    condition.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
    (buildOf(condition.left) === 'dev' || buildOf(condition.right) === 'dev')
  ) {
    return 'dev';
  }
  return undefined;
}

/** Code that runs only in a dev build: a branch, or the rest of `__DEV__ && …`. */
function devOnly(source: ts.SourceFile): ts.Node[] {
  return nodesOf(source).flatMap((node): ts.Node[] => {
    if (ts.isIfStatement(node)) {
      const build = buildOf(node.expression);
      if (build === 'dev') return [node.thenStatement];
      if (build === 'release' && node.elseStatement)
        return [node.elseStatement];
      return [];
    }
    if (ts.isConditionalExpression(node)) {
      const build = buildOf(node.condition);
      if (build === 'dev') return [node.whenTrue];
      if (build === 'release') return [node.whenFalse];
      return [];
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
      buildOf(node.left) === 'dev'
    ) {
      return [node.right];
    }
    return [];
  });
}

/** Each metric emitted only in a dev build, as `file → name`. */
function devGatedMetrics(file: string, text?: string): string[] {
  return devOnly(parseSource(file, text)).flatMap(scope =>
    nodesOf(scope)
      .filter(ts.isCallExpression)
      .filter(call => METRIC_CALLS.has(calleeName(call) ?? ''))
      .map(call => {
        const [name] = call.arguments;
        return `${file} → ${
          name && ts.isStringLiteral(name) ? name.text : '?'
        }`;
      }),
  );
}

describe('telemetry metrics are not __DEV__-gated', () => {
  it('catches a metric behind any dev-only condition', () => {
    const planted = `
      if (__DEV__ && verbose) Telemetry.increment('cache_writes');
      __DEV__ && Telemetry.histogram('render_ms', ms);
      if (!__DEV__) Telemetry.increment('release_only');
      else Telemetry.gauge('dev_only_depth', depth);`;

    expect(devGatedMetrics('planted.ts', planted)).toEqual([
      'planted.ts → cache_writes',
      'planted.ts → render_ms',
      'planted.ts → dev_only_depth',
    ]);
  });

  it('emits no Telemetry metric from inside a dev-only branch', () => {
    expect(productionSources().flatMap(file => devGatedMetrics(file))).toEqual(
      [],
    );
  });
});
