import { act } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { writeUnitSystemSettings } from '#/test-utils/fixtures/userSettingsFixtures';
import {
  GetUserSettingsDocument,
  UpdateUserPreferencesDocument,
} from '#operations/auth/user.generated';
import { ErrorCode, UnitSystem } from '#/graphql/generated/schemaTypes';
import { useStore } from '#store';
import { MIRRORED_SETTINGS } from '#/domain/serverSettings';
import { useUpdateSettings } from '../useUpdateSettings';

/** What the offline queue resolves a held write with: no payload, no error. */
const queued = () =>
  recordMock(UpdateUserPreferencesDocument, {
    data: { updateSettings: null },
  });

/** `once` answers the first send only, as a refusal of that write alone. */
const refused = ({ once = false } = {}) =>
  recordMock(UpdateUserPreferencesDocument, {
    ...(once && { held: true, maxUsageCount: 1 }),
    data: {
      updateSettings: {
        __typename: 'ValidationError',
        code: ErrorCode.ValidationFailed,
        field: 'shopping',
      },
    },
  });

const render = (...writes: ReturnType<typeof recordMock>[]) => {
  const cache = makeCache();
  writeUnitSystemSettings(cache, UnitSystem.System, UnitSystem.Metric);
  const { result } = renderHookWithApollo(() => useUpdateSettings(), {
    cache,
    operationMocks: writes.map(write => write.mock),
  });
  const cached = () =>
    cache.readQuery({ query: GetUserSettingsDocument, optimistic: true })?.me
      ?.settings;
  return { update: result.current.updateSettings, cached };
};

describe('useUpdateSettings', () => {
  beforeEach(() => {
    useStore.getState().mirrorSettings(MIRRORED_SETTINGS);
  });

  // Offline: the switch is off at once and the change is sent on reconnect.
  it('applies a change at once and keeps it while it waits in the queue', async () => {
    const write = queued();
    const { update, cached } = render(write);

    await act(async () => {
      await update({ storeMode: false });
    });

    expect(useStore.getState().storeMode).toBe(false);
    expect(cached()?.storeMode).toBe(false);
    expect(write.fired).toEqual([
      { input: { shopping: { storeMode: false } } },
    ]);
  });

  it('puts the change back when the server refuses it', async () => {
    const { update, cached } = render(refused());

    let landed = true;
    await act(async () => {
      landed = await update({ budgetAndPrices: true });
    });

    expect(landed).toBe(false);
    expect(useStore.getState().budgetAndPrices).toBeNull();
    expect(cached()?.budgetAndPrices).toBeNull();
  });

  it('leaves a later change standing when an earlier one is refused', async () => {
    const first = refused({ once: true });
    const { update, cached } = render(first, queued());

    // The later write goes out once the earlier one is answered.
    await act(async () => {
      const both = Promise.all([
        update({ budgetAndPrices: true }),
        update({ budgetAndPrices: false }),
      ]);
      first.release();
      await both;
    });

    expect(useStore.getState().budgetAndPrices).toBe(false);
    expect(cached()?.budgetAndPrices).toBe(false);
  });
});
