import { NativeModules } from 'react-native';
import { TextRecognition } from '../TextRecognition';

const nativeModules = NativeModules as Record<string, unknown>;

afterEach(() => {
  delete nativeModules.TextRecognitionModule;
});

describe('TextRecognition', () => {
  it('rejects when the app target was built without the module', async () => {
    await expect(
      TextRecognition.recognizeAndDelete(['file:///page.jpg']),
    ).rejects.toThrow('TextRecognitionModule is not linked');
  });

  it("keeps a line's slope when the module reports one", async () => {
    nativeModules.TextRecognitionModule = {
      recognizeAndDelete: jest.fn().mockResolvedValue([
        {
          lines: [
            {
              text: 'MILK',
              x: 0.1,
              y: 0.2,
              width: 0.5,
              height: 0.03,
              slope: -0.17,
            },
            {
              text: 'EGGS',
              x: 0.1,
              y: 0.3,
              width: 0.5,
              height: 0.03,
              slope: NaN,
            },
          ],
        },
      ]),
    };

    const [page] = await TextRecognition.recognizeAndDelete(['file:///a.jpg']);

    expect(page?.lines.map(line => line.slope)).toEqual([-0.17, undefined]);
  });

  it('passes the pages through and keeps only well-formed lines', async () => {
    const recognizeAndDelete = jest.fn().mockResolvedValue([
      {
        lines: [
          { text: 'MILK  3.48', x: 0.1, y: 0.2, width: 0.5, height: 0.03 },
          { text: 'no frame' },
          { text: 42, x: 0, y: 0, width: 0, height: 0 },
        ],
      },
      { lines: 'not a list' },
    ]);
    nativeModules.TextRecognitionModule = { recognizeAndDelete };

    const pages = await TextRecognition.recognizeAndDelete(['file:///a.jpg']);

    expect(recognizeAndDelete).toHaveBeenCalledWith(['file:///a.jpg']);
    expect(pages).toEqual([
      {
        lines: [
          { text: 'MILK  3.48', x: 0.1, y: 0.2, width: 0.5, height: 0.03 },
        ],
      },
      { lines: [] },
    ]);
  });
});
