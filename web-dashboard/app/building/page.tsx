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
  const [activeTab, setActiveTab] = useState('camera');
  const [newCamName, setNewCamName] = useState('');
  const [newCamUrl, setNewCamUrl] = useState('');
  
  // ROI Drawing States
  const [roiCamId, setRoiCamId] = useState('');
  const [snapshotTimestamp, setSnapshotTimestamp] = useState(0);
  const [roisByCam, setRoisByCam] = useState<Record<string, {id: string, target_objects: string[], points: number[][] }[]>>({});
  const [currentPoints, setCurrentPoints] = useState<number[][]>([]);
  const [drawing, setDrawing] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const availableLabels = ['car', 'motorcycle', 'bus', 'truck', 'person', 'pallet', 'trolley'];

  const { t } = useLanguage();

  const fetchCameras = () => {
    fetch('/api/backend/camera/list')
      .then(res => res.json())
      .then(data => {
        setCameras(data.cameras || []);
        setRoisByCam(prev => {
          const updated = { ...prev };
          (data.cameras || []).forEach((c: any) => {
            if (!updated[c.id]) updated[c.id] = c.rois || [];
          });
          return updated;
        });
      })
      .catch(err => console.error("Error fetching cameras:", err));
  };

  useEffect(() => {
    fetchCameras();
    const interval = setInterval(fetchCameras, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== 'roi' || !roiCamId) return;
      
      if (e.key.toLowerCase() === 'r') {
        // Hoàn tác điểm vừa vẽ
        setCurrentPoints(prev => prev.slice(0, -1));
      } else if (e.key.toLowerCase() === 's') {
        // Lưu ROI (hoàn thành đa giác hoặc lưu trong modal)
        if (drawing && currentPoints.length >= 3) {
          handleFinishDrawing();
        } else if (showLabelModal) {
          handleSaveROI();
        }
      } else if (e.key.toLowerCase() === 'q') {
        // Lưu tọa độ gửi về backend
        if (roiCamId && roisByCam[roiCamId]?.length > 0 && !showLabelModal) {
          handleApplyToBackend(roiCamId);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, roiCamId, drawing, currentPoints, showLabelModal, roisByCam, selectedLabels]);

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

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>, camId: string) => {
    if (!drawing || roiCamId !== camId) return;
    
    // Sử dụng offsetX / offsetY để lấy tọa độ chuột chính xác trên thẻ img
    const x = e.nativeEvent.offsetX / e.currentTarget.offsetWidth;
    const y = e.nativeEvent.offsetY / e.currentTarget.offsetHeight;
    
    setCurrentPoints([...currentPoints, [x, y]]);
  };

  const handleFinishDrawing = () => {
    if (currentPoints.length >= 3) {
      // Don't set drawing false yet, let modal handle it or cancel
      setShowLabelModal(true);
    } else {
      alert("Please draw at least 3 points for a polygon.");
      setCurrentPoints([]);
    }
  };

  const handleLabelToggle = (label: string) => {
    if (selectedLabels.includes(label)) {
      setSelectedLabels(selectedLabels.filter(l => l !== label));
    } else {
      setSelectedLabels([...selectedLabels, label]);
    }
  };

  const handleSaveROI = async () => {
    if (!roiCamId) return;
    const currentRois = roisByCam[roiCamId] || [];
    const newRoi = {
      id: `roi_${currentRois.length + 1}`,
      target_objects: selectedLabels,
      points: currentPoints
    };
    const updatedRois = [...currentRois, newRoi];
    setRoisByCam({ ...roisByCam, [roiCamId]: updatedRois });
    
    // Reset drawing state
    setDrawing(false);
    setCurrentPoints([]);
    setSelectedLabels([]);
    setShowLabelModal(false);

    // Auto apply to backend
    try {
      const res = await fetch(`/api/backend/camera/${roiCamId}/roi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rois: updatedRois })
      });
      if (res.ok) {
        alert("Đã lưu tọa độ và gửi nhãn về cho Model xử lý thành công!");
      }
    } catch (err) {
      console.error("Failed to apply ROIs", err);
    }
  };

  return (
    <>
      <div className="sub-header">
        <div className="sub-tabs">
          <button className={`sub-tab ${activeTab === 'camera' ? 'active' : ''}`} onClick={() => setActiveTab('camera')}>
            {t.building.cameraSetting}
          </button>
          <button className={`sub-tab ${activeTab === 'roi' ? 'active' : ''}`} onClick={() => setActiveTab('roi')}>
            {t.building.roiSetting}
          </button>
        </div>
      </div>

      <div className="building-container">
        {activeTab === 'camera' ? (
        <>
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
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {cameras.length === 0 && (
            <div className="card-fms" style={{ padding: '48px', textAlign: 'center', color: '#64748b', fontSize: '18px' }}>
              {t.building.noCameras}
            </div>
          )}
          
          {cameras.map(cam => {
            const isDrawingThis = roiCamId === cam.id && drawing;
            const camRois = roisByCam[cam.id] || [];
            const isExpanded = roiCamId === cam.id;
            
            return (
              <div key={cam.id} className="card-fms" style={{ padding: '24px' }}>
                <div 
                  style={{ display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                  onClick={() => {
                    if (!isExpanded) {
                      setRoiCamId(cam.id);
                      setDrawing(false);
                      setCurrentPoints([]);
                      setSnapshotTimestamp(Date.now());
                    }
                  }}
                >
                  <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#334155', margin: 0 }}>
                    {cam.name} {isExpanded ? '▼' : '▶'}
                  </h3>
                  
                  {isExpanded && (
                    <div style={{ display: 'flex', gap: '12px' }} onClick={e => e.stopPropagation()}>
                      <button 
                        className="btn-fms-secondary" 
                        onClick={() => setSnapshotTimestamp(Date.now())}
                        style={{ padding: '8px 16px', fontSize: '14px' }}
                      >
                        Refresh Image
                      </button>
                      {isDrawingThis ? (
                        <button 
                          className="btn-fms-primary"
                          onClick={handleFinishDrawing}
                          style={{ padding: '8px 16px', background: '#10b981', fontSize: '14px' }}
                        >
                          Hoàn Thành (S)
                        </button>
                      ) : (
                        <button 
                          className="btn-fms-primary"
                          onClick={() => { setDrawing(true); setCurrentPoints([]); }}
                          style={{ padding: '8px 16px', background: '#3b82f6', fontSize: '14px' }}
                        >
                          + Vẽ ROI Mới
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {isExpanded && (
                  <div style={{ position: 'relative', width: '100%', maxWidth: '1000px', margin: '24px auto 0' }}>
                    {isDrawingThis && (
                      <div style={{ marginBottom: '12px', color: '#64748b', fontSize: '15px', display: 'flex', gap: '20px', justifyContent: 'center' }}>
                        <span><kbd style={{ padding: '4px 8px', background: '#e2e8f0', borderRadius: '4px', color: '#334155', fontWeight: 'bold' }}>R</kbd> Hoàn tác</span>
                        <span><kbd style={{ padding: '4px 8px', background: '#e2e8f0', borderRadius: '4px', color: '#334155', fontWeight: 'bold' }}>S</kbd> Hoàn thành hình</span>
                      </div>
                    )}
                    {/* Bỏ fixed height để ảnh tự giữ đúng tỷ lệ thực (aspect ratio), đảm bảo tọa độ không bị sai lệch */}
                    <div style={{ position: 'relative', width: '100%', border: isDrawingThis ? '2px solid #3b82f6' : '2px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                      <img 
                        src={`/api/backend/camera/${cam.id}/snapshot?t=${snapshotTimestamp}`} 
                        style={{ width: '100%', display: 'block' }} 
                        draggable={false}
                        alt="Camera Snapshot"
                      />
                      <svg 
                        viewBox="0 0 1 1"
                        preserveAspectRatio="none"
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: isDrawingThis ? 'crosshair' : 'default' }} 
                        onClick={(e) => {
                          if (!drawing || roiCamId !== cam.id) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = (e.clientX - rect.left) / rect.width;
                          const y = (e.clientY - rect.top) / rect.height;
                          setCurrentPoints([...currentPoints, [x, y]]);
                        }}
                      >
                        {camRois.map((roi, idx) => (
                          <g key={idx}>
                            <polygon points={roi.points.map(p => `${p[0]},${p[1]}`).join(' ')} fill="rgba(59, 130, 246, 0.3)" stroke="#3b82f6" strokeWidth="0.003" />
                            <text x={roi.points[0][0]} y={roi.points[0][1]} fill="#fff" fontSize="0.03" fontWeight="bold" stroke="#000" strokeWidth="0.001">{roi.id} ({roi.target_objects.join(',')})</text>
                          </g>
                        ))}
                        {isDrawingThis && currentPoints.length > 0 && (
                          <polyline points={currentPoints.map(p => `${p[0]},${p[1]}`).join(' ')} fill="none" stroke="#ef4444" strokeWidth="0.003" />
                        )}
                        {isDrawingThis && currentPoints.length > 0 && (
                          <circle cx={currentPoints[currentPoints.length - 1][0]} cy={currentPoints[currentPoints.length - 1][1]} r="0.005" fill="#ef4444" />
                        )}
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Label Selection Modal */}
          {showLabelModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
              <div style={{ background: 'white', padding: '32px', borderRadius: '12px', width: '400px' }}>
                <h3 style={{ fontSize: '20px', marginBottom: '16px', color: '#1e293b', fontWeight: 'bold' }}>Select Target Objects</h3>
                <p style={{ color: '#64748b', marginBottom: '24px' }}>Click to select objects to detect in this ROI.</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '32px' }}>
                  {availableLabels.map(label => (
                    <button
                      key={label}
                      onClick={() => handleLabelToggle(label)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: selectedLabels.includes(label) ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                        background: selectedLabels.includes(label) ? '#eff6ff' : 'white',
                        color: selectedLabels.includes(label) ? '#1d4ed8' : '#475569',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button className="btn-fms-secondary" onClick={() => { setShowLabelModal(false); setDrawing(false); setCurrentPoints([]); setRoiCamId(''); }}>Cancel</button>
                  <button className="btn-fms-primary" onClick={handleSaveROI}>Save ROI (S)</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
    </>
  );
}
