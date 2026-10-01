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
