module.exports = {
  createClient: jest.fn(() => ({
    on: jest.fn(),
    subscribe: jest.fn(),
    dispose: jest.fn(),
    terminate: jest.fn(),
  })),
};
