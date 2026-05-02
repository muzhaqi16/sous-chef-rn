'use no memo';
jest.mock('@shopify/react-native-skia', () => ({
  Canvas: 'Canvas',
  Group: 'Group',
  Path: 'Path',
  RoundedRect: 'RoundedRect',
  Circle: 'Circle',
  Rect: 'Rect',
  Line: 'Line',
  Text: 'SkiaText',
  useFont: jest.fn(() => null),
  useValue: jest.fn(() => ({ current: 0 })),
  Skia: {
    Path: {
      Make: () => ({
        moveTo: jest.fn().mockReturnThis(),
        lineTo: jest.fn().mockReturnThis(),
        quadTo: jest.fn().mockReturnThis(),
        cubicTo: jest.fn().mockReturnThis(),
        close: jest.fn().mockReturnThis(),
        addCircle: jest.fn().mockReturnThis(),
        reset: jest.fn().mockReturnThis(),
      }),
    },
    Color: jest.fn(c => c),
  },
}));
