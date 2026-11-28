import React from 'react';
import { Sheet } from '#components/templates/Sheet';

/**
 * Content that owns its sheet's bar (`SheetHeaderSlot`), hosted as its form
 * sheet hosts it: the bar, its confirm and the close guard are the real ones.
 */
export const InFormSheet: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <Sheet
    mode="form"
    headerFromContent
    visible
    onDismiss={() => undefined}
    snapPoints={['90%']}
  >
    {children}
  </Sheet>
);
