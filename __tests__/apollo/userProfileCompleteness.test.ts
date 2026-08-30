/**
 * Cache invariant: every operation that writes the CURRENT user's profile must
 * write the same shape `GetUserProfile` reads.
 *
 * `returnPartialData` is false on the app's watchQuery defaults, so an
 * incomplete cache read yields NO data — not a partial object. `useProfileData`
 * therefore hands back `profile: null`, and `ProfileScreen`'s
 * `loading && !profile` gate shows `ProfileSkeleton` until the network answers,
 * bounded by httpLink's 10s abort. That is the bug this file pins: the profile
 * screen sat on its skeleton for ten seconds because `LoginUser` wrote three of
 * the fields `GetUserProfile` reads, `PartialUser` five, and the `UserEvents`
 * `UserProfile` node ten.
 *
 * The `User.profile` type policy unions fields and can never SHRINK a complete
 * record, so this is not about a later write undoing an earlier one. It is
 * about the record never becoming complete in the first place: on a fresh cache
 * — after login, after `clearStore()`, after a cache-version purge — those
 * writers are the only ones that have run.
 *
 * The shape is compared against `GetUserProfileDocument` itself rather than a
 * hand-copied field list, so narrowing the query narrows the requirement and
 * neither can drift from the other.
 *
 * Meal-plan `createdBy.profile { id displayName avatar }` selections are
 * deliberately NOT covered: they write OTHER users' profiles, which no screen
 * reads through `GetUserProfile`, and widening them would inflate every meal
 * plan payload.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  graphql,
  print,
  Kind,
  OperationTypeNode,
  type DocumentNode,
  type FieldNode,
  type SelectionSetNode,
} from 'graphql';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { addMocksToSchema } from '@graphql-tools/mock';
import { gql } from '@apollo/client';
import type { Unmasked } from '@apollo/client/masking';
import { makeCache } from '#/apollo/cache';
import {
  GetUserProfileDocument,
  UserEventsDocument,
  type GetUserProfileQuery,
  type UserEventsSubscription,
} from '#operations/auth/user.generated';
import {
  LoginDocument,
  type LoginMutation,
} from '#operations/auth/auth.generated';

const PROFILE_ID = 'profile-1';

const mockedSchema = addMocksToSchema({
  schema: makeExecutableSchema({
    typeDefs: fs.readFileSync(
      path.resolve(__dirname, '../../src/graphql/generated/schema.graphql'),
      'utf8',
    ),
  }),
  // Every field resolves, so an executed operation is complete BY CONSTRUCTION
  // for its own selection — which is the point: what each writer omits is then
  // the only thing that can leave the cache short.
  mocks: {
    ID: () => 'mock-id',
    String: () => 'mock-string',
    Int: () => 1,
    Float: () => 1,
    Boolean: () => true,
    DateTime: () => '2026-01-01T00:00:00.000Z',
    Date: () => '2026-01-01',
    JSON: () => ({}),
    BigInt: () => '1',
    FlexibleQuantity: () => '1',
    // Result unions default to their first member — an error type — which would
    // leave the success inline fragment unmatched and the payload undefined.
    LoginResult: () => ({ __typename: 'AuthPayload' }),
    // The subscription node union: we are testing the UserProfile branch.
    UserEventNode: () => ({ __typename: 'UserProfile', id: PROFILE_ID }),
    UserProfile: () => ({ id: PROFILE_ID }),
  },
});

/** Adds `__typename` the way InMemoryCache does before reading/writing. */
const typenameTransformer = makeCache();

async function runAgainstSchema<T>(
  document: DocumentNode,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const result = await graphql({
    schema: mockedSchema,
    source: print(typenameTransformer.transformDocument(document)),
    variableValues: variables,
  });
  if (result.errors) throw new Error(JSON.stringify(result.errors, null, 2));
  return result.data as T;
}

/** Renders `diff.missing` as a readable assertion message. */
const describeMissing = (missing: unknown): string =>
  missing ? JSON.stringify(missing, null, 2) : 'none';

const namedField = (
  selectionSet: SelectionSetNode | undefined,
  name: string,
): FieldNode => {
  const field = selectionSet?.selections.find(
    (selection): selection is FieldNode =>
      selection.kind === Kind.FIELD && selection.name.value === name,
  );
  if (!field) throw new Error(`Expected a "${name}" field in the selection`);
  return field;
};

/** `GetUserProfile`'s `me { profile { … } }` selection — the required shape. */
const requiredProfileSelection = (): SelectionSetNode => {
  const operation = GetUserProfileDocument.definitions.find(
    definition => definition.kind === Kind.OPERATION_DEFINITION,
  );
  if (!operation || operation.kind !== Kind.OPERATION_DEFINITION) {
    throw new Error('GetUserProfile has no operation definition');
  }
  const me = namedField(operation.selectionSet, 'me');
  const profile = namedField(me.selectionSet, 'profile');
  if (!profile.selectionSet) {
    throw new Error('GetUserProfile selects no profile fields');
  }
  return profile.selectionSet;
};

/**
 * A query document whose ROOT selection is the profile shape, for
 * `cache.diff({ id })` — which reads the given entity as the root. This is how
 * `readFragment` works internally, and it lets the entity be checked on its own
 * even when nothing has linked it to `ROOT_QUERY.me` yet (the subscription
 * case).
 */
const profileEntityQuery: DocumentNode = {
  kind: Kind.DOCUMENT,
  definitions: [
    {
      kind: Kind.OPERATION_DEFINITION,
      operation: OperationTypeNode.QUERY,
      name: { kind: Kind.NAME, value: 'ProfileShapeGetUserProfileReads' },
      selectionSet: requiredProfileSelection(),
    },
  ],
};

/** Field names `GetUserProfile` reads off `UserProfile`. */
const requiredProfileFields = (): string[] =>
  requiredProfileSelection()
    .selections.filter(
      (selection): selection is FieldNode => selection.kind === Kind.FIELD,
    )
    .map(field => field.name.value)
    .filter(name => name !== '__typename');

/** Every `UserProfile` field a document selects, anywhere in its definitions. */
const profileFieldsWrittenBy = (document: DocumentNode): Set<string> => {
  const found = new Set<string>();
  const walk = (selectionSet: SelectionSetNode | undefined, inside: boolean) => {
    for (const selection of selectionSet?.selections ?? []) {
      if (selection.kind === Kind.FIELD) {
        if (inside) found.add(selection.name.value);
        walk(selection.selectionSet, inside || selection.name.value === 'profile');
      } else if (selection.kind === Kind.INLINE_FRAGMENT) {
        walk(
          selection.selectionSet,
          inside || selection.typeCondition?.name.value === 'UserProfile',
        );
      }
    }
  };
  for (const definition of document.definitions) {
    if (
      definition.kind === Kind.OPERATION_DEFINITION ||
      definition.kind === Kind.FRAGMENT_DEFINITION
    ) {
      walk(
        definition.selectionSet,
        definition.kind === Kind.FRAGMENT_DEFINITION &&
          definition.typeCondition.name.value === 'UserProfile',
      );
    }
  }
  return found;
};

/**
 * Writes nothing but the `ROOT_QUERY.me` -> `User:<id>` link. Used by the login
 * case, where the user arrives nested under `login` and no query has pointed
 * `me` at it yet.
 */
const LinkMeDocument = gql`
  query LinkMeForProfileCompleteness {
    me {
      id
    }
  }
`;

describe('current user profile cache completeness', () => {
  describe('every writer selects the shape GetUserProfile reads', () => {
    it.each([
      ['Login (LoginUser fragment)', LoginDocument],
      ['UserEvents (UserProfile node)', UserEventsDocument],
    ])('%s', (_label, document) => {
      const written = profileFieldsWrittenBy(document);
      const missing = requiredProfileFields().filter(
        field => !written.has(field),
      );
      expect(missing).toEqual([]);
    });
  });

  it('a login response alone makes GetUserProfile read complete', async () => {
    const cache = makeCache();
    const data = await runAgainstSchema<Unmasked<LoginMutation>>(
      LoginDocument,
      { input: { email: 'a@b.co', password: 'pw' } },
    );
    cache.writeQuery({
      query: LoginDocument,
      variables: { input: { email: 'a@b.co', password: 'pw' } },
      data,
    });
    // Point ROOT_QUERY.me at the user the way a session does — the login
    // payload nests it under `login`, so nothing else links it. Only the
    // reference is written here: the profile fields have to come from what the
    // login response itself normalized, which is the whole point.
    if (data.login.__typename !== 'AuthPayload') {
      throw new Error('mocked login did not resolve to AuthPayload');
    }
    cache.writeQuery<{ me: { __typename: 'User'; id: string } }>({
      query: LinkMeDocument,
      data: { me: { __typename: 'User', id: data.login.user.id } },
    });

    const diff = cache.diff<Unmasked<GetUserProfileQuery>>({
      query: GetUserProfileDocument,
      optimistic: true,
      returnPartialData: true,
    });
    expect(describeMissing(diff.missing)).toBe('none');
    expect(diff.complete).toBe(true);
  });

  it('a PROFILE_CHANGED event writes a complete UserProfile entity', async () => {
    const cache = makeCache();
    const data = await runAgainstSchema<Unmasked<UserEventsSubscription>>(
      UserEventsDocument,
      { userId: 'user-1' },
    );
    // Apollo writes a subscription result under ROOT_SUBSCRIPTION; what matters
    // is the normalized entity it seeds.
    cache.write({
      query: UserEventsDocument,
      variables: { userId: 'user-1' },
      dataId: 'ROOT_SUBSCRIPTION',
      result: data,
    });

    const node = data.userEvents.node;
    expect(node?.__typename).toBe('UserProfile');

    const diff = cache.diff({
      id: cache.identify({ __typename: 'UserProfile', id: PROFILE_ID }),
      query: profileEntityQuery,
      optimistic: true,
      returnPartialData: true,
    });
    expect(describeMissing(diff.missing)).toBe('none');
    expect(diff.complete).toBe(true);
  });
});
