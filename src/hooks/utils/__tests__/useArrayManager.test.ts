'use no memo';

import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useArrayManager } from '../useArrayManager';

jest.spyOn(Alert, 'alert');

describe('useArrayManager', () => {
  const mockOnUpdate = jest.fn<Promise<boolean>, [string[]]>();

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnUpdate.mockResolvedValue(true);
  });

  it('initializes with provided items', () => {
    const { result } = renderHook(() =>
      useArrayManager({
        initialValues: ['a', 'b', 'c'],
        onUpdate: mockOnUpdate,
      }),
    );

    expect(result.current.items).toEqual(['a', 'b', 'c']);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('add() adds an item and calls onUpdate', async () => {
    const { result } = renderHook(() =>
      useArrayManager({
        initialValues: ['a'],
        onUpdate: mockOnUpdate,
      }),
    );

    await act(async () => {
      const success = await result.current.add('b');
      expect(success).toBe(true);
    });

    expect(result.current.items).toEqual(['a', 'b']);
    expect(mockOnUpdate).toHaveBeenCalledWith(['a', 'b']);
  });

  it('add() transforms item before adding', async () => {
    const { result } = renderHook(() =>
      useArrayManager<string>({
        initialValues: [],
        onUpdate: mockOnUpdate,
        transform: (item: string) => item.trim().toLowerCase(),
      }),
    );

    await act(async () => {
      await result.current.add('  Hello  ');
    });

    expect(result.current.items).toEqual(['hello']);
    expect(mockOnUpdate).toHaveBeenCalledWith(['hello']);
  });

  it('add() rejects duplicate items', async () => {
    const { result } = renderHook(() =>
      useArrayManager({
        initialValues: ['a', 'b'],
        onUpdate: mockOnUpdate,
      }),
    );

    await act(async () => {
      const success = await result.current.add('a');
      expect(success).toBe(false);
    });

    expect(result.current.items).toEqual(['a', 'b']);
    expect(mockOnUpdate).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'This item already exists');
  });

  it('add() validates and rejects invalid items', async () => {
    const { result } = renderHook(() =>
      useArrayManager<string>({
        initialValues: [],
        onUpdate: mockOnUpdate,
        validate: (item: string) => (item.length === 0 ? 'Cannot be empty' : null),
      }),
    );

    await act(async () => {
      const success = await result.current.add('');
      expect(success).toBe(false);
    });

    expect(result.current.items).toEqual([]);
    expect(mockOnUpdate).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Cannot be empty');
  });

  it('add() handles onUpdate returning false', async () => {
    mockOnUpdate.mockResolvedValue(false);

    const { result } = renderHook(() =>
      useArrayManager({
        initialValues: ['a'],
        onUpdate: mockOnUpdate,
      }),
    );

    await act(async () => {
      const success = await result.current.add('b');
      expect(success).toBe(false);
    });

    expect(result.current.items).toEqual(['a']);
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to add item');
  });

  it('remove() removes an item and calls onUpdate', async () => {
    const { result } = renderHook(() =>
      useArrayManager({
        initialValues: ['a', 'b', 'c'],
        onUpdate: mockOnUpdate,
      }),
    );

    await act(async () => {
      const success = await result.current.remove('b');
      expect(success).toBe(true);
    });

    expect(result.current.items).toEqual(['a', 'c']);
    expect(mockOnUpdate).toHaveBeenCalledWith(['a', 'c']);
  });

  it('update() replaces an item and calls onUpdate', async () => {
    const { result } = renderHook(() =>
      useArrayManager({
        initialValues: ['a', 'b', 'c'],
        onUpdate: mockOnUpdate,
      }),
    );

    await act(async () => {
      const success = await result.current.update('b', 'z');
      expect(success).toBe(true);
    });

    expect(result.current.items).toEqual(['a', 'z', 'c']);
    expect(mockOnUpdate).toHaveBeenCalledWith(['a', 'z', 'c']);
  });

  it('update() rejects duplicate items excluding original', async () => {
    const { result } = renderHook(() =>
      useArrayManager({
        initialValues: ['a', 'b', 'c'],
        onUpdate: mockOnUpdate,
      }),
    );

    await act(async () => {
      const success = await result.current.update('b', 'c');
      expect(success).toBe(false);
    });

    expect(result.current.items).toEqual(['a', 'b', 'c']);
    expect(mockOnUpdate).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'This item already exists');
  });

  it('clear() empties the array', async () => {
    const { result } = renderHook(() =>
      useArrayManager({
        initialValues: ['a', 'b', 'c'],
        onUpdate: mockOnUpdate,
      }),
    );

    await act(async () => {
      const success = await result.current.clear();
      expect(success).toBe(true);
    });

    expect(result.current.items).toEqual([]);
    expect(mockOnUpdate).toHaveBeenCalledWith([]);
  });

  it('has() returns true for existing items and false otherwise', () => {
    const { result } = renderHook(() =>
      useArrayManager({
        initialValues: ['a', 'b'],
        onUpdate: mockOnUpdate,
      }),
    );

    expect(result.current.has('a')).toBe(true);
    expect(result.current.has('b')).toBe(true);
    expect(result.current.has('c')).toBe(false);
  });

  it('indexOf() returns correct index', () => {
    const { result } = renderHook(() =>
      useArrayManager({
        initialValues: ['a', 'b', 'c'],
        onUpdate: mockOnUpdate,
      }),
    );

    expect(result.current.indexOf('a')).toBe(0);
    expect(result.current.indexOf('b')).toBe(1);
    expect(result.current.indexOf('c')).toBe(2);
    expect(result.current.indexOf('z')).toBe(-1);
  });

  it('loading is true during async operations', async () => {
    let resolveUpdate!: (value: boolean) => void;
    const slowOnUpdate = jest.fn(
      () => new Promise<boolean>((resolve) => { resolveUpdate = resolve; }),
    );

    const { result } = renderHook(() =>
      useArrayManager<string>({
        initialValues: [],
        onUpdate: slowOnUpdate,
      }),
    );

    expect(result.current.loading).toBe(false);

    let addPromise: Promise<boolean>;
    act(() => {
      addPromise = result.current.add('x');
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveUpdate(true);
      await addPromise!;
    });

    expect(result.current.loading).toBe(false);
  });

  it('error state is set and clearError() clears it', async () => {
    mockOnUpdate.mockRejectedValue(new Error('Network failure'));

    const { result } = renderHook(() =>
      useArrayManager<string>({
        initialValues: [],
        onUpdate: mockOnUpdate,
        showAlerts: false,
      }),
    );

    await act(async () => {
      await result.current.add('x');
    });

    expect(result.current.error).toBe('Network failure');

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('custom equals function works for object comparison', async () => {
    type IdItem = { id: number; name: string };

    const objectOnUpdate = jest.fn<Promise<boolean>, [IdItem[]]>().mockResolvedValue(true);

    const { result } = renderHook(() =>
      useArrayManager<IdItem>({
        initialValues: [{ id: 1, name: 'first' }],
        onUpdate: objectOnUpdate,
        equals: (a, b) => a.id === b.id,
      }),
    );

    expect(result.current.has({ id: 1, name: 'different' })).toBe(true);
    expect(result.current.has({ id: 2, name: 'first' })).toBe(false);

    await act(async () => {
      const success = await result.current.add({ id: 1, name: 'duplicate' });
      expect(success).toBe(false);
    });

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'This item already exists');
  });
});
