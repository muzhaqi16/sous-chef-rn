import { testTypedRule } from '#/test-utils/eslintRuleTester';

const ENUM =
  "import { InviteStatus } from '#/graphql/generated/schemaTypes';\n";

testTypedRule('no-unchecked-domain-literal', {
  valid: [
    // The operand carries the enum, so tsc checks the comparison.
    `${ENUM}declare const status: InviteStatus;\nexport const pending = status === InviteStatus.Pending;`,
    `${ENUM}declare const status: InviteStatus;\nexport const pending = status === 'PENDING';`,
    // Not a domain value.
    'declare const mode: string;\nexport const dark = mode === "dark";',
    // A transformed input that shares an enum value's spelling.
    'declare const typed: string;\nexport const confirmed = typed.toUpperCase() === "DELETE";',
    // A typename compared to something that is not a `__typename`.
    'declare const route: { name: string };\nexport const home = route.name === "Home";',
    // Keyed by the enum through computed members.
    `${ENUM}export const LABEL: Record<InviteStatus, string> = { [InviteStatus.Accepted]: 'a', [InviteStatus.Declined]: 'd', [InviteStatus.Expired]: 'e', [InviteStatus.Pending]: 'p', [InviteStatus.Revoked]: 'r', [InviteStatus.Used]: 'u' };`,
  ],
  invalid: [
    {
      code: 'declare const status: string;\nexport const pending = status === "PENDING";',
      errors: ['enumLiteral'],
    },
    {
      code: 'declare const status: string;\nexport function label() {\n  switch (status) {\n    case "ACCEPTED":\n      return 1;\n    default:\n      return 0;\n  }\n}',
      errors: ['enumLiteral'],
    },
    {
      code: 'declare const payload: { __typename: string };\nexport const invalid = payload.__typename === "ValidationError";',
      errors: ['typenameLiteral'],
    },
    {
      code: 'export const LABEL: Record<string, string> = { PENDING: "p", ACCEPTED: "a" };',
      errors: ['enumKeyedTable'],
    },
  ],
});
