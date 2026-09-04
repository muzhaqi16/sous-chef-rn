'use no memo';
jest.mock('react-native-mmkv', () => {
  const createInstance = () => {
    const store = new Map();
    return {
      set: jest.fn((key, value) => store.set(key, value)),
      getString: jest.fn(key => store.get(key)),
      getNumber: jest.fn(key => store.get(key)),
      getBoolean: jest.fn(key => store.get(key)),
      remove: jest.fn(key => store.delete(key)),
      contains: jest.fn(key => store.has(key)),
      clearAll: jest.fn(() => store.clear()),
      getAllKeys: jest.fn(() => [...store.keys()]),
    };
  };
  return {
    createMMKV: jest.fn().mockImplementation(createInstance),
    // Non-creating existence probe. Defaults to true so a suite that does not
    // care sees the store it expects; the recovery tests drive it explicitly.
    existsMMKV: jest.fn(() => true),
  };
});
