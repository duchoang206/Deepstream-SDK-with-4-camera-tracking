'use client';

import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../components/LanguageContext';

type Camera = {
  id: string;
  name: string;
  rtsp_url: string;
  status?: Record<string, string>; // { "roi_1": "Carfull", "roi_2": "Empty" }
};

const MapToolIcons = {
  Cursor: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>,
  Hand: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 11V6a2 2 0 0 0-4 0v4 M14 11V4a2 2 0 0 0-4 0v7 M10 11V5a2 2 0 0 0-4 0v6 M6 11v4a6 6 0 0 0 6 6h2a6 6 0 0 0 6-6v-5a2 2 0 0 0-2-2h-8"/></svg>,
  ZoomIn: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>,
  Polygon: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l9 7-3.5 10h-11L3 9z"/><circle cx="12" cy="2" r="2"/><circle cx="21" cy="9" r="2"/><circle cx="18.5" cy="19" r="2"/><circle cx="5.5" cy="19" r="2"/><circle cx="3" cy="9" r="2"/></svg>,
  Trash: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
  Settings: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
};

export default function MonitorPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [activeTool, setActiveTool] = useState('cursor');
  const [hostName, setHostName] = useState('localhost');
  const { t } = useLanguage();

  const fetchCameras = () => {
    fetch('/api/backend/camera/list')
      .then(res => res.json())
      .then(data => setCameras(data.cameras || []))
      .catch(err => console.error("Error fetching cameras:", err));
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHostName(window.location.hostname);
    }
    fetchCameras();
    const interval = setInterval(fetchCameras, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Sub Header for Tools */}
      <div className="sub-header">
        <div className="sub-tabs">
          <button className={`sub-tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>{t.monitor.allCamera}</button>
          {cameras.map(cam => (
            <button key={cam.id} className={`sub-tab ${activeTab === cam.id ? 'active' : ''}`} onClick={() => setActiveTab(cam.id)}>
              {cam.name}
            </button>
          ))}
        </div>
        
        <div className="map-tools">
          <button className={`tool-btn ${activeTool === 'cursor' ? 'active' : ''}`} onClick={() => setActiveTool('cursor')}><MapToolIcons.Cursor /></button>
          <button className={`tool-btn ${activeTool === 'hand' ? 'active' : ''}`} onClick={() => setActiveTool('hand')}><MapToolIcons.Hand /></button>
          <button className={`tool-btn ${activeTool === 'zoom' ? 'active' : ''}`} onClick={() => setActiveTool('zoom')}><MapToolIcons.ZoomIn /></button>
          <button className={`tool-btn ${activeTool === 'polygon' ? 'active' : ''}`} onClick={() => setActiveTool('polygon')}><MapToolIcons.Polygon /></button>
          <button className={`tool-btn ${activeTool === 'trash' ? 'active' : ''}`} onClick={() => setActiveTool('trash')}><MapToolIcons.Trash /></button>
          <button className={`tool-btn ${activeTool === 'settings' ? 'active' : ''}`} onClick={() => setActiveTool('settings')}><MapToolIcons.Settings /></button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="canvas-container">
        
        {cameras.length === 0 ? (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#94a3b8', fontSize: '20px' }}>
            {t.monitor.noCamera}
          </div>
        ) : (
          <>
            {activeTab === 'all' ? (
              <div style={{ display: 'flex', gap: '24px', height: '100%', padding: '24px' }}>
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '12px' }}>
                  <div className="video-grid-fms">
                    {cameras.map(cam => {
                      const isIntrusion = cam.status && Object.values(cam.status).includes("Carfull");
                      return (
                        <div key={cam.id} className={`video-card-fms ${isIntrusion ? 'intrusion' : ''}`}>
                          <div className="video-fms-header">
                            <span>{cam.name}</span>
                            {isIntrusion && <span style={{ color: '#ef4444' }}>INTRUSION!</span>}
                          </div>
                          
                          <div className="video-frame">
                            <iframe 
                              src={`http://${hostName}:8081/${cam.id}/`} 
                              style={{ width: '100%', height: '100%', border: 'none' }}
                              title={cam.name}
                              scrolling="no"
                            />
                          </div>

                          {cam.status && Object.keys(cam.status).length > 0 && (
                            <div style={{ padding: '8px 12px', borderTop: '1px solid #e2e8f0', background: 'white', display: 'flex', gap: '8px' }}>
                              {Object.entries(cam.status).map(([roi, stat]) => (
                                <span key={roi} style={{ 
                                  padding: '4px 8px', borderRadius: '4px', fontSize: '14px', fontWeight: '600',
                                  background: stat === 'Carfull' ? '#fee2e2' : '#dcfce3', 
                                  color: stat === 'Carfull' ? '#ef4444' : '#16a34a' 
                                }}>
                                  {roi}: {stat as string}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Right Sidebar */}
                <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ color: '#334155', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', marginBottom: '16px', fontWeight: 600 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                      RECENT DETECTIONS
                    </h3>
                    <div style={{ color: '#64748b', fontSize: '14px', fontStyle: 'italic' }}>Waiting for AI inference...</div>
                  </div>

                  <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ color: '#334155', fontSize: '16px', marginBottom: '12px', fontWeight: 600 }}>SYSTEM STABILITY</h3>
                    <div style={{ fontSize: '32px', fontWeight: 700, color: '#3b82f6', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      66.8<span style={{ fontSize: '18px', color: '#64748b' }}>%</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '24px', height: '100%', padding: '24px', overflowY: 'auto' }}>
                {cameras.filter(c => c.id === activeTab).map(cam => {
                  const isIntrusion = cam.status && Object.values(cam.status).includes("Carfull");
                  return (
                    <React.Fragment key={cam.id}>
                      {/* Left: Centered Video Card */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div className={`video-card-fms ${isIntrusion ? 'intrusion' : ''}`} style={{ width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
                          <div className="video-fms-header">
                            <span>{cam.name}</span>
                            {isIntrusion && <span style={{ color: '#ef4444' }}>INTRUSION!</span>}
                          </div>
                          
                          <div className="video-frame">
                            <iframe 
                              src={`http://${hostName}:8081/${cam.id}/`} 
                              style={{ width: '100%', height: '100%', border: 'none' }}
                              title={cam.name}
                              scrolling="no"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Right: Status Sidebar */}
                      <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                          <h3 style={{ color: '#334155', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', marginBottom: '16px', fontWeight: 600 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                            ROI STATUS
                          </h3>
                          
                          {cam.status && Object.keys(cam.status).length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              {Object.entries(cam.status).map(([roi, stat]) => (
                                <div key={roi} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                  <span style={{ fontWeight: 600, color: '#334155' }}>{roi}</span>
                                  <span style={{ 
                                    padding: '4px 8px', borderRadius: '4px', fontSize: '13px', fontWeight: 'bold',
                                    background: stat === 'Carfull' ? '#fee2e2' : '#dcfce3', 
                                    color: stat === 'Carfull' ? '#ef4444' : '#16a34a' 
                                  }}>
                                    {stat as string}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ color: '#64748b', fontSize: '14px', fontStyle: 'italic' }}>Waiting for ROI data...</div>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Bottom Right Watermark */}
        <div className="rtc-watermark" style={{ position: 'absolute', bottom: '32px', right: '32px', opacity: 0.8 }}>
          <img src="/logo.png" alt="RTC Logo" style={{ height: '84px', objectFit: 'contain' }} />
        </div>
        
      </div>
    </>
  );
}
