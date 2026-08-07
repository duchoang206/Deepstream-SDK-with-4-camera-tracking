'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '../../components/LanguageContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Activity, Camera, AlertTriangle, Zap, Clock } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export default function AnalyticsPage() {
  const { t } = useLanguage();
  const [data, setData] = useState({
    total_objects: 0,
    active_cameras: 0,
    total_alerts: 0,
    system_efficiency: 0,
    class_distribution: [],
    alerts_trend: []
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

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading analytics...</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Clock className="w-8 h-8 text-blue-600" />
        <h1 className="text-3xl font-bold text-slate-800">{t.analytics.title}</h1>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Card 1: Total Objects */}
        <div className="bg-indigo-500 rounded-xl p-6 text-white shadow-lg shadow-indigo-200">
          <div className="flex justify-between items-start">
            <h3 className="text-indigo-100 font-medium">{t.analytics.totalObjects}</h3>
            <Activity className="w-6 h-6 text-indigo-200" />
          </div>
          <p className="text-4xl font-bold mt-4">{data.total_objects.toLocaleString()}</p>
          <p className="text-indigo-200 text-sm mt-2">Detections processed</p>
        </div>

        {/* Card 2: Active Cameras */}
        <div className="bg-emerald-500 rounded-xl p-6 text-white shadow-lg shadow-emerald-200">
          <div className="flex justify-between items-start">
            <h3 className="text-emerald-100 font-medium">{t.analytics.activeCameras}</h3>
            <Camera className="w-6 h-6 text-emerald-200" />
          </div>
          <p className="text-4xl font-bold mt-4">{data.active_cameras}</p>
          <p className="text-emerald-200 text-sm mt-2">Live streams</p>
        </div>

        {/* Card 3: Total Alerts */}
        <div className="bg-slate-600 rounded-xl p-6 text-white shadow-lg shadow-slate-200">
          <div className="flex justify-between items-start">
            <h3 className="text-slate-300 font-medium">{t.analytics.totalAlerts}</h3>
            <AlertTriangle className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-4xl font-bold mt-4">{data.total_alerts.toLocaleString()}</p>
          <p className="text-slate-400 text-sm mt-2">Intrusion events</p>
        </div>

        {/* Card 4: System Efficiency */}
        <div className="bg-amber-500 rounded-xl p-6 text-white shadow-lg shadow-amber-200">
          <div className="flex justify-between items-start">
            <h3 className="text-amber-100 font-medium">{t.analytics.systemAccuracy}</h3>
            <Zap className="w-6 h-6 text-amber-200" />
          </div>
          <p className="text-4xl font-bold mt-4">{data.system_efficiency}%</p>
          <p className="text-amber-200 text-sm mt-2">Overall performance</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Donut Chart: Object Types */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-700 mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-500" />
            {t.analytics.objectTypes}
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.class_distribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.class_distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  formatter={(value) => [`${value} objects`, 'Count']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart: Alerts Trend */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-700 mb-6 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-emerald-500" />
            {t.analytics.alertsOverTime}
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.alerts_trend} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                <RechartsTooltip 
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="alerts" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
