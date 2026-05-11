module.exports = {
  createWorkletRuntime: jest.fn(),
  runOnRuntime: jest.fn(),
  useWorklet: jest.fn(),
  scheduleOnRN: jest.fn((fn, ...args) => fn?.(...args)),
};
