'use client';

import React, { useEffect, useState } from 'react';

type AnalyticsData = {
  agv: number;
  person: number;
  rack: number;
};

export default function BuildingPage() {
  const [data, setData] = useState<AnalyticsData>({ agv: 0, person: 0, rack: 0 });

  useEffect(() => {
    // Fetch analytics data every 2 seconds
    const interval = setInterval(() => {
      fetch('/api/analytics')
        .then(res => res.json())
        .then((result) => setData(result))
        .catch(err => console.error(err));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <div className="page-header">
        <h1>Building Management</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '32px' }}>
        <div className="card-gradient card-purple">
          <h3>Total AGVs Detected</h3>
          <div className="value">{data.agv}</div>
          <div className="subtext">Real-time inference</div>
        </div>
        <div className="card-gradient card-green">
          <h3>Total Persons Detected</h3>
          <div className="value">{data.person}</div>
          <div className="subtext">Real-time inference</div>
        </div>
        <div className="card-gradient card-slate">
          <h3>Total Racks Detected</h3>
          <div className="value">{data.rack}</div>
          <div className="subtext">Real-time inference</div>
        </div>
        <div className="card-gradient card-yellow">
          <h3>System Efficiency</h3>
          <div className="value">98%</div>
          <div className="subtext">Overall Performance</div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Camera Infrastructure</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Camera Name</th>
              <th>IP Address / URI</th>
              <th>Status</th>
              <th>Battery / Power</th>
              <th>Resolution</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Cam 1 (Main Hall)</td>
              <td>192.168.5.240:554</td>
              <td><span className="status-pill status-online">Online</span></td>
              <td>100% (AC Power)</td>
              <td>1080p</td>
            </tr>
            <tr>
              <td>Cam 2 (Storage A)</td>
              <td>192.168.5.242:554</td>
              <td><span className="status-pill status-online">Online</span></td>
              <td>100% (AC Power)</td>
              <td>1080p</td>
            </tr>
            <tr>
              <td>Cam 3 (Storage B)</td>
              <td>192.168.5.241:554</td>
              <td><span className="status-pill status-online">Online</span></td>
              <td>95% (Battery)</td>
              <td>1080p</td>
            </tr>
            <tr>
              <td>Cam 4 (Docking)</td>
              <td>192.168.5.201:554</td>
              <td><span className="status-pill status-offline">Offline</span></td>
              <td>0%</td>
              <td>1080p</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
