'use client';

import { useLanguage } from './LanguageContext';
import { useTab } from './TabContext';

export default function Navigation() {
  const { t } = useLanguage();
  const { activeTab, setActiveTab } = useTab();

  return (
    <nav className="fms-nav">
      <button 
        type="button"
        onClick={() => setActiveTab('monitor')} 
        className={`fms-nav-item ${activeTab === 'monitor' ? 'active' : ''}`}
      >
        {t.nav.monitor}
      </button>
      <button 
        type="button"
        onClick={() => setActiveTab('building')} 
        className={`fms-nav-item ${activeTab === 'building' ? 'active' : ''}`}
      >
        {t.nav.building}
      </button>
      <button 
        type="button"
        onClick={() => setActiveTab('analytics')} 
        className={`fms-nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
      >
        {t.nav.analytics}
      </button>
    </nav>
  );
}
