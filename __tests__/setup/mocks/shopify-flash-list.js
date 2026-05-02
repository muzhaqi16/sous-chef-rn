'use no memo';
jest.mock('@shopify/flash-list', () => {
  const { FlatList } = require('react-native');
  const React = require('react');
  return {
    FlashList: FlatList,
    MasonryFlashList: FlatList,
    useRecyclingState: (initialState, deps, onReset) => {
      // Manual deps comparison — avoids dynamic deps array in hooks
      const valueRef = React.useRef();
      const prevDepsRef = React.useRef(null);

      const isFirstRender = prevDepsRef.current === null;
      const depsChanged =
        isFirstRender || deps.some((d, i) => d !== prevDepsRef.current[i]);

      if (depsChanged) {
        prevDepsRef.current = deps;
        valueRef.current =
          typeof initialState === 'function' ? initialState() : initialState;
        if (!isFirstRender) onReset?.();
      }

      const [, setCounter] = React.useState(0);
      const setState = React.useCallback(newValue => {
        const next =
          typeof newValue === 'function'
            ? newValue(valueRef.current)
            : newValue;
        if (next !== valueRef.current) {
          valueRef.current = next;
          setCounter(c => c + 1);
        }
      }, []);
      return [valueRef.current, setState];
    },
    useMappingHelper: () => ({
      getMappingKey: (itemKey, index) => `${itemKey}_${index}`,
    }),
  };
});
