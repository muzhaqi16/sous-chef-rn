import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { ActionTray } from '#components/templates/ActionTray';
import type { ActionTrayRef } from '#components/templates/ActionTray/types';
import { SelectorContent } from './SelectorContent';
import type {
  AnimatedItemSelectorProps,
  ItemSelectorRef,
} from './types';

export const AnimatedItemSelector = forwardRef<
  ItemSelectorRef,
  AnimatedItemSelectorProps<any>
>(({ config, onClose, onOpen, maxHeight, enableGestures = true }, ref) => {
  const trayRef = useRef<ActionTrayRef>(null);

  useImperativeHandle(
    ref,
    () => ({
      open: () => trayRef.current?.open(),
      close: () => trayRef.current?.close(),
      isActive: () => trayRef.current?.isActive() ?? false,
      toggle: () => trayRef.current?.toggle(),
    }),
    []
  );

  return (
    <ActionTray
      ref={trayRef}
      title={config.title}
      onClose={onClose}
      onOpen={onOpen}
      maxHeight={maxHeight}
      enableGestures={enableGestures}
      showCloseButton={true}
      enableBackdrop={true}
    >
      <SelectorContent config={config} />
    </ActionTray>
  );
});

AnimatedItemSelector.displayName = 'AnimatedItemSelector';

// Export types and components
export type {
  SelectorConfig,
  ActionButtonConfig,
  ItemSelectorRef,
  AnimatedItemSelectorProps,
} from './types';

export { ActionButtons } from './ActionButtons';
export { SelectorContent } from './SelectorContent';
export { SelectorItem } from './SelectorItem';