import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { TopLevelErrorCode } from '../topLevelErrorCodes';

/**
 * `TopLevelErrorCode` stopped being generated when the API's admin cleanup left
 * it unreachable from the schema, so its strings are no longer checked against
 * the server (see the module docblock). That is the whole risk: a code renamed
 * server-side leaves a predicate here that compiles and matches nothing.
 *
 * `ErrorCode` IS still generated, and most of these conditions travel on both
 * channels. Pinning the overlap restores the drift check for that subset — a
 * rename lands in `ErrorCode` on the next `npm run codegen` and fails here.
 */
describe('TopLevelErrorCode against the still-generated ErrorCode', () => {
  /** Same condition, same spelling on both channels. */
  const SHARED: ReadonlyArray<[keyof typeof TopLevelErrorCode, ErrorCode]> = [
    ['AuthAccountLocked', ErrorCode.AuthAccountLocked],
    ['AuthAccountSuspended', ErrorCode.AuthAccountSuspended],
    ['AuthCredentialsInvalid', ErrorCode.AuthCredentialsInvalid],
    ['AuthRefreshTokenInvalid', ErrorCode.AuthRefreshTokenInvalid],
    ['AuthTokenExpired', ErrorCode.AuthTokenExpired],
    ['AuthTokenMissing', ErrorCode.AuthTokenMissing],
    ['EmailAlreadyExists', ErrorCode.EmailAlreadyExists],
    ['EmailAlreadyVerified', ErrorCode.EmailAlreadyVerified],
    ['Forbidden', ErrorCode.Forbidden],
    ['PantryItemAlreadyExists', ErrorCode.PantryItemAlreadyExists],
    ['ResourceAlreadyExists', ErrorCode.ResourceAlreadyExists],
    ['UnitInvalid', ErrorCode.UnitInvalid],
    ['ValidationFailed', ErrorCode.ValidationFailed],
  ];

  it.each(SHARED)(
    '%s matches the generated ErrorCode value',
    (member, code) => {
      expect(TopLevelErrorCode[member]).toBe(code);
    },
  );

  /**
   * Same condition, deliberately DIFFERENT spelling per channel — the schema
   * documents each one ("The union-member spelling is CONFLICT"). Asserted so
   * that nobody later "aligns" them and silently breaks every top-level match.
   */
  const DIVERGENT: ReadonlyArray<
    [keyof typeof TopLevelErrorCode, string, ErrorCode]
  > = [
    ['ResourceNotFound', 'RESOURCE_NOT_FOUND', ErrorCode.NotFound],
    ['ResourceConflict', 'RESOURCE_CONFLICT', ErrorCode.Conflict],
    [
      'ResourceVersionConflict',
      'RESOURCE_VERSION_CONFLICT',
      ErrorCode.VersionConflict,
    ],
    ['HomeNotAMember', 'HOME_NOT_A_MEMBER', ErrorCode.HomeAccessDenied],
  ];

  it.each(DIVERGENT)(
    '%s stays distinct from its union-channel counterpart',
    (member, expected, unionCode) => {
      expect(TopLevelErrorCode[member]).toBe(expected);
      expect(TopLevelErrorCode[member]).not.toBe(unionCode);
    },
  );

  it('has no member whose name collides with ErrorCode under a different value', () => {
    // Catches the subtler drift: a shared member name that stopped agreeing,
    // including ones absent from SHARED above.
    // Compared as strings: both sides are nominal TS enums, so TypeScript
    // rejects a direct `!==` between them as having no overlap.
    const mismatched = Object.entries(TopLevelErrorCode)
      .filter(([name]) => name in ErrorCode)
      .filter(
        ([name, value]) =>
          String(ErrorCode[name as keyof typeof ErrorCode]) !== String(value) &&
          !DIVERGENT.some(([divergent]) => divergent === name),
      )
      .map(([name, value]) => `${name}: ${value}`);

    expect(mismatched).toEqual([]);
  });
});
