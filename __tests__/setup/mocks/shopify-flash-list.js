'use no memo';
jest.mock('@shopify/flash-list', () => {
  const { FlatList } = require('react-native');
  const React = require('react');
  // FlashList types `renderScrollComponent` as a COMPONENT; RN's VirtualizedList
  // (behind FlatList) calls it as a render FUNCTION. Substituting FlatList without
  // adapting it invokes the component bare — and RNGH's ScrollView is a class under
  // the jest preset, so it throws "Cannot call a class as a function". Adapt rather
  // than drop, so lists that pass the prop still render it.
  const asRenderFunction = ScrollComponent =>
    ScrollComponent
      ? scrollProps => React.createElement(ScrollComponent, scrollProps)
      : undefined;

  // The real FlashList fires `onCommitLayoutEffect` from the commit that ends
  // each progressive layout pass — on mount and again after every data change.
  // An effect with no dependency array is the closest FlatList-world stand-in;
  // without it, anything gated on first-content-layout (skeleton overlays)
  // never releases in tests.
  const FlashListMock = ({
    renderScrollComponent,
    onCommitLayoutEffect,
    ...props
  }) => {
    React.useEffect(() => {
      onCommitLayoutEffect?.();
    });
    return React.createElement(FlatList, {
      ...props,
      renderScrollComponent: asRenderFunction(renderScrollComponent),
    });
  };

  return {
    FlashList: FlashListMock,
    MasonryFlashList: FlashListMock,
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
