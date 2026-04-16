// Stub for @react-native-ml-kit/text-recognition in Jest. The real module
// bridges to Apple Vision / Google MLKit native APIs that don't exist in Node.
module.exports = {
  __esModule: true,
  default: {
    recognize: jest.fn(async () => ({ text: '', blocks: [] })),
  },
};
