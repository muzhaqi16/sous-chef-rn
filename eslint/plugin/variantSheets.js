/** The sheet `useVariants` was called on, when `init` is that call. */
const variantSheetOf = init =>
  init?.type === 'CallExpression' &&
  init.callee.type === 'MemberExpression' &&
  init.callee.property.name === 'useVariants'
    ? init.callee.object.name
    : undefined;

const variableNamed = (name, scope) => {
  for (let current = scope; current; current = current.upper) {
    const variable = current.set.get(name);
    if (variable) return variable;
  }
  return undefined;
};

/** The stylesheet `identifier` reads, seeing through `useVariants`' return. */
const sheetNameOf = (identifier, sourceCode) => {
  const variable = variableNamed(
    identifier.name,
    sourceCode.getScope(identifier),
  );
  return variantSheetOf(variable?.defs[0]?.node.init) ?? identifier.name;
};

module.exports = { sheetNameOf, variableNamed, variantSheetOf };
