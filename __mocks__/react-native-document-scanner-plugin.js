// The real module calls TurboModuleRegistry.getEnforcing at import.
module.exports = {
  __esModule: true,
  default: { scanDocument: jest.fn() },
  ResponseType: { Base64: 'base64', ImageFilePath: 'imageFilePath' },
  ScanDocumentResponseStatus: { Success: 'success', Cancel: 'cancel' },
};
