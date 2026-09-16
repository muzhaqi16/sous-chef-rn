const { selectorRule } = require('../selectorRule');
const { readCodegenEnums } = require('../codegenEnums');

const ARRAY_GENERICS = new Set(['Array', 'ReadonlyArray']);

const referencedName = typeName =>
  typeName.type === 'TSQualifiedName' ? typeName.right.name : typeName.name;

/**
 * An enum, or a union / array / `Array<>` / `ReadonlyArray<>` built only from
 * enums plus `null` and `undefined`. Matched by name, so a local type that
 * shadows a generated enum's name is reported too.
 */
const isEnumType = node => {
  switch (node.type) {
    case 'TSTypeReference': {
      const name = referencedName(node.typeName);
      const params = node.typeArguments?.params ?? [];
      if (ARRAY_GENERICS.has(name)) {
        return params.length === 1 && isEnumType(params[0]);
      }
      return params.length === 0 && readCodegenEnums().has(name);
    }
    case 'TSArrayType':
      return isEnumType(node.elementType);
    case 'TSTypeOperator':
      return node.operator === 'readonly' && isEnumType(node.typeAnnotation);
    case 'TSUnionType': {
      const named = node.types.filter(
        member =>
          member.type !== 'TSNullKeyword' &&
          member.type !== 'TSUndefinedKeyword',
      );
      return named.length > 0 && named.every(isEnumType);
    }
    default:
      return false;
  }
};

module.exports = selectorRule({
  name: 'no-schema-enum-cast',
  description: 'No casts to a generated schema enum.',
  checks: [
    {
      messageId: 'asSchemaEnum',
      selector: 'TSAsExpression',
      when: node => isEnumType(node.typeAnnotation),
      message:
        'Do not cast to a generated schema enum — it lets through a string the schema has no member for, and the server refuses it. Type the source as the enum where it is declared, make a generic picker carry the enum type, or narrow with a guard (`(v: string): v is E => new Set<string>(Object.values(E)).has(v)`); build an enum list with `flatMap(r => (r.x ? [r.x] : []))`, not `.filter(Boolean) as E[]`.',
    },
  ],
});
