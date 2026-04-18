import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import type { MealTemplateDisplayFragment } from '#generated';

interface TemplateBrowserContextValue {
  onSelectTemplate: (template: MealTemplateDisplayFragment) => void;
}

const TemplateBrowserContext =
  createContext<TemplateBrowserContextValue | null>(null);

export const TemplateBrowserProvider: React.FC<{
  children: ReactNode;
  onSelectTemplate: (template: MealTemplateDisplayFragment) => void;
}> = ({ children, onSelectTemplate }) => {
  const ref = useRef(onSelectTemplate);
  useEffect(() => {
    ref.current = onSelectTemplate;
  });

  const stable: TemplateBrowserContextValue = {
    onSelectTemplate: template => ref.current(template),
  };

  return (
    <TemplateBrowserContext.Provider value={stable}>
      {children}
    </TemplateBrowserContext.Provider>
  );
};

export const useTemplateBrowserActions = (): TemplateBrowserContextValue => {
  const ctx = useContext(TemplateBrowserContext);
  if (!ctx)
    throw new Error(
      'useTemplateBrowserActions must be used within TemplateBrowserProvider',
    );
  return ctx;
};
