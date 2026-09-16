const fs = require('node:fs');
const path = require('node:path');
const { parse, Kind } = require('graphql');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..', '..', '..');

let operationNames;

/** Every operation name the app's `.graphql` documents declare. */
function readOperationNames() {
  if (operationNames) return operationNames;
  operationNames = new Set();
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.graphql') && !full.includes('generated')) {
        const document = parse(fs.readFileSync(full, 'utf8'));
        for (const definition of document.definitions) {
          if (
            definition.kind === Kind.OPERATION_DEFINITION &&
            definition.name
          ) {
            operationNames.add(definition.name.value);
          }
        }
      }
    }
  };
  walk(path.join(ROOT, 'src'));
  // Fail closed: an empty set would make this rule pass on every file.
  if (operationNames.size === 0) {
    throw new Error(`No GraphQL operations found under ${ROOT}/src.`);
  }
  return operationNames;
}

const OPERATION_SLOT = /operation|subscription|query|mutation/i;

const nameOf = node => {
  if (!node) return undefined;
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression' && !node.computed) {
    return node.property.name;
  }
  if (node.type === 'Literal') return String(node.value);
  return undefined;
};

/**
 * The name of the slot a literal lands in — the parameter, property, variable
 * or compared expression. A PascalCase label for a screen or component can
 * share an operation's spelling; only a slot that holds an operation name is
 * this rule's business.
 */
function slotNames(node, services, checker) {
  const names = [];
  let current = node;
  while (current.parent?.type === 'ArrayExpression') current = current.parent;
  const parent = current.parent;
  if (!parent) return names;
  switch (parent.type) {
    case 'Property':
      if (parent.value === current) names.push(nameOf(parent.key));
      break;
    case 'VariableDeclarator':
      names.push(nameOf(parent.id));
      break;
    case 'AssignmentExpression':
      names.push(nameOf(parent.left));
      break;
    case 'BinaryExpression':
      names.push(nameOf(parent.left === current ? parent.right : parent.left));
      break;
    case 'SwitchCase':
      names.push(nameOf(parent.parent.discriminant));
      break;
    case 'CallExpression':
    case 'NewExpression': {
      if (parent.callee.type === 'MemberExpression') {
        names.push(nameOf(parent.callee.object));
      }
      const index = parent.arguments.indexOf(current);
      if (index < 0) break;
      const signature = checker.getResolvedSignature(
        services.esTreeNodeToTSNodeMap.get(parent),
      );
      const params = signature?.getParameters() ?? [];
      const param = params[Math.min(index, params.length - 1)];
      if (param) names.push(param.getName());
      break;
    }
    default:
      break;
  }
  return names.filter(Boolean);
}

// A literal-union position is checked by tsc itself (a route name, a typed
// `operationName`); only a plain-`string` slot lets a stale name compile.
function isCheckedByType(type) {
  const parts = type.isUnion() ? type.types : [type];
  return parts.every(
    part =>
      part.flags &
      (ts.TypeFlags.StringLiteral |
        ts.TypeFlags.EnumLiteral |
        ts.TypeFlags.NumberLiteral |
        ts.TypeFlags.BooleanLiteral |
        ts.TypeFlags.Undefined |
        ts.TypeFlags.Null),
  );
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'An operation name comes from its generated document, not a string.',
      url: 'docs/rules/no-operation-name-literal.md',
    },
    schema: [],
    messages: {
      operationNameLiteral:
        "'{{name}}' is a GraphQL operation name in a plain-string slot, so a rename or removal still compiles. Pass the generated `{{name}}Document` (APIs take the document), or derive the name with `operationNameOf({{name}}Document)`.",
    },
  },
  create(context) {
    const services = context.sourceCode.parserServices;
    if (!services?.program) return {};
    const checker = services.program.getTypeChecker();
    const names = readOperationNames();

    const check = (node, value) => {
      if (!names.has(value)) return;
      const parent = node.parent;
      if (
        parent.type === 'TSLiteralType' ||
        parent.type === 'ImportDeclaration' ||
        parent.type === 'ExportNamedDeclaration' ||
        parent.type === 'ExportAllDeclaration'
      ) {
        return;
      }
      const slots = slotNames(node, services, checker);
      if (!slots.some(slot => OPERATION_SLOT.test(slot))) return;
      const tsNode = services.esTreeNodeToTSNodeMap.get(node);
      const contextual = checker.getContextualType(tsNode);
      if (contextual && isCheckedByType(contextual)) return;
      context.report({
        node,
        messageId: 'operationNameLiteral',
        data: { name: value },
      });
    };

    return {
      Literal(node) {
        if (typeof node.value === 'string') check(node, node.value);
      },
      TemplateLiteral(node) {
        if (node.expressions.length === 0) {
          check(node, node.quasis[0].value.cooked);
        }
      },
    };
  },
};
