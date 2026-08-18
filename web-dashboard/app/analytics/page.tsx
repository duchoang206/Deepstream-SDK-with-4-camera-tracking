'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '../../components/LanguageContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Activity, Camera, ShieldAlert, Zap, Clock, Search, ArrowRightLeft, UserCheck, History, MapPin } from 'lucide-react';

const COLORS = ['#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#3b82f6'];

export default function AnalyticsPage() {
  const { t } = useLanguage();
  const [data, setData] = useState({
    total_objects: 0,
    active_cameras: 0,
    total_alerts: 0,
    system_efficiency: 99.4,
    class_distribution: [],
    alerts_trend: [],
    recent_events: [],
    tripwire_stats: []
  });
  const [loading, setLoading] = useState(true);

  // Global ID Journey Search
  const [searchGid, setSearchGid] = useState('');
  const [journeyData, setJourneyData] = useState<any>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/backend/analytics/dashboard');
      if (response.ok) {
        const json = await response.json();
        setData(json);
      }
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSearchJourney = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchGid) return;
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/backend/tracks/${searchGid}/history`);
      if (res.ok) {
        const json = await res.json();
        setJourneyData(json.data);
      } else {
        setJourneyData(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: 'calc(100vh - 84px)', padding: '24px' }}>
      <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
              AI Video Analytics & Storage Dashboard
            </h1>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
              Dữ liệu sự kiện lưu trữ & truy vấn thời gian thực trên <b>PostgreSQL 15</b>
            </p>
          </div>

          {/* Quick Cross-Camera Journey Search */}
          <form onSubmit={handleSearchJourney} style={{ display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                value={searchGid}
                onChange={(e) => setSearchGid(e.target.value)}
                placeholder="Tra cứu Global ID (VD: 1, 2...)"
                style={{ padding: '8px 12px 8px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', width: '240px' }}
              />
              <UserCheck size={16} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
            <button type="submit" style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
              Tra cứu vết
            </button>
          </form>
        </div>

        {/* Global Track Journey Result Drawer (if searched) */}
        {journeyData && (
          <div style={{ background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: '#1e40af', fontSize: '15px' }}>
                <History size={18} /> Hành trình đối tượng Global ID #{journeyData.global_id} qua các Camera
              </div>
              <button onClick={() => setJourneyData(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px' }}>
              {(journeyData.trajectory || []).map((step: any, idx: number) => (
                <div key={idx} style={{ background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #dbeafe', minWidth: '180px', fontSize: '12px' }}>
                  <div style={{ fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={14} color="#3b82f6" /> Camera {step.cam_id}
                  </div>
                  <div style={{ color: '#64748b', marginTop: '4px' }}>
                    Tọa độ sàn: ({step.floor_pos ? step.floor_pos[0].toFixed(2) : step.floor_x?.toFixed(2)}, {step.floor_pos ? step.floor_pos[1].toFixed(2) : step.floor_y?.toFixed(2)})
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '4px' }}>
                    {new Date(step.timestamp * (step.timestamp < 1e12 ? 1000 : 1)).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4 Summary Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          <div style={{ background: '#3b82f6', borderRadius: '12px', padding: '20px', color: 'white' }}>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>Số Luồng Camera</div>
            <div style={{ fontSize: '36px', fontWeight: 'bold', margin: '4px 0' }}>{data.active_cameras}</div>
            <div style={{ fontSize: '11px', opacity: 0.8 }}>WHEP WebRTC Active</div>
          </div>

          <div style={{ background: '#ef4444', borderRadius: '12px', padding: '20px', color: 'white' }}>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>Tổng Cảnh Báo Hành Vi</div>
            <div style={{ fontSize: '36px', fontWeight: 'bold', margin: '4px 0' }}>{data.total_alerts}</div>
            <div style={{ fontSize: '11px', opacity: 0.8 }}>Intrusion / Dwell / Density</div>
          </div>

          <div style={{ background: '#10b981', borderRadius: '12px', padding: '20px', color: 'white' }}>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>Độ trễ Suy Luận GPU</div>
            <div style={{ fontSize: '36px', fontWeight: 'bold', margin: '4px 0' }}>&lt; 5 ms</div>
            <div style={{ fontSize: '11px', opacity: 0.8 }}>TensorRT FP16 Zero-Copy</div>
          </div>

          <div style={{ background: '#6366f1', borderRadius: '12px', padding: '20px', color: 'white' }}>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>Hiệu Quản MTMC Fusion</div>
            <div style={{ fontSize: '36px', fontWeight: 'bold', margin: '4px 0' }}>{data.system_efficiency}%</div>
            <div style={{ fontSize: '11px', opacity: 0.8 }}>Hungarian Re-ID Association</div>
          </div>
        </div>

        {/* 2-Column Main Dashboard Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          
          {/* Left Column: Events Distribution & Tripwires */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Event Classification Bar Chart */}
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e293b', marginBottom: '16px' }}>
                Phân bố Sự kiện Hành vi
              </h3>
              <div style={{ height: '220px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.class_distribution}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <RechartsTooltip />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {data.class_distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tripwire Line Crossing Counters */}
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
                  Thống kê Đếm Lưu lượng Vạch ảo (Tripwire)
                </h3>
                <ArrowRightLeft size={18} color="#10b981" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(data.tripwire_stats || []).length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '16px' }}>
                    Chưa có vạch ảo nào ghi nhận lượt qua
                  </div>
                ) : (
                  (data.tripwire_stats || []).map((t: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', fontSize: '13px' }}>
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>{t.rule_id} (Camera {t.cam_id})</span>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>VÀO: {t.entry}</span>
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>RA: {t.exit}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* Right Column: Recent PostgreSQL Event Logs */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e293b', marginBottom: '16px' }}>
              Nhật ký Sự kiện Mới nhất (PostgreSQL Logs)
            </h3>
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: '480px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(data.recent_events || []).length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '32px' }}>
                  Chưa có nhật ký sự kiện
                </div>
              ) : (
                (data.recent_events || []).map((ev: any, i: number) => (
                  <div key={i} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9', background: '#ffffff', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: '#1e293b', textTransform: 'uppercase', fontSize: '11px', background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '4px' }}>
                        {ev.type}
                      </span>
                      <span style={{ color: '#94a3b8', fontSize: '11px' }}>{ev.time}</span>
                    </div>
                    <div style={{ color: '#334155' }}>{ev.description}</div>
                    <div style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>Nguồn: Camera {ev.camera}</div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
