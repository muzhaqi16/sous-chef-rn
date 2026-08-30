/**
 * An opt-in established outside a test still reaches the test that consumes it.
 *
 * A wrapper built ONCE for a whole file — `AddMealSheet.test.tsx:145` already
 * does this — registers whatever its mocks opted into before any `beforeEach`
 * has run. When the global setup owned the exemption set, its `beforeEach`
 * replaced it and the opt-in was gone before the first test: `partial: true`
 * type-checked, read as an opt-out, and did nothing.
 *
 * Needs its own file because the construction has to happen at module scope,
 * which is the whole point.
 */
import { gql } from '@apollo/client';
import {
  createApolloTestWrapper,
  recordMock,
} from '#/test-utils/apolloMockProvider';

const UNITS = gql`
  query HoistedOptInProbeUnits {
    units {
      id
      name
    }
  }
`;

const partial = recordMock(UNITS, {
  data: { units: [{ __typename: 'Unit', id: 'u-1' }] },
  partial: true,
});

// Module scope, before any hook runs.
createApolloTestWrapper({ operationMocks: [partial.mock] });

const exemptions = () =>
  (globalThis as { __apolloPartialFieldExemptions?: Set<string> })
    .__apolloPartialFieldExemptions;

describe('a wrapper built once for the file keeps its opt-in', () => {
  it('reaches the first test', () => {
    expect(exemptions()?.has('Unit.name')).toBe(true);
  });

  it('reaches every later test too', () => {
    expect(exemptions()?.has('Unit.name')).toBe(true);
    // ...and stays as narrow as the payload it was derived from.
    expect(exemptions()?.has('Unit.id')).toBe(false);
  });
});
