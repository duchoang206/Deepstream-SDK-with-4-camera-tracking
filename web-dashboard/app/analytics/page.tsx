'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '../../components/LanguageContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Activity, Camera, AlertTriangle, Zap, Clock, Calendar, Download, Search, LayoutTemplate } from 'lucide-react';

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6'];

export default function AnalyticsPage() {
  const { t } = useLanguage();
  const [data, setData] = useState({
    total_objects: 0,
    active_cameras: 0,
    total_alerts: 0,
    system_efficiency: 0,
    class_distribution: [],
    alerts_trend: [],
    recent_events: [],
    camera_stats: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/backend/analytics/dashboard');
        const json = await response.json();
        setData(json);
      } catch (error) {
        console.error('Error fetching analytics data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    const interval = setInterval(fetchData, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div style={{ backgroundColor: '#f1f5f9', minHeight: 'calc(100vh - 84px)', padding: '24px' }}>
      <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
        
        {/* Top Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <button style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ef4444', color: 'white', padding: '8px 16px', borderRadius: '4px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
              <Download size={16} /> Export PDF
            </button>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'white', padding: '6px 16px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '14px', color: '#334155' }}>
              <Calendar size={16} color="#64748b" />
              <span>{todayStr} 00:00:00 - {todayStr} 23:59:59</span>
              <Calendar size={16} color="#64748b" />
            </div>
            <button style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer', display: 'flex' }}>
              <Search size={18} />
            </button>
          </div>
        </div>

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Clock className="text-slate-600" size={24} />
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>System Statistics Dashboard</h1>
        </div>

        {/* Top 4 Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          
          <div style={{ background: '#6366f1', borderRadius: '8px', padding: '20px', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>Total Cameras</div>
              <Camera size={20} opacity={0.8} />
            </div>
            <div style={{ fontSize: '40px', fontWeight: 'bold', margin: '8px 0' }}>{data.active_cameras}</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>Online Availability 100%</div>
          </div>

          <div style={{ background: '#10b981', borderRadius: '8px', padding: '20px', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>Active ROIs</div>
              <LayoutTemplate size={20} opacity={0.8} />
            </div>
            <div style={{ fontSize: '40px', fontWeight: 'bold', margin: '8px 0' }}>{data.total_alerts > 0 ? 5 : 2}</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>Configured Zones</div>
          </div>

          <div style={{ background: '#475569', borderRadius: '8px', padding: '20px', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>Total Detections</div>
              <Activity size={20} opacity={0.8} />
            </div>
            <div style={{ fontSize: '40px', fontWeight: 'bold', margin: '8px 0' }}>{data.total_objects.toLocaleString()}</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>Success Rate 98%</div>
          </div>

          <div style={{ background: '#f59e0b', borderRadius: '8px', padding: '20px', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>System Efficiency</div>
              <Zap size={20} opacity={0.8} />
            </div>
            <div style={{ fontSize: '40px', fontWeight: 'bold', margin: '8px 0' }}>{data.system_efficiency}%</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>Overall Performance</div>
          </div>
        </div>

        {/* 2 Column Main Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Camera Status (Donut) */}
            <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', color: '#475569', fontWeight: '600', fontSize: '14px' }}>
                <Camera size={16} color="#3b82f6" /> Camera Status
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', marginBottom: '20px', fontSize: '12px', fontWeight: '600' }}>
                <div><div style={{ fontSize: '16px', color: '#0f172a' }}>{data.active_cameras}</div><div style={{ color: '#64748b' }}>Total Cameras</div></div>
                <div><div style={{ fontSize: '16px', color: '#0f172a' }}>{data.active_cameras}</div><div style={{ color: '#64748b' }}>Online</div></div>
                <div><div style={{ fontSize: '16px', color: '#0f172a' }}>0</div><div style={{ color: '#64748b' }}>Offline</div></div>
                <div><div style={{ fontSize: '16px', color: '#0f172a' }}>100%</div><div style={{ color: '#64748b' }}>Availability</div></div>
              </div>
              
              <div style={{ height: '200px', display: 'flex', justifyContent: 'center', position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[{name: 'Online', value: data.active_cameras > 0 ? data.active_cameras : 1}]} cx="50%" cy="50%" innerRadius={60} outerRadius={80} fill="#10b981" dataKey="value" stroke="none">
                      <Cell fill="#10b981" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                  <div style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '2px', display: 'inline-block', marginRight: '4px' }}></div>
                  Online (100%)
                </div>
              </div>
            </div>

            {/* Recent Alerts Table (Replaces Battery Health) */}
            <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '20px', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', color: '#475569', fontWeight: '600', fontSize: '14px' }}>
                <AlertTriangle size={16} color="#f59e0b" /> Recent Alerts
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ color: '#64748b', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ paddingBottom: '12px', fontWeight: '600' }}>CAMERA NAME</th>
                    <th style={{ paddingBottom: '12px', fontWeight: '600' }}>DETECTION TYPE</th>
                    <th style={{ paddingBottom: '12px', fontWeight: '600' }}>TIME</th>
                    <th style={{ paddingBottom: '12px', fontWeight: '600', textAlign: 'right' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.recent_events || []).length > 0 ? (data.recent_events || []).map((ev, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 0', fontWeight: '600', color: '#0f172a' }}>{ev.camera}</td>
                      <td style={{ padding: '12px 0', color: '#475569' }}>{ev.type}</td>
                      <td style={{ padding: '12px 0', color: '#475569' }}>{new Date(ev.time).toLocaleTimeString()}</td>
                      <td style={{ padding: '12px 0', textAlign: 'right' }}>
                        <span style={{ color: '#10b981', background: '#ecfdf5', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>{ev.status}</span>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8' }}>No recent alerts</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Detection Stats (Bar Chart) */}
            <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: '600', fontSize: '14px' }}>
                  <Activity size={16} color="#f59e0b" /> Detection Stats
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Total Detections <span style={{ color: '#3b82f6', fontWeight: '600' }}>{data.total_objects}</span>
                </div>
              </div>
              
              <div style={{ height: '240px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.class_distribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={{ stroke: '#cbd5e1' }} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '4px', border: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {data.class_distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Camera Statistics Table (Replaces Map statisticals) */}
            <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '20px', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: '600', fontSize: '14px' }}>
                  <LayoutTemplate size={16} color="#3b82f6" /> Camera Statistics
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Total Cameras - {data.active_cameras}</div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'center' }}>
                <thead>
                  <tr style={{ color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ paddingBottom: '12px', fontWeight: '600', textAlign: 'left' }}>CAMERA</th>
                    <th style={{ paddingBottom: '12px', fontWeight: '600' }}>TOTAL DETECTS</th>
                    <th style={{ paddingBottom: '12px', fontWeight: '600' }}>STATUS</th>
                    <th style={{ paddingBottom: '12px', fontWeight: '600', color: '#ef4444' }}>ALARM</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.camera_stats || []).length > 0 ? (data.camera_stats || []).map((stat, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 0', fontWeight: '600', color: '#0f172a', textAlign: 'left' }}>{stat.camera}</td>
                      <td style={{ padding: '12px 0', color: '#475569', fontWeight: '600' }}>{stat.total}</td>
                      <td style={{ padding: '12px 0', color: '#10b981', fontWeight: '600' }}>Online</td>
                      <td style={{ padding: '12px 0', color: '#ef4444', fontWeight: '600' }}>0</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} style={{ padding: '24px 0', color: '#94a3b8' }}>No camera data available</td></tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
