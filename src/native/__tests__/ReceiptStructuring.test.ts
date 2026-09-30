import { NativeModules } from 'react-native';
import { ReceiptStructuring } from '../ReceiptStructuring';

const nativeModules = NativeModules as Record<string, unknown>;

afterEach(() => {
  delete nativeModules.ReceiptStructuringModule;
});

describe('ReceiptStructuring', () => {
  it('reads as unavailable where the app has no module (Android today)', async () => {
    await expect(ReceiptStructuring.availability()).resolves.toBe(
      'unavailable',
    );
    await expect(ReceiptStructuring.labelLines(['MILK'])).rejects.toThrow(
      'ReceiptStructuringModule is not linked',
    );
  });

  it('passes the model’s status through, and anything else as unavailable', async () => {
    const availability = jest
      .fn()
      .mockResolvedValueOnce('available')
      .mockResolvedValueOnce('downloading')
      .mockResolvedValueOnce('surprise');
    nativeModules.ReceiptStructuringModule = {
      availability,
      labelLines: jest.fn(),
    };

    await expect(ReceiptStructuring.availability()).resolves.toBe('available');
    await expect(ReceiptStructuring.availability()).resolves.toBe(
      'downloading',
    );
    await expect(ReceiptStructuring.availability()).resolves.toBe(
      'unavailable',
    );
  });

  it('keeps only well-formed labels and trims the names', async () => {
    const labelLines = jest.fn().mockResolvedValue({
      storeName: ' WALMART ',
      lines: [
        { line: 0, kind: 'header' },
        { line: 1, kind: 'item', product: ' GV WHOLE MILK ' },
        { line: 2, kind: 'mystery' },
        { line: 'three', kind: 'item' },
        { line: 4, kind: 'item', product: '   ' },
      ],
    });
    nativeModules.ReceiptStructuringModule = {
      availability: jest.fn(),
      labelLines,
    };

    const labels = await ReceiptStructuring.labelLines(['a', 'b']);

    expect(labelLines).toHaveBeenCalledWith(['a', 'b']);
    expect(labels).toEqual({
      storeName: 'WALMART',
      lines: [
        { line: 0, label: 'header' },
        { line: 1, label: 'item', product: 'GV WHOLE MILK' },
        { line: 4, label: 'item' },
      ],
    });
  });
});
