import { markTutorialsSeen } from '../markTutorialsSeen';
import { UpdateUserPreferencesDocument } from '#operations/auth/user.generated';
import { storage } from '#/storage/mmkv';

jest.mock('#/storage/mmkv', () => {
  const store = new Map<string, boolean | string | number | ArrayBuffer>();
  return {
    __mockStore: store,
    storage: {
      getString: (key: string) => store.get(key),
      getNumber: (key: string) => store.get(key),
      getBoolean: (key: string) => store.get(key),
      set: (key: string, value: boolean | string | number | ArrayBuffer) =>
        store.set(key, value),
      remove: (key: string) => store.delete(key),
      delete: (key: string) => store.delete(key),
      contains: (key: string) => store.has(key),
      clearAll: () => store.clear(),
      getAllKeys: () => [...store.keys()],
    },
  };
});

const { __mockStore: mockStore } = jest.requireMock<{
  __mockStore: Map<string, boolean | string | number | ArrayBuffer>;
}>('#/storage/mmkv');

const mockMutate = jest.fn().mockResolvedValue({ data: {} });
jest.mock('#/apollo/client', () => ({
  client: { mutate: (...args: unknown[]) => mockMutate(...args) },
  cancelCachePersistence: jest.fn(),
  flushCachePersistence: jest.fn(),
}));

const mockBump = jest.fn();
jest.mock('#store', () => ({
  useStore: { getState: () => ({ bumpTutorialResetGeneration: mockBump }) },
}));

beforeEach(() => {
  mockStore.clear();
  mockStore.set('user_show_tutorials', true);
  mockMutate.mockClear();
  mockBump.mockClear();
});

describe('markTutorialsSeen', () => {
  it('turns the server showTutorials flag off and mirrors it locally', () => {
    markTutorialsSeen();

    // Local mirror written synchronously so MMKV consumers are consistent now.
    expect(storage.getBoolean('user_show_tutorials')).toBe(false);
    // Mounted tutorial hooks are signalled to re-read.
    expect(mockBump).toHaveBeenCalledTimes(1);
    // Server mutation fires with the nested UI-preferences input.
    expect(mockMutate).toHaveBeenCalledWith({
      mutation: UpdateUserPreferencesDocument,
      variables: { input: { ui: { showTutorials: false } } },
    });
  });
});
