const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const {
  buildSchema,
  isInterfaceType,
  isObjectType,
  isUnionType,
} = require('graphql');

const ROOT = path.join(__dirname, '..', '..', '..');
const GENERATED = path.join(ROOT, 'src', 'graphql', 'generated');

let domain;

/**
 * `value → ['Enum.Member', …]` read off the generated enums (so the suggestion
 * is spelled as codegen spells it), and the schema's object, interface and
 * union names.
 */
function readDomain() {
  if (domain) return domain;
  const enumMembers = new Map();
  const source = fs.readFileSync(
    path.join(GENERATED, 'schemaTypes.ts'),
    'utf8',
  );
  // Closed by a brace at line start: member JSDoc can hold `{@link …}`.
  for (const block of source.matchAll(/export enum (\w+) \{([\s\S]*?)\n\}/g)) {
    for (const member of block[2].matchAll(/^\s*(\w+) = '([^']*)'/gm)) {
      const list = enumMembers.get(member[2]) ?? [];
      list.push(`${block[1]}.${member[1]}`);
      enumMembers.set(member[2], list);
    }
  }
  const schema = buildSchema(
    fs.readFileSync(path.join(GENERATED, 'schema.graphql'), 'utf8'),
  );
  const typenames = new Set(
    Object.values(schema.getTypeMap())
      .filter(
        type =>
          !type.name.startsWith('__') &&
          (isObjectType(type) || isInterfaceType(type) || isUnionType(type)),
      )
      .map(type => type.name),
  );
  domain = { enumMembers, typenames };
  return domain;
}

const LITERAL_FLAGS =
  ts.TypeFlags.StringLiteral |
  ts.TypeFlags.EnumLiteral |
  ts.TypeFlags.NumberLiteral |
  ts.TypeFlags.BooleanLiteral |
  ts.TypeFlags.Undefined |
  ts.TypeFlags.Null |
  ts.TypeFlags.Never;

/** A literal union is compared against by tsc itself (TS2367). */
const isCheckedByType = type =>
  (type.isUnion() ? type.types : [type]).every(
    part => (part.flags & LITERAL_FLAGS) !== 0,
  );

const stringValue = node => {
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0].value.cooked;
  }
  return undefined;
};

const propertyName = node => {
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression' && !node.computed) {
    return node.property.name;
  }
  return undefined;
};

const keyOf = property => {
  if (property.type !== 'Property' || property.computed) return undefined;
  if (property.key.type === 'Identifier') return property.key.name;
  return stringValue(property.key);
};

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A schema enum value or typename is compared and keyed through its generated symbol.',
      url: 'docs/rules/no-unchecked-domain-literal.md',
    },
    schema: [],
    messages: {
      enumLiteral:
        "'{{value}}' is the generated {{members}}, compared against a plain string, so a renamed or removed value still compiles. Type the operand with the enum where it is declared and compare against the member.",
      typenameLiteral:
        "'{{value}}' is a schema typename compared against a plain-string `__typename`, so a renamed type still compiles. Read the value from a codegen type (its `__typename` is a literal), or narrow the result with `appliedPayload`.",
      enumKeyedTable:
        'Every key of this table is a value of the generated `{{enumName}}`, but the table is keyed by `string`, so a missing or misspelled key compiles. Key it by `{{enumName}}` with computed members (`[{{example}}]: …`).',
    },
  },
  create(context) {
    const services = context.sourceCode.parserServices;
    if (!services?.program) return {};
    const checker = services.program.getTypeChecker();
    const { enumMembers, typenames } = readDomain();
    const typeOf = node =>
      checker.getTypeAtLocation(services.esTreeNodeToTSNodeMap.get(node));

    const checkComparison = (literalNode, operand, reportNode) => {
      const value = stringValue(literalNode);
      if (value === undefined) return;
      const members = enumMembers.get(value);
      const isTypename =
        typenames.has(value) && /typename/i.test(propertyName(operand) ?? '');
      if (!members && !isTypename) return;
      // Domain values arrive through a read; a transformed value (a typed
      // confirmation word upper-cased) is input that merely shares a spelling.
      if (operand.type === 'CallExpression') return;
      if (isCheckedByType(typeOf(operand))) return;
      if (members) {
        context.report({
          node: reportNode,
          messageId: 'enumLiteral',
          data: { value, members: members.map(m => `\`${m}\``).join(' / ') },
        });
      } else {
        context.report({
          node: reportNode,
          messageId: 'typenameLiteral',
          data: { value },
        });
      }
    };

    return {
      BinaryExpression(node) {
        if (!['===', '!==', '==', '!='].includes(node.operator)) return;
        if (stringValue(node.right) !== undefined) {
          checkComparison(node.right, node.left, node.right);
        } else if (stringValue(node.left) !== undefined) {
          checkComparison(node.left, node.right, node.left);
        }
      },
      SwitchCase(node) {
        if (node.test) {
          checkComparison(node.test, node.parent.discriminant, node.test);
        }
      },
      ObjectExpression(node) {
        const keys = node.properties.map(keyOf);
        if (keys.length < 2 || keys.some(key => key === undefined)) return;
        let shared;
        for (const key of keys) {
          const enums = new Set(
            (enumMembers.get(key) ?? []).map(member => member.split('.')[0]),
          );
          shared = shared
            ? new Set([...shared].filter(name => enums.has(name)))
            : enums;
          if (shared.size === 0) return;
        }
        const contextual = checker.getContextualType(
          services.esTreeNodeToTSNodeMap.get(node),
        );
        // Declared properties check the keys; only an index signature, or no
        // declared type at all, lets one go missing or be misspelled.
        if (
          contextual &&
          !checker.getIndexInfoOfType(contextual, ts.IndexKind.String)
        ) {
          return;
        }
        const [enumName] = [...shared];
        const example = enumMembers
          .get(keys[0])
          .find(member => member.startsWith(`${enumName}.`));
        context.report({
          node,
          messageId: 'enumKeyedTable',
          data: { enumName, example },
        });
      },
    };
  },
};
