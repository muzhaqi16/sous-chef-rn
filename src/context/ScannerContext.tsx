import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

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
    // Only update if values have changed to prevent unnecessary re-renders
    setOnScanPress(prev => {
      // Compare function references - only update if different
      if (prev === scanPress) return prev;
      return scanPress || undefined;
    });
    setShowScannerButton(prev => {
      // Only update if showButton value has changed
      if (prev === showButton) return prev;
      return showButton;
    });
  }, []);

  const setOverlayOpen = useCallback((isOpen: boolean) => {
    setIsOverlayOpen(isOpen);
  }, []);

  const handleSetActiveTab = useCallback((tabName: string) => {
    setActiveTab(tabName);
  }, []);

  // Only show scanner button if the current tab is in the allowed list and scanner is enabled
  const shouldShowScanner = showScannerButton && allowedTabs.includes(activeTab);

  // Memoize context value to prevent unnecessary re-renders of consumers
  const contextValue = useMemo(() => ({
    onScanPress,
    showScannerButton: shouldShowScanner,
    setScannerProps,
    setActiveTab: handleSetActiveTab,
    isOverlayOpen,
    setOverlayOpen,
  }), [onScanPress, shouldShowScanner, setScannerProps, handleSetActiveTab, isOverlayOpen, setOverlayOpen]);

  return (
    <ScannerContext.Provider value={contextValue}>
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