/**
 * Codemod (cleanup pass after pressable-to-app-pressable): removes the now-dead
 * local `pressed: { opacity: theme.opacity.pressed }` style from a file's
 * StyleSheet.create(...) objects — but ONLY when nothing in the file still
 * references `<anything>.pressed` (so we never remove a style that a remaining,
 * non-migrated pressable still uses).
 *
 * `{ pressed }` destructuring in a style callback is an ObjectPattern, not a
 * `.pressed` MemberExpression, so it does NOT count as a use of the style.
 *
 * Conservative: if ANY `.pressed` member access remains in the file, the file is
 * left untouched. Typecheck is the backstop (a dangling `styles.pressed` would be
 * a compile error).
 *
 * Run: npx jscodeshift -t scripts/codemods/remove-dead-pressed-style.js --parser=tsx --extensions=tsx <path>
 */
module.exports = function transformer(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  // Count remaining `<x>.pressed` member accesses anywhere in the file.
  const pressedMemberRefs = root
    .find(j.MemberExpression)
    .filter(
      p =>
        p.node.property &&
        p.node.property.type === 'Identifier' &&
        p.node.property.name === 'pressed',
    )
    .size();
  if (pressedMemberRefs > 0) return null; // still used somewhere — leave it.

  let changed = false;

  // Remove `pressed: { ... }` object properties inside StyleSheet.create(...) args.
  root
    .find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        object: { name: 'StyleSheet' },
        property: { name: 'create' },
      },
    })
    .forEach(callPath => {
      j(callPath)
        .find(j.ObjectProperty, {
          key: { type: 'Identifier', name: 'pressed' },
        })
        .forEach(propPath => {
          // Only remove the simple `pressed: { opacity: ... }` shape.
          if (
            propPath.node.value &&
            propPath.node.value.type === 'ObjectExpression'
          ) {
            j(propPath).remove();
            changed = true;
          }
        });
    });

  if (!changed) return null;
  return root.toSource({ quote: 'single' });
};
