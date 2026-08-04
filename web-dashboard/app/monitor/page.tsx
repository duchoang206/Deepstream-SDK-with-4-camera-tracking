'use client';

import React, { useEffect } from 'react';

export default function MonitorPage() {
  // Navigation active state styling is handled globally or could be added here
  useEffect(() => {
    // Basic effect if we need WebRTC direct connect later
  }, []);

  return (
    <>
      <div className="page-header">
        <h1>Live View</h1>
        <div className="badge-live">LIVE</div>
      </div>
      
      <div className="video-grid">
        <div className="video-main">
          <div className="video-label">Cam Tổng (Main View)</div>
          <iframe 
            src="http://localhost:8081/cam1" 
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Cam Tổng"
          />
        </div>
        <div className="video-sub-container">
          <div className="video-sub">
            <div className="video-label">Cam 1</div>
            <iframe src="http://localhost:8081/cam1" style={{ width: '100%', height: '100%', border: 'none' }} title="Cam 1" />
          </div>
          <div className="video-sub">
            <div className="video-label">Cam 2</div>
            <iframe src="http://localhost:8081/cam2" style={{ width: '100%', height: '100%', border: 'none' }} title="Cam 2" />
          </div>
          <div className="video-sub">
            <div className="video-label">Cam 3</div>
            <iframe src="http://localhost:8081/cam3" style={{ width: '100%', height: '100%', border: 'none' }} title="Cam 3" />
          </div>
          <div className="video-sub">
            <div className="video-label">Cam 4</div>
            <iframe src="http://localhost:8081/cam4" style={{ width: '100%', height: '100%', border: 'none' }} title="Cam 4" />
          </div>
        </div>
      </div>
    </>
  );
}
