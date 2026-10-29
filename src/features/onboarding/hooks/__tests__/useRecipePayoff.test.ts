import { renderHook } from '@testing-library/react-native';
import {
  initialOnboardingProgress,
  useOnboardingProgressStore,
} from '#features/onboarding/store/onboardingProgressStore';
import { useRecipePayoff } from '../useRecipePayoff';

jest.mock('#store/useAppStore', () => ({
  useSelectedHomeId: () => 'home-1',
}));

let mockFlagOn = true;
jest.mock('#hooks/settings/useFeatureFlag', () => ({
  useFeatureFlag: () => mockFlagOn,
}));

let mockRestrictionsInPlay: boolean | null = false;
jest.mock('#features/profile/hooks/useRestrictionsInPlay', () => ({
  useRestrictionsInPlay: () => mockRestrictionsInPlay,
}));

const suggestion = (id: string, coverage: number) => ({
  source: 'suggestion',
  edge: {
    coverage,
    expiringStacks: [],
    node: { id, name: id, imageUrl: null, servings: 2, totalTimeMinutes: 20 },
  },
});
let mockRows: ReturnType<typeof suggestion>[] = [];
const mockSuggestions = jest.fn((enabled: boolean) => ({
  rows: enabled ? mockRows : [],
}));
jest.mock('#features/recipes/hooks/useServerRecipeSuggestions', () => ({
  useServerRecipeSuggestions: (enabled: boolean) => mockSuggestions(enabled),
}));

const ids = (rows: { edge: { node: { id: string } } }[]) =>
  rows.map(row => row.edge.node.id);
const askedFor = () => mockSuggestions.mock.calls.some(([enabled]) => enabled);

beforeEach(() => {
  jest.clearAllMocks();
  mockFlagOn = true;
  mockRestrictionsInPlay = false;
  mockRows = [];
  useOnboardingProgressStore.setState({ ...initialOnboardingProgress });
});

describe('useRecipePayoff', () => {
  it('shows up to three for a user with no restriction', () => {
    mockRows = ['a', 'b', 'c', 'd'].map(id => suggestion(id, 50));
    const { result } = renderHook(() => useRecipePayoff());

    expect(ids(result.current.rows)).toEqual(['a', 'b', 'c']);
  });

  it('leaves out a recipe the pantry holds nothing of', () => {
    mockRows = [suggestion('a', 0), suggestion('b', 40)];
    const { result } = renderHook(() => useRecipePayoff());

    expect(ids(result.current.rows)).toEqual(['b']);
  });

  it('shows none with no candidate', () => {
    const { result } = renderHook(() => useRecipePayoff());

    expect(result.current.rows).toEqual([]);
  });

  it('asks for none for a user with a saved restriction, until the API screens them', () => {
    mockRestrictionsInPlay = true;
    mockRows = [suggestion('a', 50)];
    const { result } = renderHook(() => useRecipePayoff());

    expect(result.current.rows).toEqual([]);
    expect(askedFor()).toBe(false);
  });

  it('asks for none while it is unknown whether a restriction is in play', () => {
    mockRestrictionsInPlay = null;
    renderHook(() => useRecipePayoff());

    expect(askedFor()).toBe(false);
  });

  it('asks for none once this onboarding saved a restriction', () => {
    useOnboardingProgressStore.setState({ dietarySaved: true });
    renderHook(() => useRecipePayoff());

    expect(askedFor()).toBe(false);
  });

  it('asks for nothing with pantry suggestions off', () => {
    mockFlagOn = false;
    renderHook(() => useRecipePayoff());

    expect(askedFor()).toBe(false);
  });
});
