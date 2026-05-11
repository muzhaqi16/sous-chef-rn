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
        addRRect: jest.fn().mockReturnThis(),
        reset: jest.fn().mockReturnThis(),
      }),
    },
    Color: jest.fn(c => c),
    RRectXY: jest.fn((rect, rx, ry) => ({ rect, rx, ry })),
    XYWHRect: jest.fn((x, y, w, h) => ({ x, y, w, h })),
  },
}));
