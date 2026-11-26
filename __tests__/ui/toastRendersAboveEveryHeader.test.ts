import * as ts from 'typescript';
import {
  calleeName,
  jsxElementsOf,
  nodesOf,
  parseSource,
  propertyName,
} from '#/test-utils/sourceAst';

/**
 * The toast rests at the top inset — the same band every screen header
 * occupies — so it always overlaps a header. What decides whether it is
 * READABLE there is native view order: iOS 26's liquid-glass material
 * composites above sibling RN views whatever their `zIndex`, so a toast
 * mounted inside the navigator's subtree renders behind any glass it overlaps.
 */

/** Each element named `tag`, as whether it wraps children and where it starts. */
const mountsOf = (source: ts.SourceFile, tag: string) =>
  jsxElementsOf(source)
    .filter(element => element.tagName.getText() === tag)
    .map(element => ({
      wraps: ts.isJsxOpeningElement(element),
      at: element.getStart(),
    }));

const app = parseSource('App.tsx');
const toast = parseSource('src/components/molecules/Toast.tsx');

it('catches a provider that wraps the tree, props and all', () => {
  const planted = parseSource(
    'planted.tsx',
    `const App = () => (
      <ToastProvider position="top">
        <RootNavigator />
      </ToastProvider>
    );`,
  );

  expect(mountsOf(planted, 'ToastProvider')).toEqual([
    { wraps: true, at: expect.any(Number) },
  ]);
});

it('mounts the toast once, as a leaf, not as a wrapper around the navigator', () => {
  // Wrapping is what put it below every header.
  expect(mountsOf(app, 'ToastProvider').map(mount => mount.wraps)).toEqual([
    false,
  ]);
});

it('mounts it last, after the global backdrop', () => {
  const [backdrop] = mountsOf(app, 'GlobalBackdrop');
  const [mount] = mountsOf(app, 'ToastProvider');

  expect(backdrop).toBeDefined();
  expect(mount?.at).toBeGreaterThan(backdrop?.at ?? Infinity);
});

it('keeps children optional, which is what lets it be a leaf', () => {
  const children = nodesOf(toast).find(
    (node): node is ts.PropertySignature =>
      ts.isPropertySignature(node) && propertyName(node.name) === 'children',
  );

  expect(children?.questionToken).toBeDefined();
});

it('exposes no context, so nothing needs to sit inside it', () => {
  // A context would force it back to wrapping the tree.
  const contexts = nodesOf(toast)
    .filter(ts.isCallExpression)
    .filter(call => (calleeName(call) ?? '').endsWith('createContext'));

  expect(contexts).toEqual([]);
});
