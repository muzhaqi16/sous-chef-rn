import { waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { GetUserSettingsDocument } from '#operations/auth/user.generated';
import { UnitSystem } from '#/graphql/generated/schemaTypes';
import { useReadingSystem } from '../useReadingSystem';

const settingsMock = (
  preferredUnitSystem: UnitSystem,
  deviceUnitSystem: UnitSystem,
) => {
  const data: MockDataFor<typeof GetUserSettingsDocument> = {
    me: {
      __typename: 'User',
      id: 'user-1',
      settings: {
        __typename: 'UserSettings',
        id: 'settings-1',
        preferredUnitSystem,
        deviceUnitSystem,
      },
    },
  };
  return recordMock(GetUserSettingsDocument, { data });
};

describe('useReadingSystem', () => {
  it.each([
    [
      'an explicit metric on an imperial device',
      UnitSystem.Metric,
      UnitSystem.Imperial,
      UnitSystem.Metric,
    ],
    [
      'an explicit imperial on a metric device',
      UnitSystem.Imperial,
      UnitSystem.Metric,
      UnitSystem.Imperial,
    ],
    [
      '"Device default" on an en-US device',
      UnitSystem.System,
      UnitSystem.Imperial,
      UnitSystem.Imperial,
    ],
    [
      '"Device default" on a de-DE device',
      UnitSystem.System,
      UnitSystem.Metric,
      UnitSystem.Metric,
    ],
  ])('reads %s', async (_label, preferred, device, expected) => {
    const { result } = renderHookWithApollo(() => useReadingSystem(), {
      operationMocks: [settingsMock(preferred, device).mock],
    });
    await waitFor(() => expect(result.current).toBe(expected));
  });
});
