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
  Legend,
  Line,
  ComposedChart,
} from 'recharts';
import { useFloodData } from '../../context/FloodDataContext';

function RainfallTrendChart() {
  const { rainfallTrend, selectedWard } = useFloodData();
  const [viewMode, setViewMode] = useState('both'); // 'rainfall', 'drainLoad', 'both'

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
            minWidth: '160px',
          }}
        >
          <p style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0F172A', marginBottom: '6px' }}>
            {label} {selectedWard ? `— ${selectedWard.ward_name}` : '— Kolkata Average'}
          </p>
          {payload.map((entry, idx) => (
            <div
              key={idx}
              style={{
                fontSize: '0.78rem',
                color: entry.color,
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px',
                marginTop: '3px',
              }}
            >
              <span>{entry.name}:</span>
              <strong>
                {entry.value} {entry.unit || (entry.dataKey === 'drainLoad' ? '%' : 'mm')}
              </strong>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const chartData = rainfallTrend && rainfallTrend.length > 0
    ? rainfallTrend
    : [
        { time: 'Sep 25', rainfall: 285, forecast: 280, drainLoad: 85 },
        { time: 'Oct 25', rainfall: 160, forecast: 150, drainLoad: 55 },
        { time: 'Nov 25', rainfall: 35, forecast: 40, drainLoad: 25 },
        { time: 'Dec 25', rainfall: 15, forecast: 20, drainLoad: 18 },
        { time: 'Jan 26', rainfall: 12, forecast: 15, drainLoad: 16 },
        { time: 'Feb 26', rainfall: 22, forecast: 25, drainLoad: 20 },
        { time: 'Mar 26', rainfall: 35, forecast: 40, drainLoad: 30 },
        { time: 'Apr 26', rainfall: 80, forecast: 85, drainLoad: 45 },
        { time: 'May 26', rainfall: 135, forecast: 140, drainLoad: 60 },
        { time: 'Jun 26', rainfall: 290, forecast: 280, drainLoad: 88 },
        { time: 'Jul 26', rainfall: 360, forecast: 350, drainLoad: 95 },
        { time: 'Aug 26', rainfall: 335, forecast: 320, drainLoad: 92 },
      ];

  return (
    <div className="dashboard-card" id="rainfall-trend-card">
      <div className="card-header">
        <div>
          <h3>
            Rainfall & Drain Saturation Trend
          </h3>
          <p className="card-subtitle text-xs text-slate-500">
            {selectedWard
              ? `${selectedWard.ward_name} (Ward ${selectedWard.ward_id}) • 12-Month ML Dataset`
              : 'All Kolkata Wards • Historical vs Forecast Pattern'}
          </p>
        </div>
        <select
          className="rainfall-dropdown"
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value)}
          id="rainfall-view-mode-select"
        >
          <option value="both">Rainfall + Drain Load</option>
          <option value="rainfall">Rainfall (mm) Only</option>
          <option value="drainLoad">Drain Load (%) Only</option>
        </select>
      </div>

      <ResponsiveContainer width="100%" height={230}>
        <ComposedChart data={chartData} barCategoryGap="18%">
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11, fill: '#64748B' }}
            axisLine={{ stroke: '#E2E8F0' }}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11, fill: '#64748B' }}
            axisLine={false}
            tickLine={false}
            unit=" mm"
          />
          {(viewMode === 'both' || viewMode === 'drainLoad') && (
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: '#EF4444' }}
              axisLine={false}
              tickLine={false}
              unit="%"
            />
          )}
          <Tooltip content={<CustomTooltip />} />

          {(viewMode === 'both' || viewMode === 'rainfall') && (
            <Bar
              yAxisId="left"
              dataKey="rainfall"
              name="Historical Rainfall"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    entry.rainfall >= 300
                      ? '#1D4ED8'
                      : entry.rainfall >= 150
                      ? '#3B82F6'
                      : '#93C5FD'
                  }
                />
              ))}
            </Bar>
          )}

          {(viewMode === 'both' || viewMode === 'rainfall') && (
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="forecast"
              name="Forecast Rainfall"
              stroke="#06B6D4"
              strokeWidth={2}
              dot={{ r: 3, fill: '#06B6D4' }}
            />
          )}

          {(viewMode === 'both' || viewMode === 'drainLoad') && (
            <Line
              yAxisId={viewMode === 'drainLoad' ? 'left' : 'right'}
              type="monotone"
              dataKey="drainLoad"
              name="Drain Load %"
              stroke="#EF4444"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ r: 3, fill: '#EF4444' }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      <div className="chart-legend-row">
        <span className="legend-item">
          <span className="legend-dot" style={{ background: '#1D4ED8' }} />
          Observed Rainfall (mm)
        </span>
        <span className="legend-item">
          <span className="legend-line" style={{ background: '#06B6D4' }} />
          Forecast (mm)
        </span>
        <span className="legend-item">
          <span className="legend-line dashed" style={{ background: '#EF4444' }} />
          Drain Saturation (%)
        </span>
      </div>
    </div>
  );
}

export default RainfallTrendChart;
