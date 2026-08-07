'use client';

import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../components/LanguageContext';

type Camera = {
  id: string;
  name: string;
  rtsp_url: string;
};

export default function BuildingPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [newCamName, setNewCamName] = useState('');
  const [newCamUrl, setNewCamUrl] = useState('');
  const { t } = useLanguage();

  const fetchCameras = () => {
    fetch('/api/backend/camera/list')
      .then(res => res.json())
      .then(data => setCameras(data.cameras || []))
      .catch(err => console.error("Error fetching cameras:", err));
  };

  useEffect(() => {
    fetchCameras();
    const interval = setInterval(fetchCameras, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAddCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCamName || !newCamUrl) return;

    try {
      const res = await fetch('/api/backend/camera/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCamName, rtsp_url: newCamUrl })
      });
      if (res.ok) {
        setNewCamName('');
        setNewCamUrl('');
        fetchCameras();
      }
    } catch (err) {
      console.error("Failed to add camera", err);
    }
  };

  const handleDeleteCamera = async (id: string) => {
    try {
      const res = await fetch(`/api/backend/camera/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) fetchCameras();
    } catch (err) {
      console.error("Failed to delete camera", err);
    }
  };

  return (
    <div className="building-container">
      
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <h1 style={{ fontSize: '32px', color: '#1e293b' }}>{t.building.title}</h1>
        <span style={{ background: '#e2e8f0', color: '#64748b', padding: '4px 12px', borderRadius: '16px', fontSize: '16px', fontWeight: '600' }}>{t.building.config}</span>
      </div>

      <div className="card-fms">
        <h2 style={{ fontSize: '22px', marginBottom: '24px', color: '#334155' }}>{t.building.registerTitle}</h2>
        <form onSubmit={handleAddCamera} style={{ display: 'flex', gap: '24px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '16px', color: '#64748b', fontWeight: '500' }}>{t.building.camNameLabel}</label>
            <input 
              type="text" 
              value={newCamName}
              onChange={(e) => setNewCamName(e.target.value)}
              placeholder={t.building.camNamePlaceholder}
              className="input-fms"
              style={{ fontSize: '18px', padding: '14px 18px' }}
            />
          </div>
          <div style={{ flex: 2 }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '16px', color: '#64748b', fontWeight: '500' }}>{t.building.rtspUrlLabel}</label>
            <input 
              type="text" 
              value={newCamUrl}
              onChange={(e) => setNewCamUrl(e.target.value)}
              placeholder={t.building.rtspUrlPlaceholder}
              className="input-fms"
              style={{ fontSize: '18px', padding: '14px 18px' }}
            />
          </div>
          <button type="submit" className="btn-fms-primary" style={{ fontSize: '18px', padding: '14px 32px' }}>
            {t.building.addStreamBtn}
          </button>
        </form>
      </div>

      <div className="card-fms" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '24px 32px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <h2 style={{ fontSize: '20px', color: '#334155', margin: 0 }}>{t.building.activeCameras}</h2>
        </div>
        <table className="table-fms">
          <thead>
            <tr>
              <th>{t.building.colId}</th>
              <th>{t.building.colName}</th>
              <th>{t.building.colUrl}</th>
              <th>{t.building.colStatus}</th>
              <th>{t.building.colAction}</th>
            </tr>
          </thead>
          <tbody>
            {cameras.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '18px' }}>
                  {t.building.noCameras}
                </td>
              </tr>
            ) : cameras.map(cam => (
              <tr key={cam.id}>
                <td style={{ color: '#64748b', fontSize: '16px' }}>#{cam.id.slice(0,8)}</td>
                <td style={{ fontWeight: '600', color: '#334155', fontSize: '18px' }}>{cam.name}</td>
                <td style={{ color: '#64748b', fontSize: '16px', fontFamily: 'monospace' }}>{cam.rtsp_url}</td>
                <td>
                  <span style={{ background: '#dcfce3', color: '#16a34a', padding: '6px 12px', borderRadius: '6px', fontSize: '15px', fontWeight: '600' }}>{t.building.statusLive}</span>
                </td>
                <td>
                  <button 
                    onClick={() => handleDeleteCamera(cam.id)}
                    style={{ padding: '10px 20px', background: 'transparent', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer', fontSize: '15px', fontWeight: '500' }}
                    onMouseOver={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {t.building.btnRemove}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
