import { readFileSync } from 'fs';
import path from 'path';
import {
  buildSchema,
  getNamedType,
  isEnumType,
  isObjectType,
  isUnionType,
  type GraphQLObjectType,
} from 'graphql';
import { ErrorCode, TopLevelErrorCode } from '#/graphql/generated/schemaTypes';
import { appliedPayload } from '../mutationPayload';

const schema = buildSchema(
  readFileSync(
    path.resolve(__dirname, '../../../graphql/generated/schema.graphql'),
    'utf8',
  ),
);

const codeValueSets = [ErrorCode, TopLevelErrorCode].map(codes =>
  [...Object.values(codes)].sort().join(),
);

// A refusal is the member carrying a field typed by one of the codegen error-code enums.
const isRefusal = (member: GraphQLObjectType) =>
  Object.values(member.getFields()).some(field => {
    const type = getNamedType(field.type);
    return (
      isEnumType(type) &&
      codeValueSets.includes(
        type
          .getValues()
          .map(v => v.value)
          .sort()
          .join(),
      )
    );
  });

const mutationUnions = Object.values(
  schema.getMutationType()?.getFields() ?? {},
).flatMap(field => {
  const type = getNamedType(field.type);
  return isUnionType(type)
    ? [{ field: field.name, members: type.getTypes() }]
    : [];
});

describe('appliedPayload', () => {
  it('finds mutation result unions in the schema', () => {
    expect(mutationUnions.length).toBeGreaterThan(0);
  });

  it.each(mutationUnions)(
    '$field: returns its success member and null for each refusal',
    ({ field, members }) => {
      const successes = members.filter(m => isObjectType(m) && !isRefusal(m));
      expect(successes).toHaveLength(1);

      for (const member of members) {
        const payload = { __typename: member.name };
        const result = appliedPayload({ [field]: payload });
        expect(result).toBe(isRefusal(member) ? null : payload);
      }
    },
  );

  it('returns null for a queued write, whose payload is null', () => {
    const [first] = mutationUnions;
    expect(appliedPayload(first ? { [first.field]: null } : null)).toBeNull();
  });
});
