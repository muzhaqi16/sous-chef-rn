import { renderHook, act } from '@testing-library/react-native';
import { useModalManager } from '../useModalManager';

describe('useModalManager', () => {
  it('starts with no active modal', () => {
    const { result } = renderHook(() => useModalManager());
    expect(result.current.activeModal).toBeNull();
  });

  it('opens a modal', () => {
    const { result } = renderHook(() => useModalManager());

    act(() => {
      result.current.openModal('addCuisine');
    });

    expect(result.current.activeModal).toBe('addCuisine');
  });

  it('closes the active modal', () => {
    const { result } = renderHook(() => useModalManager());

    act(() => {
      result.current.openModal('addCuisine');
    });
    act(() => {
      result.current.closeModal();
    });

    expect(result.current.activeModal).toBeNull();
  });

  it('isOpen returns true for active modal', () => {
    const { result } = renderHook(() => useModalManager());

    act(() => {
      result.current.openModal('editNutrition');
    });

    expect(result.current.isOpen('editNutrition')).toBe(true);
    expect(result.current.isOpen('addCuisine')).toBe(false);
  });

  it('toggleModal opens when closed', () => {
    const { result } = renderHook(() => useModalManager());

    act(() => {
      result.current.toggleModal('myModal');
    });

    expect(result.current.activeModal).toBe('myModal');
  });

  it('toggleModal closes when already open', () => {
    const { result } = renderHook(() => useModalManager());

    act(() => {
      result.current.openModal('myModal');
    });
    act(() => {
      result.current.toggleModal('myModal');
    });

    expect(result.current.activeModal).toBeNull();
  });

  it('opening a new modal replaces the current one', () => {
    const { result } = renderHook(() => useModalManager());

    act(() => {
      result.current.openModal('first');
    });
    act(() => {
      result.current.openModal('second');
    });

    expect(result.current.activeModal).toBe('second');
    expect(result.current.isOpen('first')).toBe(false);
    expect(result.current.isOpen('second')).toBe(true);
  });
});
