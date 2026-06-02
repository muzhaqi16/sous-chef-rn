/**
 * Codemod: migrate the canonical opacity press-feedback Pressable pattern to the
 * shared <AppPressable> primitive, for whole-codebase touch consistency.
 *
 * Transforms ONLY the exact, safe shape:
 *
 *   <Pressable ... style={({ pressed }) => [A, B, pressed && X.pressed]} ...>
 *     ...
 *   </Pressable>
 *
 * into:
 *
 *   <AppPressable ... style={[A, B]} ...>   (or style={A} when one item remains)
 *     ...
 *   </AppPressable>
 *
 * AppPressable appends `theme.opacity.pressed` itself, so the `pressed && X.pressed`
 * term is dropped. Behavior is identical.
 *
 * SKIPS (conservative — leaves untouched, reported):
 *  - Files importing `Pressable` from 'react-native-gesture-handler' (gesture composition).
 *  - Files that don't import `Pressable` from '#components/atoms/themedComponents'.
 *  - Any <Pressable> whose `style` isn't the exact `({ pressed }) => [ ..., pressed && _.pressed ]` shape
 *    (variant-driven, scale, non-opacity, non-canonical → left for manual review).
 *
 * Run: npx jscodeshift -t scripts/codemods/pressable-to-app-pressable.js --parser=tsx --extensions=tsx <path>
 */
const THEMED = '#components/atoms/themedComponents';
const APP_PRESSABLE_SRC = '#components/atoms/AppPressable';

module.exports = function transformer(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  // Guard: skip files that pull Pressable from RNGH — those are gesture-composition
  // sites where AppPressable (RN Pressable) must NOT be used.
  const importsRnghPressable =
    root
      .find(j.ImportDeclaration, {
        source: { value: 'react-native-gesture-handler' },
      })
      .filter(p =>
        (p.node.specifiers || []).some(
          s => s.type === 'ImportSpecifier' && s.imported.name === 'Pressable',
        ),
      )
      .size() > 0;
  if (importsRnghPressable) return null;

  // Require Pressable imported from themedComponents (the RN-Pressable re-export).
  const themedImports = root
    .find(j.ImportDeclaration, { source: { value: THEMED } })
    .filter(p =>
      (p.node.specifiers || []).some(
        s => s.type === 'ImportSpecifier' && s.imported.name === 'Pressable',
      ),
    );
  if (themedImports.size() === 0) return null;

  let changed = false;

  root
    .find(j.JSXElement, { openingElement: { name: { name: 'Pressable' } } })
    .forEach(path => {
      const opening = path.node.openingElement;
      const styleAttr = (opening.attributes || []).find(
        a => a.type === 'JSXAttribute' && a.name.name === 'style',
      );
      if (
        !styleAttr ||
        !styleAttr.value ||
        styleAttr.value.type !== 'JSXExpressionContainer'
      )
        return;

      const expr = styleAttr.value.expression;
      if (expr.type !== 'ArrowFunctionExpression') return;
      if (!expr.params || expr.params.length !== 1) return;

      // Body must be an array literal (possibly wrapped in parens — recast normalizes).
      const body = expr.body;
      if (!body || body.type !== 'ArrayExpression') return;

      const elements = body.elements.filter(Boolean);
      if (elements.length === 0) return;
      const last = elements[elements.length - 1];

      // last must be exactly: pressed && <something>.pressed
      const isPressedTerm =
        last &&
        last.type === 'LogicalExpression' &&
        last.operator === '&&' &&
        last.left.type === 'Identifier' &&
        last.left.name === 'pressed' &&
        last.right.type === 'MemberExpression' &&
        last.right.property &&
        last.right.property.name === 'pressed';
      if (!isPressedTerm) return;

      // Defensive: ensure `pressed` isn't referenced elsewhere in the array
      // (e.g. an earlier `pressed && styles.active`) — if so, skip (not the canonical shape).
      const others = elements.slice(0, -1);
      const referencesPressedElsewhere = others.some(el => {
        let found = false;
        j(el)
          .find(j.Identifier, { name: 'pressed' })
          .forEach(() => {
            found = true;
          });
        return found;
      });
      if (referencesPressedElsewhere) return;

      const remaining = others;
      let newStyle;
      if (remaining.length === 1) {
        newStyle = remaining[0];
      } else {
        newStyle = j.arrayExpression(remaining);
      }
      styleAttr.value = j.jsxExpressionContainer(newStyle);

      opening.name.name = 'AppPressable';
      if (path.node.closingElement) {
        path.node.closingElement.name.name = 'AppPressable';
      }
      changed = true;
    });

  if (!changed) return null;

  // Add the AppPressable import (once).
  const hasAppImport =
    root
      .find(j.ImportDeclaration, { source: { value: APP_PRESSABLE_SRC } })
      .size() > 0;
  if (!hasAppImport) {
    const decl = j.importDeclaration(
      [j.importSpecifier(j.identifier('AppPressable'))],
      j.literal(APP_PRESSABLE_SRC),
    );
    // Insert right after the themedComponents import for locality.
    themedImports.at(0).insertAfter(decl);
  }

  // If no RN <Pressable> remains, drop the Pressable specifier from themedComponents.
  const pressableStillUsed =
    root
      .find(j.JSXElement, { openingElement: { name: { name: 'Pressable' } } })
      .size() > 0;
  if (!pressableStillUsed) {
    themedImports.forEach(p => {
      p.node.specifiers = p.node.specifiers.filter(
        s => !(s.type === 'ImportSpecifier' && s.imported.name === 'Pressable'),
      );
    });
    // Remove now-empty themedComponents import.
    root
      .find(j.ImportDeclaration, { source: { value: THEMED } })
      .filter(p => (p.node.specifiers || []).length === 0)
      .remove();
  }

  return root.toSource({ quote: 'single' });
};
