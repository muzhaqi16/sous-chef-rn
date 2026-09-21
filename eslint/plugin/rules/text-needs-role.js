const path = require('node:path');

const ALIASES = new Set(['#components/atoms/Text', '#/components/atoms/Text']);

const isTextAtom = (source, filename) => {
  if (ALIASES.has(source)) return true;
  if (!source.startsWith('.')) return false;
  const resolved = path
    .resolve(path.dirname(filename), source)
    .split(path.sep)
    .join('/')
    .replace(/\.tsx?$/, '');
  return resolved.endsWith('/components/atoms/Text');
};

const MESSAGE =
  'Name a typography role: `<Text role="body">`. A role-less `<Text>` falls to the atom default, so two elements meant to match can set at different sizes. Drop fontSize/fontWeight/lineHeight/letterSpacing from its style in favour of the role, and give colour through `tone`.';

const ERROR_TONE_MESSAGE =
  'Error copy sets at the `error` role: `<Text role="error" tone="error">`. A destructive label or a negative status that is not error copy takes `tone="danger"` and keeps its own role.';

const ERROR_ROLE_MESSAGE =
  '`role="error"` pairs with `tone="error"`: the role carries only size and weight, so without the tone the error line renders in the default text colour.';

const ERROR_COLOUR_MESSAGE =
  'Give the error colour through `tone`, not a style: `<Text role="error" tone="error">` for error copy, `tone="danger"` for a destructive label or a negative status.';

const ERROR_COLOURS = new Set(['error', 'danger']);

/**
 * The string literals an attribute can evaluate to. `unknown` is set when any
 * branch is not a literal, so a requirement is only enforced on a closed set.
 */
const literalValues = attribute => {
  const result = { values: new Set(), unknown: false };
  if (!attribute) return result;
  const visit = node => {
    if (!node) return;
    if (node.type === 'Literal' && typeof node.value === 'string') {
      result.values.add(node.value);
    } else if (node.type === 'JSXExpressionContainer') {
      visit(node.expression);
    } else if (node.type === 'ConditionalExpression') {
      visit(node.consequent);
      visit(node.alternate);
    } else if (node.type === 'LogicalExpression') {
      if (node.operator !== '&&') visit(node.left);
      visit(node.right);
    } else if (
      node.type === 'TemplateLiteral' &&
      node.expressions.length === 0 &&
      node.quasis[0]
    ) {
      result.values.add(node.quasis[0].value.cooked);
    } else {
      result.unknown = true;
    }
  };
  visit(attribute.value);
  return result;
};

const isErrorColour = node =>
  node?.type === 'MemberExpression' &&
  !node.computed &&
  node.property.type === 'Identifier' &&
  ERROR_COLOURS.has(node.property.name) &&
  node.object.type === 'MemberExpression' &&
  !node.object.computed &&
  node.object.property.type === 'Identifier' &&
  node.object.property.name === 'colors';

const setsErrorColour = objectNode =>
  objectNode?.type === 'ObjectExpression' &&
  objectNode.properties.some(
    property =>
      property.type === 'Property' &&
      !property.computed &&
      ((property.key.type === 'Identifier' && property.key.name === 'color') ||
        (property.key.type === 'Literal' && property.key.value === 'color')) &&
      isErrorColour(property.value),
  );

const keyNamed = (property, name) =>
  property.type === 'Property' &&
  !property.computed &&
  ((property.key.type === 'Identifier' && property.key.name === name) ||
    (property.key.type === 'Literal' && property.key.value === name));

const objectValues = objectNode =>
  objectNode?.type === 'ObjectExpression'
    ? objectNode.properties
        .filter(property => property.type === 'Property')
        .map(property => property.value)
    : [];

/** The object a dynamic style function (`(size) => ({ … })`) returns. */
const styleBodyOf = value => {
  if (
    value.type !== 'ArrowFunctionExpression' &&
    value.type !== 'FunctionExpression'
  ) {
    return value;
  }
  if (value.body.type !== 'BlockStatement') return value.body;
  const returned = value.body.body.find(s => s.type === 'ReturnStatement');
  return returned?.argument ?? null;
};

/** A style's own colour, any `variants` branch, or any `compoundVariants` entry's `styles`. */
const setsErrorColourInAnyVariant = value => {
  const style = styleBodyOf(value);
  if (style?.type !== 'ObjectExpression') return false;
  if (setsErrorColour(style)) return true;
  return style.properties.some(property => {
    if (keyNamed(property, 'variants')) {
      return objectValues(property.value).some(group =>
        objectValues(group).some(setsErrorColour),
      );
    }
    if (keyNamed(property, 'compoundVariants')) {
      return (
        property.value.type === 'ArrayExpression' &&
        property.value.elements.some(entry =>
          entry?.type === 'ObjectExpression'
            ? entry.properties.some(
                candidate =>
                  keyNamed(candidate, 'styles') &&
                  setsErrorColour(candidate.value),
              )
            : false,
        )
      );
    }
    return false;
  });
};

const stylesObjectOf = call => {
  const [argument] = call.arguments;
  if (!argument) return null;
  if (argument.type === 'ObjectExpression') return argument;
  if (
    argument.type !== 'ArrowFunctionExpression' &&
    argument.type !== 'FunctionExpression'
  ) {
    return null;
  }
  if (argument.body.type === 'ObjectExpression') return argument.body;
  if (argument.body.type !== 'BlockStatement') return null;
  const returned = argument.body.body.find(s => s.type === 'ReturnStatement');
  return returned?.argument?.type === 'ObjectExpression'
    ? returned.argument
    : null;
};

const isStyleSheetCreate = node =>
  node?.type === 'CallExpression' &&
  node.callee.type === 'MemberExpression' &&
  !node.callee.computed &&
  node.callee.object.type === 'Identifier' &&
  node.callee.object.name === 'StyleSheet' &&
  node.callee.property.type === 'Identifier' &&
  node.callee.property.name === 'create';

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A `<Text>` outside the kit names its typography role; error copy everywhere is `role="error"` with `tone="error"`.',
      url: 'docs/rules/text-needs-role.md',
    },
    schema: [
      {
        type: 'object',
        properties: {
          requireRole: { type: 'boolean' },
          readVariants: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingRole: MESSAGE,
      errorToneNeedsErrorRole: ERROR_TONE_MESSAGE,
      errorRoleNeedsErrorTone: ERROR_ROLE_MESSAGE,
      errorColourInStyle: ERROR_COLOUR_MESSAGE,
    },
  },
  create(context) {
    const requireRole = context.options[0]?.requireRole ?? true;
    const readVariants = context.options[0]?.readVariants ?? false;
    const locals = new Set();
    const errorStyleKeys = new Map();
    const styleReferences = [];

    const collectStyleReferences = (node, element) => {
      if (!node) return;
      if (node.type === 'JSXExpressionContainer') {
        collectStyleReferences(node.expression, element);
      } else if (node.type === 'ArrayExpression') {
        node.elements.forEach(e => collectStyleReferences(e, element));
      } else if (node.type === 'ConditionalExpression') {
        collectStyleReferences(node.consequent, element);
        collectStyleReferences(node.alternate, element);
      } else if (node.type === 'LogicalExpression') {
        collectStyleReferences(node.right, element);
      } else if (node.type === 'ObjectExpression') {
        if (setsErrorColour(node)) {
          context.report({ node: element, messageId: 'errorColourInStyle' });
        }
      } else if (readVariants && node.type === 'CallExpression') {
        collectStyleReferences(node.callee, element);
      } else if (
        node.type === 'MemberExpression' &&
        !node.computed &&
        node.object.type === 'Identifier' &&
        node.property.type === 'Identifier'
      ) {
        styleReferences.push({
          sheet: node.object.name,
          key: node.property.name,
          element,
        });
      }
    };

    return {
      ImportDeclaration(node) {
        if (!isTextAtom(String(node.source.value), context.filename)) return;
        for (const specifier of node.specifiers) {
          const isDefault = specifier.type === 'ImportDefaultSpecifier';
          const isNamedText =
            specifier.type === 'ImportSpecifier' &&
            specifier.imported.type === 'Identifier' &&
            specifier.imported.name === 'Text' &&
            specifier.importKind !== 'type';
          if ((isDefault || isNamedText) && node.importKind !== 'type') {
            locals.add(specifier.local.name);
          }
        }
      },
      VariableDeclarator(node) {
        if (node.id.type !== 'Identifier' || !isStyleSheetCreate(node.init)) {
          return;
        }
        const sheet = stylesObjectOf(node.init);
        if (!sheet) return;
        const keys = new Set();
        for (const property of sheet.properties) {
          if (
            property.type === 'Property' &&
            !property.computed &&
            property.key.type === 'Identifier' &&
            (readVariants
              ? setsErrorColourInAnyVariant(property.value)
              : setsErrorColour(property.value))
          ) {
            keys.add(property.key.name);
          }
        }
        errorStyleKeys.set(node.id.name, keys);
      },
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier' || !locals.has(node.name.name)) {
          return;
        }
        const hasSpread = node.attributes.some(
          attribute => attribute.type === 'JSXSpreadAttribute',
        );
        const named = name =>
          node.attributes.find(
            attribute =>
              attribute.type === 'JSXAttribute' &&
              attribute.name.type === 'JSXIdentifier' &&
              attribute.name.name === name,
          );
        const roleAttribute = named('role');
        if (requireRole && !hasSpread && !roleAttribute) {
          context.report({ node, messageId: 'missingRole' });
        }

        const styleAttribute = named('style');
        if (styleAttribute) collectStyleReferences(styleAttribute.value, node);

        if (hasSpread) return;
        const role = literalValues(roleAttribute);
        const tone = literalValues(named('tone'));
        const roleIsError = role.values.has('error');
        const toneIsError = tone.values.has('error');
        if (toneIsError && !roleIsError && !role.unknown) {
          context.report({ node, messageId: 'errorToneNeedsErrorRole' });
        } else if (roleIsError && !toneIsError && !tone.unknown) {
          context.report({ node, messageId: 'errorRoleNeedsErrorTone' });
        }
      },
      'Program:exit'() {
        for (const { sheet, key, element } of styleReferences) {
          if (errorStyleKeys.get(sheet)?.has(key)) {
            context.report({ node: element, messageId: 'errorColourInStyle' });
          }
        }
      },
    };
  },
};
