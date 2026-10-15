// The real module ships untranspiled and holds the screen awake natively;
// a test has no screen to hold.
const KeepAwake = () => null;

module.exports = {
  __esModule: true,
  default: KeepAwake,
  useKeepAwake: jest.fn(),
  activateKeepAwake: jest.fn(),
  deactivateKeepAwake: jest.fn(),
};
