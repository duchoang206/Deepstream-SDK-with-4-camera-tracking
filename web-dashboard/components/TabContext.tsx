'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type TabType = 'monitor' | 'building' | 'analytics';

interface TabContextType {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

const TabContext = createContext<TabContextType>({
  activeTab: 'monitor',
  setActiveTab: () => {}
});

export function TabProvider({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState<TabType>('monitor');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as TabType;
      const hash = window.location.hash.replace('#', '') as TabType;
      const initial = tabParam || hash;
      if (['monitor', 'building', 'analytics'].includes(initial)) {
        setActiveTab(initial);
      }

      const handlePopState = () => {
        const p = new URLSearchParams(window.location.search);
        const t = p.get('tab') as TabType;
        if (['monitor', 'building', 'analytics'].includes(t)) {
          setActiveTab(t);
        }
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, []);

  const handleSetTab = (tab: TabType) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const newUrl = `/?tab=${tab}`;
      window.history.pushState(null, '', newUrl);
    }
  };

  return (
    <TabContext.Provider value={{ activeTab, setActiveTab: handleSetTab }}>
      {children}
    </TabContext.Provider>
  );
}

export const useTab = () => useContext(TabContext);
