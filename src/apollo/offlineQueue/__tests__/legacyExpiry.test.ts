import { parse } from 'graphql';
import { RestockPantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { withExpiresOn } from '../legacyExpiry';

describe('withExpiresOn', () => {
  it('replays a queued local-midnight instant as that local day', () => {
    const picked = new Date(2026, 8, 21);
    expect(
      withExpiresOn(RestockPantryItemDocument, {
        input: { id: 'p1', expiresAt: picked.toISOString() },
      }),
    ).toEqual({ input: { id: 'p1', expiresOn: '2026-09-21' } });
  });

  it('keeps a cleared expiry cleared', () => {
    expect(
      withExpiresOn(RestockPantryItemDocument, {
        input: { id: 'p1', expiresAt: null },
      }),
    ).toEqual({ input: { id: 'p1', expiresOn: null } });
  });

  it('leaves a write that already sends expiresOn alone', () => {
    const variables = { input: { id: 'p1', expiresOn: '2026-09-21' } };
    expect(withExpiresOn(RestockPantryItemDocument, variables)).toBe(variables);
  });

  // An invite's expiry is still an instant.
  it('leaves an input whose expiresAt did not move alone', () => {
    const invite = parse(
      'mutation Invite($input: InviteToShoppingListInput!) { inviteToShoppingList(input: $input) { __typename } }',
    );
    const variables = {
      input: { listId: 'l1', expiresAt: '2026-09-21T10:00:00.000Z' },
    };
    expect(withExpiresOn(invite, variables)).toBe(variables);
  });
});
