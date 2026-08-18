'use client';

import { useTab } from '../components/TabContext';
import MonitorView from '../components/views/MonitorView';
import BuildingView from '../components/views/BuildingView';
import AnalyticsView from '../components/views/AnalyticsView';

export default function DashboardRoot() {
  const { activeTab } = useTab();

  return (
    <>
      <div style={{ display: activeTab === 'monitor' ? 'block' : 'none', width: '100%', minHeight: 'calc(100vh - 84px)' }}>
        <MonitorView />
      </div>
      <div style={{ display: activeTab === 'building' ? 'block' : 'none', width: '100%', minHeight: 'calc(100vh - 84px)' }}>
        <BuildingView />
      </div>
      <div style={{ display: activeTab === 'analytics' ? 'block' : 'none', width: '100%', minHeight: 'calc(100vh - 84px)' }}>
        <AnalyticsView />
      </div>
    </>
  );
}
