'use client';

import React, { useEffect, useState } from 'react';
import { useLanguage } from '../LanguageContext';
import { useCameras } from '../CameraContext';
import { Eye, EyeOff, Layers, ShieldAlert, Compass, Plus, Trash2, CheckCircle2 } from 'lucide-react';

type Rule = {
  id: string;
  type?: string;
  rule_type?: string;
  name: string;
  points: number[][];
  threshold?: number;
  direction?: string;
};

export default function BuildingView() {
  const { cameras, fetchCameras, deleteCamera: handleDeleteCameraCtx, updateCamera: handleUpdateCameraCtx } = useCameras();
  const [activeTab, setActiveTab] = useState<'camera' | 'rules' | 'calibration'>('camera');
  const [newCamName, setNewCamName] = useState('');
  const [newCamUrl, setNewCamUrl] = useState('');
  
  // Edit Camera Modal
  const [editCamModal, setEditCamModal] = useState({ open: false, id: '', name: '', url: '' });

  // Auth Modal
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [cameraBrand, setCameraBrand] = useState('hikvision');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Rules (ROI & Tripwires) States
  const [selectedCamId, setSelectedCamId] = useState('');
  const [rulesByCam, setRulesByCam] = useState<Record<string, Rule[]>>({});
  const [currentRuleType, setCurrentRuleType] = useState<string>('intrusion');
  const [currentRuleName, setCurrentRuleName] = useState('');
  const [currentThreshold, setCurrentThreshold] = useState(15);
  const [currentPoints, setCurrentPoints] = useState<number[][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  // Calibration States
  const [calibCamId, setCalibCamId] = useState('');
  const [calibSrcPoints, setCalibSrcPoints] = useState<number[][]>([]);
  const [calibStatus, setCalibStatus] = useState<string>('');

  const { t } = useLanguage();

  useEffect(() => {
    if (cameras.length > 0) {
      if (!selectedCamId) setSelectedCamId(cameras[0].id);
      if (!calibCamId) setCalibCamId(cameras[0].id);
    }
  }, [cameras, selectedCamId, calibCamId]);

  // Fetch rules for selected camera
  useEffect(() => {
    if (selectedCamId) {
      fetch(`/api/backend/camera/${selectedCamId}/rules`)
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (data?.rules) {
            setRulesByCam(prev => ({ ...prev, [selectedCamId]: data.rules }));
          }
        })
        .catch(() => {});
    }
  }, [selectedCamId]);

  const handleAddCamera = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCamName || !newCamUrl) return;
    setShowAuthModal(true);
  };

  const handleApplyCameraAuth = async () => {
    let cleanIpOrUrl = newCamUrl.trim();
    let fullRtspUrl = "";

    // If user already pasted full rtsp:// URL
    if (cleanIpOrUrl.startsWith("rtsp://") || cleanIpOrUrl.startsWith("http://") || cleanIpOrUrl.startsWith("https://")) {
      fullRtspUrl = cleanIpOrUrl;
    } else {
      const uEnc = authUsername ? encodeURIComponent(authUsername) : "";
      const pEnc = authPassword ? encodeURIComponent(authPassword) : "";
      const authPrefix = (uEnc && pEnc) ? `${uEnc}:${pEnc}@` : (uEnc ? `${uEnc}@` : "");
      
      let hostPort = cleanIpOrUrl.replace(/^https?:\/\//, '').replace(/^rtsp:\/\//, '');
      let pathSuffix = "";
      if (hostPort.includes('/')) {
        const slashIdx = hostPort.indexOf('/');
        pathSuffix = hostPort.slice(slashIdx);
        hostPort = hostPort.slice(0, slashIdx);
      }
      if (!hostPort.includes(':')) {
        hostPort = `${hostPort}:554`;
      }

      if (cameraBrand === 'custom') {
        fullRtspUrl = `rtsp://${authPrefix}${hostPort}${pathSuffix || ''}`;
      } else if (cameraBrand === 'dahua') {
        fullRtspUrl = `rtsp://${authPrefix}${hostPort}/cam/realmonitor?channel=1&subtype=0`;
      } else { // hikvision / other
        fullRtspUrl = `rtsp://${authPrefix}${hostPort}/Streaming/Channels/101`;
      }
    }

    try {
      const res = await fetch('/api/backend/camera/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCamName.trim(), rtsp_url: fullRtspUrl })
      });
      if (res.ok) {
        setNewCamName('');
        setNewCamUrl('');
        setAuthUsername('');
        setAuthPassword('');
        setShowAuthModal(false);
        fetchCameras();
      } else {
        const errData = await res.json().catch(() => null);
        alert(errData?.detail || `Lỗi thêm camera (Mã lỗi HTTP ${res.status}): Không nhận được phản hồi từ Backend (Port 8000). Hãy kiểm tra dịch vụ Backend đang chạy.`);
      }
    } catch (err: any) {
      console.error("Failed to add camera", err);
      alert(`Lỗi kết nối Backend: ${err?.message || err}. Hãy kiểm tra terminal backend trên port 8000.`);
    }
  };

  const handleDeleteCamera = async (id: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa Camera này khỏi hệ thống?")) {
      await handleDeleteCameraCtx(id);
    }
  };

  const handleSaveEditCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCamModal.name || !editCamModal.url) return;
    const ok = await handleUpdateCameraCtx(editCamModal.id, editCamModal.name.trim(), editCamModal.url.trim());
    if (ok) {
      setEditCamModal({ open: false, id: '', name: '', url: '' });
    } else {
      alert("Lỗi cập nhật camera");
    }
  };

  // Rule Save
  const handleSaveCurrentRule = async () => {
    const minPts = currentRuleType === 'tripwire' ? 2 : 3;
    if (currentPoints.length < minPts) {
      alert(`Quy tắc ${currentRuleType} cần ít nhất ${minPts} điểm!`);
      return;
    }

    const currentRules = rulesByCam[selectedCamId] || [];
    const newRule: Rule = {
      id: `rule_${Date.now().toString().slice(-4)}`,
      type: currentRuleType,
      name: currentRuleName || `${currentRuleType.toUpperCase()} #${currentRules.length + 1}`,
      points: currentPoints,
      threshold: currentThreshold
    };

    const updatedRules = [...currentRules, newRule];
    setRulesByCam({ ...rulesByCam, [selectedCamId]: updatedRules });
    setCurrentPoints([]);
    setIsDrawing(false);
    setCurrentRuleName('');

    // Save to backend
    try {
      await fetch(`/api/backend/camera/${selectedCamId}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: updatedRules })
      });
    } catch (err) {
      console.error("Error saving rules:", err);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    const currentRules = rulesByCam[selectedCamId] || [];
    const updated = currentRules.filter(r => r.id !== ruleId);
    setRulesByCam({ ...rulesByCam, [selectedCamId]: updated });
    try {
      await fetch(`/api/backend/camera/${selectedCamId}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: updated })
      });
    } catch (err) {}
  };

  // Calibration Calculation
  const handleSaveCalibration = async () => {
    if (calibSrcPoints.length !== 4) {
      alert("Vui lòng chọn đúng 4 điểm góc chuẩn trên khung hình camera!");
      return;
    }

    const dstPoints = [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]];

    try {
      const res = await fetch(`/api/backend/camera/${calibCamId}/calibration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ src_points: calibSrcPoints, dst_points: dstPoints })
      });
      if (res.ok) {
        setCalibStatus("Hiệu chỉnh ma trận Homography thành công!");
        setCalibSrcPoints([]);
      } else {
        alert("Không thể tính ma trận Homography từ 4 điểm này.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: 'calc(100vh - 84px)', padding: '24px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '24px' }}>
          <button
            onClick={() => setActiveTab('camera')}
            style={{
              padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '15px',
              background: activeTab === 'camera' ? '#3b82f6' : 'white',
              color: activeTab === 'camera' ? 'white' : '#64748b'
            }}
          >
            Quản lý Camera ({cameras.length})
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            style={{
              padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '15px',
              background: activeTab === 'rules' ? '#3b82f6' : 'white',
              color: activeTab === 'rules' ? 'white' : '#64748b'
            }}
          >
            Cấu hình Phân tích Hành vi (ROI / Tripwire)
          </button>
          <button
            onClick={() => setActiveTab('calibration')}
            style={{
              padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '15px',
              background: activeTab === 'calibration' ? '#3b82f6' : 'white',
              color: activeTab === 'calibration' ? 'white' : '#64748b'
            }}
          >
            Camera Calibration (2D $\to$ 3D Floor Map)
          </button>
        </div>

        {/* TAB 1: CAMERA MANAGEMENT */}
        {activeTab === 'camera' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', border: '1px solid #e2e8f0' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', marginBottom: '16px' }}>Đăng ký Luồng Camera Mới</h2>
              <form onSubmit={handleAddCamera} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '14px', color: '#64748b', marginBottom: '6px' }}>Tên Camera</label>
                  <input
                    type="text"
                    value={newCamName}
                    onChange={(e) => setNewCamName(e.target.value)}
                    placeholder="VD: Cổng chính, Kho A..."
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div style={{ flex: 2 }}>
                  <label style={{ display: 'block', fontSize: '14px', color: '#64748b', marginBottom: '6px' }}>IP Address hoặc RTSP URL</label>
                  <input
                    type="text"
                    value={newCamUrl}
                    onChange={(e) => setNewCamUrl(e.target.value)}
                    placeholder="192.168.1.100 hoặc rtsp://..."
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <button type="submit" style={{ padding: '10px 24px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                  + Thêm Camera
                </button>
              </form>
            </div>

            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                    <th style={{ padding: '16px 20px' }}>ID</th>
                    <th style={{ padding: '16px 20px' }}>TÊN CAMERA</th>
                    <th style={{ padding: '16px 20px' }}>RTSP URL</th>
                    <th style={{ padding: '16px 20px' }}>TRẠNG THÁI</th>
                    <th style={{ padding: '16px 20px', textAlign: 'right' }}>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {cameras.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '16px 20px', color: '#64748b', fontFamily: 'monospace' }}>#{c.id}</td>
                      <td style={{ padding: '16px 20px', fontWeight: 600, color: '#1e293b' }}>{c.name}</td>
                      <td style={{ padding: '16px 20px', color: '#64748b', fontFamily: 'monospace' }}>{c.rtsp_url}</td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{ background: '#dcfce7', color: '#16a34a', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
                          Live WebRTC
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => setEditCamModal({ open: true, id: c.id, name: c.name, url: c.rtsp_url })}
                            style={{ background: 'transparent', border: '1px solid #93c5fd', color: '#2563eb', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => handleDeleteCamera(c.id)}
                            style={{ background: 'transparent', border: '1px solid #fca5a5', color: '#ef4444', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: RULES (ROI & TRIPWIRES) */}
        {activeTab === 'rules' && (
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
            {/* Left Config Panel */}
            <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>Chọn Camera</label>
                <select
                  value={selectedCamId}
                  onChange={(e) => setSelectedCamId(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  {cameras.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>Loại Quy Tắc Hành Vi</label>
                <select
                  value={currentRuleType}
                  onChange={(e) => { setCurrentRuleType(e.target.value); setCurrentPoints([]); }}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="intrusion">Vùng cấm xâm nhập (Intrusion ROI)</option>
                  <option value="tripwire">Vạch ảo 2 chiều (Tripwire Line)</option>
                  <option value="dwell_time">Lảng vãng / Dừng chờ lâu (Dwell Time)</option>
                  <option value="density">Cảnh báo mật độ đám đông (Crowd Density)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>Tên Khu Vực / Vạch</label>
                <input
                  type="text"
                  value={currentRuleName}
                  onChange={(e) => setCurrentRuleName(e.target.value)}
                  placeholder="VD: Cửa thoát hiểm, Hành lang 1..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              {currentRuleType === 'dwell_time' && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>Ngưỡng dừng chờ (giây)</label>
                  <input
                    type="number"
                    value={currentThreshold}
                    onChange={(e) => setCurrentThreshold(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              )}

              {currentRuleType === 'density' && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>Số người tối đa (Sức chứa)</label>
                  <input
                    type="number"
                    value={currentThreshold}
                    onChange={(e) => setCurrentThreshold(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button
                  onClick={() => { setIsDrawing(true); setCurrentPoints([]); }}
                  style={{ flex: 1, padding: '8px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {isDrawing ? 'Đang chấm điểm...' : '+ Chấm Tọa Độ'}
                </button>
                <button
                  onClick={handleSaveCurrentRule}
                  disabled={currentPoints.length === 0}
                  style={{ flex: 1, padding: '8px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', opacity: currentPoints.length === 0 ? 0.5 : 1 }}
                >
                  Lưu Quy Tắc
                </button>
              </div>

              {/* Active Rules List */}
              <div style={{ marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <h4 style={{ fontSize: '13px', color: '#475569', margin: '0 0 10px 0' }}>Quy tắc đã lưu:</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                  {(rulesByCam[selectedCamId] || []).map(r => {
                    const rType = r.type || r.rule_type || 'intrusion';
                    return (
                      <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: '#f8fafc', borderRadius: '6px', fontSize: '12px' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{r.name}</div>
                          <div style={{ color: '#64748b', textTransform: 'capitalize' }}>{rType}</div>
                        </div>
                        <button onClick={() => handleDeleteRule(r.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Interactive Canvas */}
            <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#0f172a', borderRadius: '8px', overflow: 'hidden' }}>
                {selectedCamId && (
                  <iframe
                    src={`http://localhost:8081/${selectedCamId}/?controls=0&autoplay=1&muted=1&playsinline=1`}
                    style={{ width: '100%', height: '100%', border: 'none', position: 'absolute', top: 0, left: 0 }}
                    scrolling="no"
                  />
                )}

                {/* SVG Layer for Drawing & Visualizing Rules */}
                <svg
                  viewBox="0 0 1 1"
                  preserveAspectRatio="none"
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: isDrawing ? 'crosshair' : 'default', zIndex: 10 }}
                  onClick={(e) => {
                    if (!isDrawing) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = (e.clientX - rect.left) / rect.width;
                    const y = (e.clientY - rect.top) / rect.height;
                    setCurrentPoints([...currentPoints, [x, y]]);
                  }}
                >
                  {/* Saved Rules */}
                  {(rulesByCam[selectedCamId] || []).map(r => {
                    const rType = r.type || r.rule_type || 'intrusion';
                    const pts = r.points || [];
                    if (rType === 'tripwire' && pts.length >= 2) {
                      return (
                        <g key={r.id}>
                          <line x1={pts[0][0]} y1={pts[0][1]} x2={pts[1][0]} y2={pts[1][1]} stroke="#10b981" strokeWidth="0.005" />
                          <circle cx={pts[0][0]} cy={pts[0][1]} r="0.008" fill="#10b981" />
                          <circle cx={pts[1][0]} cy={pts[1][1]} r="0.008" fill="#10b981" />
                          <text x={pts[0][0]} y={pts[0][1] - 0.02} fill="#ffffff" fontSize="0.03" fontWeight="bold">
                            {r.name} (TRIPWIRE)
                          </text>
                        </g>
                      );
                    } else if (pts.length >= 3) {
                      return (
                        <g key={r.id}>
                          <polygon points={pts.map(p => `${p[0]},${p[1]}`).join(' ')} fill="rgba(239, 68, 68, 0.25)" stroke="#ef4444" strokeWidth="0.004" />
                          <text x={pts[0][0]} y={pts[0][1] - 0.02} fill="#ffffff" fontSize="0.03" fontWeight="bold">
                            {r.name} ({rType.toUpperCase()})
                          </text>
                        </g>
                      );
                    }
                    return null;
                  })}

                  {/* Currently Drawing Points */}
                  {isDrawing && currentPoints.length > 0 && (
                    <>
                      {currentPoints.map((pt, idx) => (
                        <circle key={idx} cx={pt[0]} cy={pt[1]} r="0.008" fill="#3b82f6" stroke="#ffffff" strokeWidth="0.002" />
                      ))}
                      <polyline points={currentPoints.map(p => `${p[0]},${p[1]}`).join(' ')} fill="none" stroke="#3b82f6" strokeWidth="0.004" strokeDasharray="0.01" />
                    </>
                  )}
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CAMERA CALIBRATION (2D-to-Floor-Map) */}
        {activeTab === 'calibration' && (
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
            <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Hiệu chỉnh Tọa độ Không gian</h3>
              <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                Bấm 4 điểm góc trên mặt sàn của camera theo thứ tự (Góc trên-trái $\to$ trên-phải $\to$ dưới-phải $\to$ dưới-trái) để hệ thống tự động tính toán ma trận Homography ánh xạ đối tượng lên bản đồ sàn 2D/3D.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>Chọn Camera</label>
                <select
                  value={calibCamId}
                  onChange={(e) => { setCalibCamId(e.target.value); setCalibSrcPoints([]); setCalibStatus(''); }}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  {cameras.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
                <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>Số điểm đã chấm: {calibSrcPoints.length} / 4</div>
                {calibSrcPoints.map((pt, i) => (
                  <div key={i} style={{ color: '#64748b', fontSize: '11px', fontFamily: 'monospace' }}>
                    Điểm {i+1}: ({pt[0].toFixed(3)}, {pt[1].toFixed(3)})
                  </div>
                ))}
              </div>

              {calibStatus && (
                <div style={{ padding: '10px', background: '#ecfdf5', color: '#047857', borderRadius: '6px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={16} /> {calibStatus}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                <button
                  onClick={() => { setCalibSrcPoints([]); setCalibStatus(''); }}
                  style={{ flex: 1, padding: '10px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Chấm lại
                </button>
                <button
                  onClick={handleSaveCalibration}
                  disabled={calibSrcPoints.length !== 4}
                  style={{ flex: 1, padding: '10px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, opacity: calibSrcPoints.length !== 4 ? 0.5 : 1 }}
                >
                  Tính Ma Trận
                </button>
              </div>
            </div>

            {/* Calibration Click Canvas */}
            <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0' }}>
              <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#0f172a', borderRadius: '8px', overflow: 'hidden' }}>
                {calibCamId && (
                  <iframe
                    src={`http://localhost:8081/${calibCamId}/?controls=0&autoplay=1&muted=1&playsinline=1`}
                    style={{ width: '100%', height: '100%', border: 'none', position: 'absolute', top: 0, left: 0 }}
                    scrolling="no"
                  />
                )}

                <svg
                  viewBox="0 0 1 1"
                  preserveAspectRatio="none"
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'crosshair', zIndex: 10 }}
                  onClick={(e) => {
                    if (calibSrcPoints.length >= 4) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = (e.clientX - rect.left) / rect.width;
                    const y = (e.clientY - rect.top) / rect.height;
                    setCalibSrcPoints([...calibSrcPoints, [x, y]]);
                  }}
                >
                  {calibSrcPoints.map((pt, idx) => (
                    <g key={idx}>
                      <circle cx={pt[0]} cy={pt[1]} r="0.01" fill="#f59e0b" stroke="#ffffff" strokeWidth="0.002" />
                      <text x={pt[0] + 0.015} y={pt[1] + 0.015} fill="#f59e0b" fontSize="0.035" fontWeight="bold" stroke="#000000" strokeWidth="0.001">
                        P{idx + 1}
                      </text>
                    </g>
                  ))}
                  {calibSrcPoints.length >= 2 && (
                    <polygon points={calibSrcPoints.map(p => `${p[0]},${p[1]}`).join(' ')} fill="rgba(245, 158, 11, 0.2)" stroke="#f59e0b" strokeWidth="0.003" />
                  )}
                </svg>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Auth Modal for RTSP Credentials */}
      {showAuthModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={(e) => { e.preventDefault(); handleApplyCameraAuth(); }} style={{ background: 'white', padding: '32px', borderRadius: '12px', width: '400px' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#1e293b' }}>Xác thực luồng RTSP</h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#64748b' }}>Hãng Camera</label>
              <select value={cameraBrand} onChange={(e) => setCameraBrand(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                <option value="hikvision">Hikvision</option>
                <option value="dahua">Dahua</option>
                <option value="custom">Tùy chỉnh (Link RTSP đầy đủ)</option>
              </select>
            </div>

            {cameraBrand !== 'custom' ? (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#64748b' }}>Tài khoản</label>
                  <input type="text" value={authUsername} onChange={(e) => setAuthUsername(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                </div>
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#64748b' }}>Mật khẩu</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPassword ? "text" : "password"} value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ marginBottom: '24px', padding: '12px', background: '#eff6ff', borderRadius: '6px', fontSize: '13px', color: '#1e3a8a' }}>
                Sử dụng nguyên bản đường dẫn RTSP bạn vừa nhập ở màn hình trước.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" onClick={() => setShowAuthModal(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}>
                Hủy
              </button>
              <button type="submit" style={{ padding: '8px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                Xác nhận
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Camera Modal */}
      {editCamModal.open && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleSaveEditCamera} style={{ background: 'white', padding: '32px', borderRadius: '12px', width: '460px' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#1e293b' }}>Chỉnh sửa thông tin Camera</h3>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#64748b' }}>Tên Camera</label>
              <input
                type="text"
                value={editCamModal.name}
                onChange={(e) => setEditCamModal({ ...editCamModal, name: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                required
              />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#64748b' }}>RTSP URL / IP Address</label>
              <input
                type="text"
                value={editCamModal.url}
                onChange={(e) => setEditCamModal({ ...editCamModal, url: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                required
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setEditCamModal({ open: false, id: '', name: '', url: '' })}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}
              >
                Hủy
              </button>
              <button
                type="submit"
                style={{ padding: '8px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
              >
                Lưu Thay Đổi
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
