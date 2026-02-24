import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { ActionTray } from '#components/templates/ActionTray/ActionTray';
import type { ActionTrayRef } from '#components/templates/ActionTray/types';
import { SelectorContent } from './SelectorContent';
import type {
  AnimatedItemSelectorProps,
  ItemSelectorRef,
} from './types';

export const AnimatedItemSelector = forwardRef<
  ItemSelectorRef,
  AnimatedItemSelectorProps<any>
>(({ config, onClose, onOpen }, ref) => {
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
      headerRight={config.headerRight}
      onClose={onClose}
      onOpen={onOpen}
      showCloseButton={true}
      enableBackdrop={true}
    >
      <SelectorContent config={config} />
    </ActionTray>
  );
});

AnimatedItemSelector.displayName = 'AnimatedItemSelector';