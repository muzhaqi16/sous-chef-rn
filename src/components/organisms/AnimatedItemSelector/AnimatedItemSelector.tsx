import { useImperativeHandle, useRef } from 'react';
import { ActionTray } from '#components/templates/ActionTray/ActionTray';
import type { ActionTrayRef } from '#components/templates/ActionTray/types';
import { SelectorContent } from './SelectorContent';
import { ActionButtons } from './ActionButtons';
import type { AnimatedItemSelectorProps, SelectableItem } from './types';

// React 19 ref-as-prop keeps the component generic over the item type `T`
// (a `forwardRef` would erase the generic and force a cast at the call site).
export const AnimatedItemSelector = <T extends SelectableItem>({
  config,
  onClose,
  onOpen,
  ref,
}: AnimatedItemSelectorProps<T>) => {
  const trayRef = useRef<ActionTrayRef>(null);

  useImperativeHandle(
    ref,
    () => ({
      open: () => trayRef.current?.open(),
      close: () => trayRef.current?.close(),
      isActive: () => trayRef.current?.isActive() ?? false,
      toggle: () => trayRef.current?.toggle(),
    }),
    [],
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
      // Only mount the footer when there are actions: ActionButtons renders
      // null for an empty list, but passing it anyway would still make
      // ActionTray draw the bordered footer band and reserve its space.
      footer={
        config.actions.length ? (
          <ActionButtons actions={config.actions} />
        ) : undefined
      }
    >
      <SelectorContent config={config} />
    </ActionTray>
  );
};
