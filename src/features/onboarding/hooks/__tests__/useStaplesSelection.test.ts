import { act } from '@testing-library/react-native';
import {
  DietaryAlertState,
  StorageState,
} from '#/graphql/generated/schemaTypes';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { useStore } from '#store';
import {
  initialOnboardingProgress,
  useOnboardingProgressStore,
} from '#features/onboarding/store/onboardingProgressStore';
import { GetOnboardingItemsDocument } from '../useOnboardingItems.generated';
import { useStaplesSelection } from '../useStaplesSelection';

const mockAddItem = jest.fn();
const mockRemoveItem = jest.fn();
/** The pantry's rows by catalog id. */
let mockHeld = new Map<string, string>();
jest.mock('#features/pantry/hooks/usePantryItemSelection', () => ({
  usePantryItemSelection: () => ({
    existingItemMap: mockHeld,
    existingCatalogIds: new Set(mockHeld.keys()),
    loading: false,
    hasLoaded: true,
    state: 'ready',
    refetch: jest.fn(),
    addItem: mockAddItem,
    removeItem: mockRemoveItem,
  }),
}));

const own = (state: DietaryAlertState) => ({
  state,
  membership: { id: 'm-me', userId: 'user-1' },
});
const anothers = {
  state: DietaryAlertState.Contains,
  membership: { id: 'm-sam', userId: 'user-2' },
};

const staple = (
  id: string,
  name: string,
  storageState: StorageState,
  dietaryAlerts: ReturnType<typeof own>[] = [],
) => ({ id, name, storageState, imageUrl: null, dietaryAlerts });

const STAPLES = [
  staple('milk', 'Milk', StorageState.Refrigerated),
  staple('peas', 'Peas', StorageState.Frozen),
  staple('rice', 'Rice', StorageState.None),
  // A diet's clash arrives as MAY_CONTAIN on a meat department.
  staple('bacon', 'Bacon', StorageState.Refrigerated, [
    own(DietaryAlertState.MayContain),
  ]),
  staple('peanuts', 'Peanuts', StorageState.Ambient, [
    own(DietaryAlertState.Contains),
  ]),
  // Only another member's restriction: still the user's to keep.
  staple('shrimp', 'Shrimp', StorageState.Frozen, [anothers]),
];

async function renderStaples() {
  const staples = recordMock(GetOnboardingItemsDocument, {
    data: {
      items: {
        edges: STAPLES.map((node, index) => ({ cursor: `c${index}`, node })),
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    },
  });
  const log = operationLog();
  const rendered = renderHookWithApollo(() => useStaplesSelection(), {
    operationMocks: [staples.mock],
    links: [log.link],
  });
  await act(async () => {
    await log.answered(GetOnboardingItemsDocument);
  });
  return { ...rendered, staples };
}

const namesIn = (
  groups: ReturnType<typeof useStaplesSelection>['groups'],
  state: StorageState,
) =>
  groups.find(group => group.state === state)?.items.map(item => item.name) ??
  [];

beforeEach(() => {
  jest.clearAllMocks();
  mockHeld = new Map();
  mockAddItem.mockResolvedValue({ status: 'added' });
  mockRemoveItem.mockResolvedValue(true);
  useOnboardingProgressStore.setState({ ...initialOnboardingProgress });
  useStore.setState({
    user: {
      id: 'user-1',
      email: 'nora@example.com',
      emailVerified: false,
      onBoarded: false,
    },
    selectedHomeId: 'home-1',
    selectedPantryId: 'p1',
  });
});

afterEach(() => useStore.setState({ user: null }));

describe('useStaplesSelection', () => {
  it('asks for curated foods only, grouped fridge, freezer and pantry', async () => {
    const { result, staples } = await renderStaples();

    const [fired] = staples.fired;
    // The curated path applies only these; any other filter is refused.
    expect(Object.keys(fired?.filters ?? {}).sort()).toEqual([
      'curation',
      'level',
      'types',
    ]);
    expect(fired?.homeId).toBe('home-1');
    expect(result.current.state).toBe('ready');
    expect(namesIn(result.current.groups, StorageState.Refrigerated)).toEqual([
      'Milk',
    ]);
    expect(namesIn(result.current.groups, StorageState.Frozen)).toEqual([
      'Peas',
      'Shrimp',
    ]);
    // A food kept anywhere else is the pantry's.
    expect(namesIn(result.current.groups, StorageState.Ambient)).toEqual([
      'Rice',
    ]);
  });

  it("leaves out a food on any alert for the user's own answers", async () => {
    const { result } = await renderStaples();

    const offered = result.current.groups.flatMap(group =>
      group.items.map(item => item.name),
    );
    expect(offered).not.toContain('Bacon');
    expect(offered).not.toContain('Peanuts');
    expect(offered).toContain('Shrimp');
  });

  it('adds each pick where it is kept, with no unit, and counts it', async () => {
    const { result } = await renderStaples();
    act(() => {
      result.current.toggle('milk');
      result.current.toggle('peas');
    });
    expect(result.current.hasChanges).toBe(true);
    expect(result.current.isFirstVisit).toBe(true);

    await act(async () => {
      await result.current.save();
    });

    expect(mockAddItem).toHaveBeenCalledTimes(2);
    for (const [, input] of mockAddItem.mock.calls) {
      // The server picks the unit the food is tracked in.
      expect(input).not.toHaveProperty('unit');
    }
    expect(
      mockAddItem.mock.calls.map(([, input]) => input.storage.storageState),
    ).toEqual([StorageState.Refrigerated, StorageState.Frozen]);
    expect(useOnboardingProgressStore.getState().stapleItems).toBe(2);
  });

  it('never counts a refused add', async () => {
    mockAddItem.mockResolvedValue({ status: 'rejected' });
    const { result } = await renderStaples();
    act(() => result.current.toggle('milk'));

    await act(async () => {
      await result.current.save();
    });

    expect(useOnboardingProgressStore.getState().stapleItems).toBe(0);
  });

  it("never takes out what it does not offer: a receipt's items, a food left out", async () => {
    mockHeld = new Map([
      ['milk', 'row-milk'],
      ['receipt-steak', 'row-steak'],
      ['peanuts', 'row-peanuts'],
    ]);
    const { result } = await renderStaples();
    expect(result.current.hasChanges).toBe(false);

    act(() => result.current.toggle('peas'));
    await act(async () => {
      await result.current.save();
    });

    expect(mockRemoveItem).not.toHaveBeenCalled();
    expect(mockAddItem).toHaveBeenCalledTimes(1);
  });

  it('starts with what the pantry holds, and takes out one unpicked', async () => {
    mockHeld = new Map([['milk', 'row-milk']]);
    useOnboardingProgressStore.setState({ stapleItems: 3 });
    const { result } = await renderStaples();
    expect(result.current.selectedCount).toBe(1);
    expect(result.current.hasChanges).toBe(false);

    act(() => result.current.toggle('milk'));
    await act(async () => {
      await result.current.save();
    });

    expect(mockRemoveItem).toHaveBeenCalledWith('row-milk');
    expect(mockAddItem).not.toHaveBeenCalled();
    expect(useOnboardingProgressStore.getState().stapleItems).toBe(2);
  });
});
