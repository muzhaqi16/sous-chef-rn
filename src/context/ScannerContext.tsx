import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ScannerContextType {
  onScanPress?: () => void;
  showScannerButton: boolean;
  setScannerProps: (onScanPress?: () => void, showButton?: boolean) => void;
  setActiveTab: (tabName: string) => void;
  isOverlayOpen: boolean;
  setOverlayOpen: (isOpen: boolean) => void;
}

const ScannerContext = createContext<ScannerContextType | undefined>(undefined);

interface ScannerProviderProps {
  children: ReactNode;
}

export const ScannerProvider: React.FC<ScannerProviderProps> = ({ children }) => {
  const [onScanPress, setOnScanPress] = useState<(() => void) | undefined>(undefined);
  const [showScannerButton, setShowScannerButton] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('');
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);

  // Define which tabs should show the scanner button
  const allowedTabs = ['Pantry', 'ShoppingList'];

  const setScannerProps = useCallback((scanPress?: () => void, showButton: boolean = false) => {
    setOnScanPress(() => scanPress);
    setShowScannerButton(showButton);
  }, []);

  const setOverlayOpen = useCallback((isOpen: boolean) => {
    setIsOverlayOpen(isOpen);
  }, []);

  const handleSetActiveTab = useCallback((tabName: string) => {
    setActiveTab(tabName);
  }, []);

  // Only show scanner button if the current tab is in the allowed list and scanner is enabled
  const shouldShowScanner = showScannerButton && allowedTabs.includes(activeTab);

  return (
    <ScannerContext.Provider value={{
      onScanPress,
      showScannerButton: shouldShowScanner,
      setScannerProps,
      setActiveTab: handleSetActiveTab,
      isOverlayOpen,
      setOverlayOpen,
    }}>
      {children}
    </ScannerContext.Provider>
  );
};

export const useScanner = (): ScannerContextType => {
  const context = useContext(ScannerContext);
  if (context === undefined) {
    throw new Error('useScanner must be used within a ScannerProvider');
  }
  return context;
};