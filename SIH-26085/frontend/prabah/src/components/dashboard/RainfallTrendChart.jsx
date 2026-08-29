import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { rainfallData } from '../../data/rainfallData';

function RainfallTrendChart() {
  const [period, setPeriod] = useState('24h');

  const handlePeriodChange = (e) => {
    setPeriod(e.target.value);
    const payload = {
      action: 'change_rainfall_period',
      period: e.target.value,
      timestamp: new Date().toISOString(),
    };
    console.log('Sending to backend:', JSON.stringify(payload, null, 2));
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            background: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            padding: '10px 14px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
        >
          <p style={{ fontWeight: 600, fontSize: '0.82rem', color: '#0F172A', marginBottom: '4px' }}>
            {label}
          </p>
          <p style={{ fontSize: '0.78rem', color: '#2563EB' }}>
            Rainfall: <strong>{payload[0].value} mm</strong>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="dashboard-card" id="rainfall-trend-card">
      <div className="card-header">
        <h3>Rainfall Trend (mm)</h3>
        <select
          className="rainfall-dropdown"
          value={period}
          onChange={handlePeriodChange}
          id="rainfall-period-select"
        >
          <option value="24h">24 Hours</option>
          <option value="48h">48 Hours</option>
          <option value="7d">7 Days</option>
        </select>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={rainfallData} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11, fill: '#64748B' }}
            axisLine={{ stroke: '#E2E8F0' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#64748B' }}
            axisLine={false}
            tickLine={false}
            domain={[0, 100]}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(37, 99, 235, 0.05)' }} />
          <Bar dataKey="rainfall" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {rainfallData.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.rainfall >= 60 ? '#2563EB' : entry.rainfall >= 30 ? '#60A5FA' : '#BFDBFE'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div style={{ textAlign: 'center', marginTop: '8px' }}>
        <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#2563EB', display: 'inline-block' }} />
          Rainfall (mm)
        </span>
      </div>
    </div>
  );
}

export default RainfallTrendChart;
