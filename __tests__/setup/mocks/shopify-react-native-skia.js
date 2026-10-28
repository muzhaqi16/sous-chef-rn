'use no memo';
jest.mock('@shopify/react-native-skia', () => {
  const makePathBuilder = () => {
    const path = { __skPath: true };
    return {
      moveTo: jest.fn().mockReturnThis(),
      lineTo: jest.fn().mockReturnThis(),
      quadTo: jest.fn().mockReturnThis(),
      cubicTo: jest.fn().mockReturnThis(),
      close: jest.fn().mockReturnThis(),
      addCircle: jest.fn().mockReturnThis(),
      addRRect: jest.fn().mockReturnThis(),
      reset: jest.fn().mockReturnThis(),
      build: jest.fn(() => path),
      detach: jest.fn(() => path),
    };
  };
  const makePaint = () => ({
    setColor: jest.fn(),
    setAntiAlias: jest.fn(),
    setStyle: jest.fn(),
    setStrokeWidth: jest.fn(),
    setStrokeCap: jest.fn(),
  });
  const makeCanvas = () => ({
    save: jest.fn(),
    restore: jest.fn(),
    translate: jest.fn(),
    scale: jest.fn(),
    rotate: jest.fn(),
    clipPath: jest.fn(),
    clipRRect: jest.fn(),
    drawPath: jest.fn(),
    drawRRect: jest.fn(),
    drawCircle: jest.fn(),
  });

  return {
    Canvas: 'Canvas',
    Group: 'Group',
    Path: 'Path',
    Picture: 'Picture',
    RoundedRect: 'RoundedRect',
    Circle: 'Circle',
    Rect: 'Rect',
    Line: 'Line',
    Text: 'SkiaText',
    ClipOp: { Difference: 0, Intersect: 1 },
    PaintStyle: { Fill: 0, Stroke: 1 },
    StrokeCap: { Butt: 0, Round: 1, Square: 2 },
    useFont: jest.fn(() => null),
    useValue: jest.fn(() => ({ current: 0 })),
    createPicture: jest.fn(cb => {
      cb(makeCanvas());
      return { __skPicture: true };
    }),
    Skia: {
      PathBuilder: { Make: makePathBuilder },
      Paint: jest.fn(makePaint),
      Color: jest.fn(c => c),
      RRectXY: jest.fn((rect, rx, ry) => ({ rect, rx, ry })),
      XYWHRect: jest.fn((x, y, w, h) => ({ x, y, w, h })),
    },
  };
});
